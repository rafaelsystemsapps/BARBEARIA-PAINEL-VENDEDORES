-- =============================================================
-- Painel de Vendedores — Patch: Camada de Gestor (times)
-- =============================================================
-- Adiciona o papel 'gestor'. Cada gestor tem um team_code (tipo
-- cupom) e um override percentual definido pelo admin. O seller
-- entra num time informando o team_code no cadastro.
--
-- MODELO DO "BOLO FIXO" (não pode quebrar os números):
--   * O seller SEMPRE recebe o piso da tabela (30/40 recorrente,
--     20/30 setup). Ter gestor nunca reduz a comissão do seller.
--   * O override do gestor é pago POR FORA, sobre o mesmo valor
--     pago pelo cliente, nunca descontado do seller.
--   * Bonificação = o gestor cede pontos do PRÓPRIO override ao
--     time. seller + gestor permanece constante = piso + override.
--   * teto_comissao_pct (settings) limita seller + gestor.
--   * Snapshot no fechamento: gestor_id e percentuais congelam no
--     cliente. Mudanças futuras não afetam clientes já fechados.
--   * Mesmo gatilho: confirm_payment() gera as DUAS entries na
--     mesma transação. Cliente não pagou = ninguém ganha.
-- =============================================================

-- 1) Enums: novo papel e nova origem de comissão ---------------
alter type public.user_role add value if not exists 'gestor';

-- Distingue no extrato a comissão de venda própria x override.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'entry_origem') then
    create type public.entry_origem as enum ('venda_propria', 'override_time');
  end if;
end$$;

-- 2) settings: teto de comissão -------------------------------
insert into public.settings (key, value)
values ('teto_comissao_pct', '60')
on conflict (key) do nothing;

-- 3) profiles: campos de time e override ----------------------
alter table public.profiles
  add column if not exists gestor_id uuid references public.profiles (id),
  add column if not exists team_code text unique,
  add column if not exists override_recorrente_pct integer not null default 0,
  add column if not exists override_setup_pct integer not null default 0,
  add column if not exists bonus_time_pct integer not null default 0,
  add column if not exists bonus_time_setup_pct integer not null default 0;

-- Consistência dos percentuais do gestor:
--   override entre 0 e 100; bônus nunca maior que o override.
alter table public.profiles drop constraint if exists profiles_override_valido;
alter table public.profiles add constraint profiles_override_valido check (
  override_recorrente_pct between 0 and 100
  and override_setup_pct between 0 and 100
  and bonus_time_pct between 0 and override_recorrente_pct
  and bonus_time_setup_pct between 0 and override_setup_pct
);

create index if not exists profiles_gestor_idx on public.profiles (gestor_id);

-- 4) clients: snapshot do gestor no fechamento ----------------
alter table public.clients
  add column if not exists gestor_id uuid references public.profiles (id),
  add column if not exists pct_gestor_recorrente integer,
  add column if not exists pct_gestor_setup integer;

-- Trava a matemática no banco (não confia só na aplicação):
-- seller + gestor nunca passa do teto configurado.
create or replace function public.check_client_commission_ceiling()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_teto integer;
begin
  select coalesce(nullif(value, '')::integer, 60) into v_teto
  from public.settings where key = 'teto_comissao_pct';
  v_teto := coalesce(v_teto, 60);

  if new.pct_recorrente + coalesce(new.pct_gestor_recorrente, 0) > v_teto then
    raise exception 'Comissão recorrente (seller %+ gestor %) excede o teto de %',
      new.pct_recorrente, coalesce(new.pct_gestor_recorrente, 0), v_teto;
  end if;

  if new.tem_setup
     and coalesce(new.pct_setup, 0) + coalesce(new.pct_gestor_setup, 0) > v_teto then
    raise exception 'Comissão de setup (seller %+ gestor %) excede o teto de %',
      new.pct_setup, coalesce(new.pct_gestor_setup, 0), v_teto;
  end if;

  return new;
end;
$$;

drop trigger if exists clients_check_ceiling on public.clients;
create trigger clients_check_ceiling
  before insert or update on public.clients
  for each row execute function public.check_client_commission_ceiling();

-- 5) commission_entries: origem (venda x override) ------------
-- Coluna com default para não quebrar linhas já existentes.
alter table public.commission_entries
  add column if not exists origem public.entry_origem not null default 'venda_propria';

create index if not exists entries_origem_idx
  on public.commission_entries (seller_id, origem);

-- 6) Proteção de colunas do profile (gestor não muda o próprio
--    override; só bônus dentro do limite). Amplia o trigger já
--    existente protect_profile_columns.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if not (public.is_admin() or public.is_service_role()) then
    -- Ninguém além do admin mexe em papel, status, código ou vínculo/override.
    if new.role is distinct from old.role
      or new.status is distinct from old.status
      or new.ref_code is distinct from old.ref_code
      or new.team_code is distinct from old.team_code
      or new.gestor_id is distinct from old.gestor_id
      or new.override_recorrente_pct is distinct from old.override_recorrente_pct
      or new.override_setup_pct is distinct from old.override_setup_pct then
      raise exception 'Somente o administrador pode alterar papel, status, código, time ou override';
    end if;

    -- Gestor pode ajustar a própria bonificação; seller não tem bônus.
    if (new.bonus_time_pct is distinct from old.bonus_time_pct
        or new.bonus_time_setup_pct is distinct from old.bonus_time_setup_pct)
       and old.role <> 'gestor' then
      raise exception 'Apenas gestores definem bonificação de time';
    end if;
  end if;
  return new;
end;
$$;

-- 7) Helpers de papel -----------------------------------------
create or replace function public.is_active_gestor()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role::text = 'gestor' and status = 'ativo'
  );
$$;

revoke execute on function public.is_active_gestor() from public, anon;
grant execute on function public.is_active_gestor() to authenticated, service_role;

-- 8) close_lead(): grava o snapshot do gestor ------------------
-- Nova assinatura mantém compatibilidade: mesma lista de parâmetros.
-- O gestor e os percentuais vêm do perfil do seller no momento do
-- fechamento (override − bônus para o gestor; piso + bônus para o
-- seller). Bônus é cedido pelo gestor DENTRO do próprio override,
-- então a soma seller+gestor não muda.
create or replace function public.close_lead(
  p_lead_id uuid,
  p_barbearia text,
  p_cidade text,
  p_mensalidade_cents integer,
  p_dia_vencimento integer,
  p_tem_setup boolean,
  p_setup_cents integer default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_lead public.leads%rowtype;
  v_seller public.profiles%rowtype;
  v_gestor public.profiles%rowtype;
  v_client_id uuid;
  v_pct_recorrente integer;
  v_pct_setup integer;
  v_pct_gestor_rec integer;
  v_pct_gestor_setup integer;
  v_gestor_id uuid;
  v_status public.client_status;
begin
  select * into v_lead from public.leads where id = p_lead_id for update;
  if not found then
    raise exception 'Lead não encontrado';
  end if;

  if not (
    public.is_admin()
    or public.is_service_role()
    or (public.is_active_seller() and v_lead.seller_id = auth.uid())
  ) then
    raise exception 'Sem permissão para fechar este lead';
  end if;

  if v_lead.status not in ('novo', 'em_negociacao') then
    raise exception 'Lead não está aberto (status atual: %)', v_lead.status;
  end if;

  if coalesce(p_mensalidade_cents, 0) <= 0 then
    raise exception 'Valor de mensalidade inválido';
  end if;
  if p_dia_vencimento is null or p_dia_vencimento not between 1 and 28 then
    raise exception 'Dia de vencimento deve estar entre 1 e 28';
  end if;

  select * into v_seller from public.profiles where id = v_lead.seller_id;
  v_gestor_id := v_seller.gestor_id;
  if v_gestor_id is not null then
    select * into v_gestor from public.profiles where id = v_gestor_id;
    -- Gestor pausado/removido: não congela override para vendas novas.
    if v_gestor.id is null or v_gestor.status <> 'ativo' or v_gestor.role <> 'gestor' then
      v_gestor_id := null;
    end if;
  end if;

  if p_tem_setup then
    if p_setup_cents is null or p_setup_cents < 50000 or p_setup_cents > 200000 then
      raise exception 'Valor de setup deve estar entre R$ 500,00 e R$ 2.000,00';
    end if;
    v_pct_recorrente := 40;
    v_pct_setup := case when p_setup_cents <= 80000 then 20 else 30 end;
    v_status := 'aguardando_setup';
  else
    if p_setup_cents is not null then
      raise exception 'Setup informado para venda sem setup';
    end if;
    v_pct_recorrente := 30;
    v_pct_setup := null;
    v_status := 'ativo';
  end if;

  -- Bonificação: gestor cede pontos ao time. Piso do seller sobe,
  -- override do gestor cai na mesma medida — soma constante.
  if v_gestor_id is not null then
    v_pct_recorrente := v_pct_recorrente + coalesce(v_gestor.bonus_time_pct, 0);
    v_pct_gestor_rec := greatest(coalesce(v_gestor.override_recorrente_pct, 0)
                                 - coalesce(v_gestor.bonus_time_pct, 0), 0);
    if p_tem_setup then
      v_pct_setup := v_pct_setup + coalesce(v_gestor.bonus_time_setup_pct, 0);
      v_pct_gestor_setup := greatest(coalesce(v_gestor.override_setup_pct, 0)
                                     - coalesce(v_gestor.bonus_time_setup_pct, 0), 0);
    end if;
  end if;

  update public.leads set status = 'fechado' where id = p_lead_id;

  insert into public.clients (
    lead_id, seller_id, gestor_id, barbearia, cidade, mensalidade_cents, dia_vencimento,
    tem_setup, setup_cents, pct_recorrente, pct_setup,
    pct_gestor_recorrente, pct_gestor_setup, status, closed_at
  ) values (
    p_lead_id,
    v_lead.seller_id,
    v_gestor_id,
    coalesce(nullif(trim(p_barbearia), ''), v_lead.barbearia),
    coalesce(nullif(trim(p_cidade), ''), v_lead.cidade),
    p_mensalidade_cents,
    p_dia_vencimento,
    p_tem_setup,
    p_setup_cents,
    v_pct_recorrente,
    v_pct_setup,
    v_pct_gestor_rec,
    v_pct_gestor_setup,
    v_status,
    now()
  ) returning id into v_client_id;

  if p_tem_setup then
    insert into public.payments (client_id, tipo, competencia, vencimento, valor_esperado_cents, status)
    values (v_client_id, 'setup', date_trunc('month', current_date)::date, current_date, p_setup_cents, 'aguardando');
  end if;

  return v_client_id;
end;
$$;

-- 9) confirm_payment(): gera entry do seller E do gestor -------
-- Arredondamento: comissões arredondam para baixo (floor); a sobra
-- de centavos fica com o admin. Isso garante que nenhuma soma passe
-- do valor pago e não exista centavo fantasma.
create or replace function public.confirm_payment(
  p_payment_id uuid,
  p_valor_pago_cents integer default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_client public.clients%rowtype;
  v_pct integer;
  v_pct_gestor integer;
  v_valor_pago integer;
  v_entry_id uuid;
begin
  if not (public.is_admin() or public.is_service_role()) then
    raise exception 'Apenas o administrador pode confirmar pagamentos';
  end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Cobrança não encontrada';
  end if;
  if v_payment.status <> 'aguardando' then
    raise exception 'Cobrança já processada (status: %)', v_payment.status;
  end if;

  v_valor_pago := coalesce(p_valor_pago_cents, v_payment.valor_esperado_cents);
  if v_valor_pago <= 0 then
    raise exception 'Valor pago inválido';
  end if;

  select * into v_client from public.clients where id = v_payment.client_id for update;

  update public.payments
  set status = 'confirmado',
      valor_pago_cents = v_valor_pago,
      confirmed_at = now(),
      confirmed_by = auth.uid()
  where id = p_payment_id;

  -- Entry do seller (venda própria) — floor para não estourar.
  v_pct := case when v_payment.tipo = 'setup' then v_client.pct_setup else v_client.pct_recorrente end;

  insert into public.commission_entries
    (seller_id, client_id, payment_id, tipo, competencia, valor_cents, origem, status)
  values (
    v_client.seller_id,
    v_client.id,
    v_payment.id,
    v_payment.tipo,
    v_payment.competencia,
    floor(v_valor_pago * v_pct / 100.0)::integer,
    'venda_propria',
    'disponivel'
  ) returning id into v_entry_id;

  -- Entry do gestor (override), na MESMA transação, se houver time.
  if v_client.gestor_id is not null then
    v_pct_gestor := case
      when v_payment.tipo = 'setup' then coalesce(v_client.pct_gestor_setup, 0)
      else coalesce(v_client.pct_gestor_recorrente, 0)
    end;

    if v_pct_gestor > 0 then
      insert into public.commission_entries
        (seller_id, client_id, payment_id, tipo, competencia, valor_cents, origem, status)
      values (
        v_client.gestor_id,
        v_client.id,
        v_payment.id,
        v_payment.tipo,
        v_payment.competencia,
        floor(v_valor_pago * v_pct_gestor / 100.0)::integer,
        'override_time',
        'disponivel'
      );
    end if;
  end if;

  if v_payment.tipo = 'setup' and v_client.status = 'aguardando_setup' then
    update public.clients set status = 'ativo' where id = v_client.id;
  end if;

  return v_entry_id;
end;
$$;

-- Regrant (a assinatura de close_lead/confirm_payment não mudou,
-- mas garantimos os grants após o replace).
grant execute on function
  public.close_lead(uuid, text, text, integer, integer, boolean, integer),
  public.confirm_payment(uuid, integer)
to authenticated, service_role;

-- 10) RLS: gestor enxerga (somente leitura) o próprio time -----
-- profiles: gestor vê os sellers vinculados a ele.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    id = auth.uid()
    or public.is_admin()
    or (public.is_active_gestor() and gestor_id = auth.uid())
  );

-- leads: gestor vê (não escreve) os leads dos sellers do time.
drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads
  for select using (
    public.is_admin()
    or (public.is_active_seller() and seller_id = auth.uid())
    or (public.is_active_gestor() and exists (
      select 1 from public.profiles p
      where p.id = leads.seller_id and p.gestor_id = auth.uid()
    ))
  );

-- clients: idem.
drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients
  for select using (
    public.is_admin()
    or (public.is_active_seller() and seller_id = auth.uid())
    or (public.is_active_gestor() and gestor_id = auth.uid())
  );

-- payments: gestor vê os pagamentos dos clientes do time.
drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.clients c
      where c.id = payments.client_id
        and (
          (public.is_active_seller() and c.seller_id = auth.uid())
          or (public.is_active_gestor() and c.gestor_id = auth.uid())
        )
    )
  );

-- commission_entries: beneficiário (seller OU gestor) vê as suas.
-- A coluna seller_id guarda o beneficiário; para override é o gestor.
drop policy if exists entries_select on public.commission_entries;
create policy entries_select on public.commission_entries
  for select using (
    public.is_admin()
    or ((public.is_active_seller() or public.is_active_gestor()) and seller_id = auth.uid())
  );

-- withdrawals: gestor saca igual seller (beneficiário = seller_id).
drop policy if exists withdrawals_select on public.withdrawals;
create policy withdrawals_select on public.withdrawals
  for select using (
    public.is_admin()
    or ((public.is_active_seller() or public.is_active_gestor()) and seller_id = auth.uid())
  );

-- settings: gestor também lê (precisa do teto/demo_url).
drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings
  for select using (
    public.is_admin() or public.is_active_seller() or public.is_active_gestor()
  );

-- 11) Saque e saldo para gestor --------------------------------
-- request_withdrawal e seller_balance passam a aceitar gestor ativo
-- (o campo seller_id nas tabelas representa o beneficiário).
create or replace function public.request_withdrawal(
  p_valor_cents integer,
  p_pix_key text,
  p_pix_name text
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_seller_id uuid := auth.uid();
  v_minimo integer;
  v_saldo bigint;
  v_withdrawal_id uuid;
  v_restante integer;
  r record;
begin
  if not (public.is_active_seller() or public.is_active_gestor()) then
    raise exception 'Apenas parceiros ativos podem solicitar saque';
  end if;
  if nullif(trim(coalesce(p_pix_key, '')), '') is null then
    raise exception 'Informe a chave PIX';
  end if;
  if nullif(trim(coalesce(p_pix_name, '')), '') is null then
    raise exception 'Informe o nome completo do titular da chave';
  end if;

  select coalesce(nullif(value, '')::integer, 5000) into v_minimo
  from public.settings where key = 'saque_minimo_cents';
  v_minimo := coalesce(v_minimo, 5000);

  if coalesce(p_valor_cents, 0) < v_minimo then
    raise exception 'O saque mínimo é de R$ %', to_char(v_minimo / 100.0, 'FM999G999G990D00');
  end if;

  perform 1 from public.commission_entries
  where seller_id = v_seller_id and status = 'disponivel' and withdrawal_id is null
  for update;

  select coalesce(sum(valor_cents), 0) into v_saldo
  from public.commission_entries
  where seller_id = v_seller_id and status = 'disponivel' and withdrawal_id is null;

  if p_valor_cents > v_saldo then
    raise exception 'Valor solicitado maior que o saldo disponível';
  end if;

  update public.profiles
  set pix_key = p_pix_key, pix_name = p_pix_name
  where id = v_seller_id;

  insert into public.withdrawals (seller_id, valor_cents, pix_key, pix_name, status)
  values (v_seller_id, p_valor_cents, p_pix_key, p_pix_name, 'solicitado')
  returning id into v_withdrawal_id;

  v_restante := p_valor_cents;
  for r in
    select id, valor_cents from public.commission_entries
    where seller_id = v_seller_id and status = 'disponivel' and withdrawal_id is null
    order by created_at, id
  loop
    exit when v_restante <= 0;
    if r.valor_cents <= v_restante then
      update public.commission_entries set withdrawal_id = v_withdrawal_id where id = r.id;
      v_restante := v_restante - r.valor_cents;
    else
      update public.commission_entries
      set valor_cents = v_restante, withdrawal_id = v_withdrawal_id
      where id = r.id;
      insert into public.commission_entries
        (seller_id, client_id, payment_id, tipo, competencia, valor_cents, origem, status, created_at)
      select seller_id, client_id, payment_id, tipo, competencia,
             r.valor_cents - v_restante, origem, 'disponivel', created_at
      from public.commission_entries where id = r.id;
      v_restante := 0;
    end if;
  end loop;

  return v_withdrawal_id;
end;
$$;

create or replace function public.seller_balance(p_seller_id uuid default null)
returns bigint
language sql stable security definer
set search_path = public
as $$
  select coalesce(sum(valor_cents), 0)
  from public.commission_entries
  where seller_id = coalesce(p_seller_id, auth.uid())
    and status = 'disponivel'
    and withdrawal_id is null
    and (public.is_admin() or seller_id = auth.uid());
$$;

grant execute on function
  public.request_withdrawal(integer, text, text),
  public.seller_balance(uuid)
to authenticated, service_role;

-- 12) Vínculo do seller ao time no cadastro --------------------
-- Resolve o team_code informado no signup e grava gestor_id.
-- Chamada pela server action após o signUp. SECURITY DEFINER para
-- poder escrever gestor_id (protegido pelo trigger de colunas).
create or replace function public.join_team(p_team_code text)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  v_gestor_id uuid;
begin
  if nullif(trim(coalesce(p_team_code, '')), '') is null then
    return false;
  end if;

  select id into v_gestor_id
  from public.profiles
  where lower(team_code) = lower(trim(p_team_code))
    and role = 'gestor' and status = 'ativo';

  if v_gestor_id is null then
    raise exception 'Código de time inválido';
  end if;

  update public.profiles
  set gestor_id = v_gestor_id
  where id = auth.uid();

  return true;
end;
$$;

revoke execute on function public.join_team(text) from public, anon;
grant execute on function public.join_team(text) to authenticated, service_role;
