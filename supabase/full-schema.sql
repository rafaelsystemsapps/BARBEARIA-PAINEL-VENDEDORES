-- =============================================================
-- Painel de Parceiros — Schema COMPLETO (gerado das migrations)
-- Cole tudo no Supabase: Dashboard > SQL Editor > New query > Run.
-- Equivalente a rodar as 3 migrations de supabase/migrations/ em ordem.
-- =============================================================

-- >>> supabase/migrations/20260704100001_schema.sql <<<

-- =============================================================
-- Painel de Vendedores — Schema
-- Todos os valores monetários em centavos (integer). Sem floats.
-- =============================================================

-- Enums -------------------------------------------------------
create type public.user_role as enum ('admin', 'seller');
create type public.profile_status as enum ('pendente', 'ativo', 'pausado');
create type public.lead_status as enum ('novo', 'em_negociacao', 'fechado', 'perdido');
create type public.client_status as enum ('aguardando_setup', 'ativo', 'inadimplente', 'cancelado');
create type public.payment_tipo as enum ('setup', 'mensalidade');
create type public.payment_status as enum ('aguardando', 'confirmado', 'cancelado');
create type public.entry_status as enum ('disponivel', 'sacada', 'estornada');
create type public.withdrawal_status as enum ('solicitado', 'pago', 'recusado');

-- profiles ----------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'seller',
  nome text not null default '',
  email text not null default '',
  whatsapp text,
  pix_key text,
  pix_name text,
  ref_code text unique,
  status public.profile_status not null default 'pendente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- leads -------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  nome_contato text not null,
  barbearia text not null,
  whatsapp text,
  cidade text,
  status public.lead_status not null default 'novo',
  motivo_perda text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_perdido_exige_motivo
    check (status <> 'perdido' or motivo_perda is not null)
);

create index leads_seller_idx on public.leads (seller_id);
create index leads_status_idx on public.leads (status);

-- clients -----------------------------------------------------
-- Percentuais de comissão são congelados no fechamento da venda
-- (pct_recorrente: 30 sem setup / 40 com setup; pct_setup: 20 ou 30
-- conforme faixa do valor do setup). Nunca recalcular depois.
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references public.leads (id),
  seller_id uuid not null references public.profiles (id),
  barbearia text not null,
  cidade text,
  mensalidade_cents integer not null check (mensalidade_cents > 0),
  dia_vencimento integer not null check (dia_vencimento between 1 and 28),
  tem_setup boolean not null default false,
  setup_cents integer,
  pct_recorrente integer not null check (pct_recorrente in (30, 40)),
  pct_setup integer check (pct_setup in (20, 30)),
  status public.client_status not null,
  closed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_setup_coerente check (
    (tem_setup and setup_cents between 50000 and 200000 and pct_setup is not null)
    or (not tem_setup and setup_cents is null and pct_setup is null)
  )
);

create index clients_seller_idx on public.clients (seller_id);
create index clients_status_idx on public.clients (status);

-- payments ----------------------------------------------------
-- competencia = dia 1 do mês de referência; vencimento materializa
-- competencia + dia_vencimento para simplificar alertas de atraso.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  tipo public.payment_tipo not null,
  competencia date not null,
  vencimento date not null,
  valor_esperado_cents integer not null check (valor_esperado_cents > 0),
  valor_pago_cents integer check (valor_pago_cents > 0),
  status public.payment_status not null default 'aguardando',
  confirmed_at timestamptz,
  confirmed_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- Idempotência da geração mensal: 1 mensalidade por cliente/competência
create unique index payments_mensalidade_unica
  on public.payments (client_id, competencia) where (tipo = 'mensalidade');
-- Setup é cobrado uma única vez por cliente
create unique index payments_setup_unico
  on public.payments (client_id) where (tipo = 'setup');
create index payments_status_venc_idx on public.payments (status, vencimento);

-- withdrawals -------------------------------------------------
create table public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id),
  valor_cents integer not null check (valor_cents > 0),
  pix_key text not null,
  pix_name text not null,
  status public.withdrawal_status not null default 'solicitado',
  motivo_recusa text,
  requested_at timestamptz not null default now(),
  paid_at timestamptz,
  constraint withdrawals_recusa_exige_motivo
    check (status <> 'recusado' or motivo_recusa is not null)
);

create index withdrawals_seller_idx on public.withdrawals (seller_id);
create index withdrawals_status_idx on public.withdrawals (status);

-- commission_entries ------------------------------------------
-- Saldo disponível do vendedor = soma de entries com status
-- 'disponivel' e withdrawal_id nulo. Ao solicitar saque as entries
-- são reservadas (withdrawal_id preenchido) em ordem FIFO; a última
-- pode ser dividida em duas para fechar o valor exato.
create table public.commission_entries (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id),
  client_id uuid not null references public.clients (id),
  payment_id uuid references public.payments (id),
  tipo public.payment_tipo not null,
  competencia date not null,
  valor_cents integer not null check (valor_cents > 0),
  status public.entry_status not null default 'disponivel',
  withdrawal_id uuid references public.withdrawals (id),
  created_at timestamptz not null default now()
);

create index entries_seller_idx on public.commission_entries (seller_id);
create index entries_saldo_idx on public.commission_entries (seller_id, status)
  where (withdrawal_id is null);
create index entries_withdrawal_idx on public.commission_entries (withdrawal_id);

-- settings ----------------------------------------------------
create table public.settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.settings (key, value) values
  ('demo_url', ''),
  ('saque_minimo_cents', '5000'),
  ('dias_alerta_inadimplencia', '7'),
  ('admin_pix_key', '');

-- updated_at automático ---------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger leads_set_updated_at before update on public.leads
  for each row execute function public.set_updated_at();
create trigger clients_set_updated_at before update on public.clients
  for each row execute function public.set_updated_at();
create trigger settings_set_updated_at before update on public.settings
  for each row execute function public.set_updated_at();


-- >>> supabase/migrations/20260704100002_rls.sql <<<

-- =============================================================
-- Painel de Vendedores — RLS
-- seller: enxerga apenas as próprias linhas, e somente se estiver
-- com perfil ativo. admin: acesso total. payments/commission_entries
-- são somente leitura para o vendedor (escrita só via funções
-- SECURITY DEFINER do fluxo do admin).
-- =============================================================

-- Helpers (SECURITY DEFINER para não recursionar nas policies) --
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'ativo'
  );
$$;

create or replace function public.is_active_seller()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'seller' and status = 'ativo'
  );
$$;

-- Requisições com a chave service_role (seed/cron). Triggers não são
-- ignorados pelo service_role, então precisam desta checagem.
create or replace function public.is_service_role()
returns boolean
language sql stable
as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role';
$$;

revoke execute on function public.is_admin(), public.is_active_seller(), public.is_service_role() from public, anon;
grant execute on function public.is_admin(), public.is_active_seller(), public.is_service_role() to authenticated, service_role;

-- profiles ----------------------------------------------------
alter table public.profiles enable row level security;

create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy profiles_update on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Vendedor edita nome/whatsapp/pix, mas nunca role/status/ref_code
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if not (public.is_admin() or public.is_service_role()) then
    if new.role is distinct from old.role
      or new.status is distinct from old.status
      or new.ref_code is distinct from old.ref_code then
      raise exception 'Somente o administrador pode alterar papel, status ou código de vendedor';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_columns before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- leads -------------------------------------------------------
alter table public.leads enable row level security;

create policy leads_select on public.leads
  for select using (
    public.is_admin()
    or (public.is_active_seller() and seller_id = auth.uid())
  );

create policy leads_insert on public.leads
  for insert with check (
    public.is_admin()
    or (
      public.is_active_seller()
      and seller_id = auth.uid()
      and status in ('novo', 'em_negociacao')
    )
  );

-- Vendedor movimenta o lead até perdido; 'fechado' só via close_lead()
create policy leads_update on public.leads
  for update using (
    public.is_admin()
    or (public.is_active_seller() and seller_id = auth.uid() and status <> 'fechado')
  )
  with check (
    public.is_admin()
    or (seller_id = auth.uid() and status <> 'fechado')
  );

-- clients -----------------------------------------------------
alter table public.clients enable row level security;

create policy clients_select on public.clients
  for select using (
    public.is_admin()
    or (public.is_active_seller() and seller_id = auth.uid())
  );

create policy clients_admin_write on public.clients
  for insert with check (public.is_admin());

create policy clients_admin_update on public.clients
  for update using (public.is_admin()) with check (public.is_admin());

-- payments (somente leitura para o vendedor) ------------------
alter table public.payments enable row level security;

create policy payments_select on public.payments
  for select using (
    public.is_admin()
    or (
      public.is_active_seller()
      and exists (
        select 1 from public.clients c
        where c.id = client_id and c.seller_id = auth.uid()
      )
    )
  );

create policy payments_admin_insert on public.payments
  for insert with check (public.is_admin());

create policy payments_admin_update on public.payments
  for update using (public.is_admin()) with check (public.is_admin());

-- commission_entries (somente leitura para o vendedor) --------
alter table public.commission_entries enable row level security;

create policy entries_select on public.commission_entries
  for select using (
    public.is_admin()
    or (public.is_active_seller() and seller_id = auth.uid())
  );

create policy entries_admin_insert on public.commission_entries
  for insert with check (public.is_admin());

create policy entries_admin_update on public.commission_entries
  for update using (public.is_admin()) with check (public.is_admin());

-- withdrawals (INSERT do vendedor só via request_withdrawal) --
alter table public.withdrawals enable row level security;

create policy withdrawals_select on public.withdrawals
  for select using (
    public.is_admin()
    or (public.is_active_seller() and seller_id = auth.uid())
  );

create policy withdrawals_admin_insert on public.withdrawals
  for insert with check (public.is_admin());

create policy withdrawals_admin_update on public.withdrawals
  for update using (public.is_admin()) with check (public.is_admin());

-- settings ----------------------------------------------------
alter table public.settings enable row level security;

create policy settings_select on public.settings
  for select using (public.is_admin() or public.is_active_seller());

create policy settings_admin_write on public.settings
  for all using (public.is_admin()) with check (public.is_admin());


-- >>> supabase/migrations/20260704100003_functions.sql <<<

-- =============================================================
-- Painel de Vendedores — Funções de negócio (SECURITY DEFINER)
-- Regras financeiras vivem aqui. confirm_payment() é o ÚNICO
-- caminho que gera comissão — quando houver gateway (fase 2),
-- o webhook apenas passará a chamar esta mesma função.
-- =============================================================

-- Cria o profile no signup (role seller, status pendente) ------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, nome, email, whatsapp, status)
  values (
    new.id,
    'seller',
    coalesce(new.raw_user_meta_data ->> 'nome', ''),
    coalesce(new.email, ''),
    new.raw_user_meta_data ->> 'whatsapp',
    'pendente'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Fechamento de venda -----------------------------------------
-- Congela os percentuais: sem setup -> 30% recorrente; com setup
-- -> 40% recorrente + pct do setup por faixa (ate R$800,00 -> 20%;
-- de R$800,01 a R$2.000,00 -> 30%). Cliente sem setup nasce ativo;
-- com setup nasce aguardando_setup e a cobrança do setup é criada.
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
  v_client_id uuid;
  v_pct_recorrente integer;
  v_pct_setup integer;
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

  update public.leads set status = 'fechado' where id = p_lead_id;

  insert into public.clients (
    lead_id, seller_id, barbearia, cidade, mensalidade_cents, dia_vencimento,
    tem_setup, setup_cents, pct_recorrente, pct_setup, status, closed_at
  ) values (
    p_lead_id,
    v_lead.seller_id,
    coalesce(nullif(trim(p_barbearia), ''), v_lead.barbearia),
    coalesce(nullif(trim(p_cidade), ''), v_lead.cidade),
    p_mensalidade_cents,
    p_dia_vencimento,
    p_tem_setup,
    p_setup_cents,
    v_pct_recorrente,
    v_pct_setup,
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

-- Confirmação de pagamento (FLUXO ÚNICO de geração de comissão) --
-- Admin confirma que o PIX caiu; nasce a commission_entry com
-- valor_pago × percentual congelado no cliente. Se for setup de um
-- cliente aguardando_setup, o cliente é ativado.
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

  v_pct := case when v_payment.tipo = 'setup' then v_client.pct_setup else v_client.pct_recorrente end;

  insert into public.commission_entries (seller_id, client_id, payment_id, tipo, competencia, valor_cents, status)
  values (
    v_client.seller_id,
    v_client.id,
    v_payment.id,
    v_payment.tipo,
    v_payment.competencia,
    round(v_valor_pago * v_pct / 100.0)::integer,
    'disponivel'
  ) returning id into v_entry_id;

  if v_payment.tipo = 'setup' and v_client.status = 'aguardando_setup' then
    update public.clients set status = 'ativo' where id = v_client.id;
  end if;

  return v_entry_id;
end;
$$;

-- Geração mensal de cobranças (idempotente) --------------------
-- Para cada cliente ativo sem mensalidade da competência corrente,
-- cria a cobrança aguardando. Rodar 2x no mesmo dia não duplica
-- (índice único parcial client_id+competencia).
create or replace function public.generate_monthly_charges()
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not (public.is_admin() or public.is_service_role()) then
    raise exception 'Sem permissão para gerar cobranças';
  end if;

  with inserted as (
    insert into public.payments (client_id, tipo, competencia, vencimento, valor_esperado_cents, status)
    select
      c.id,
      'mensalidade',
      date_trunc('month', current_date)::date,
      date_trunc('month', current_date)::date + (c.dia_vencimento - 1),
      c.mensalidade_cents,
      'aguardando'
    from public.clients c
    where c.status = 'ativo'
    on conflict (client_id, competencia) where (tipo = 'mensalidade') do nothing
    returning 1
  )
  select count(*) into v_count from inserted;

  return v_count;
end;
$$;

-- Solicitação de saque -----------------------------------------
-- Valida mínimo e saldo, persiste PIX no perfil e reserva entries
-- FIFO (divide a última se o valor não fechar exato).
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
  if not public.is_active_seller() then
    raise exception 'Apenas vendedores ativos podem solicitar saque';
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

  -- Trava as entries disponíveis do vendedor (evita corrida entre 2 saques)
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
      -- divide: parte consumida pelo saque + parte que continua disponível
      update public.commission_entries
      set valor_cents = v_restante, withdrawal_id = v_withdrawal_id
      where id = r.id;
      insert into public.commission_entries
        (seller_id, client_id, payment_id, tipo, competencia, valor_cents, status, created_at)
      select seller_id, client_id, payment_id, tipo, competencia,
             r.valor_cents - v_restante, 'disponivel', created_at
      from public.commission_entries where id = r.id;
      v_restante := 0;
    end if;
  end loop;

  return v_withdrawal_id;
end;
$$;

-- Admin marca saque como pago ----------------------------------
create or replace function public.pay_withdrawal(p_withdrawal_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_withdrawal public.withdrawals%rowtype;
begin
  if not (public.is_admin() or public.is_service_role()) then
    raise exception 'Apenas o administrador pode pagar saques';
  end if;

  select * into v_withdrawal from public.withdrawals where id = p_withdrawal_id for update;
  if not found then
    raise exception 'Saque não encontrado';
  end if;
  if v_withdrawal.status <> 'solicitado' then
    raise exception 'Saque já processado (status: %)', v_withdrawal.status;
  end if;

  update public.withdrawals set status = 'pago', paid_at = now() where id = p_withdrawal_id;
  update public.commission_entries set status = 'sacada' where withdrawal_id = p_withdrawal_id;
end;
$$;

-- Admin recusa saque (entries voltam ao saldo) ------------------
create or replace function public.refuse_withdrawal(p_withdrawal_id uuid, p_motivo text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_withdrawal public.withdrawals%rowtype;
begin
  if not (public.is_admin() or public.is_service_role()) then
    raise exception 'Apenas o administrador pode recusar saques';
  end if;
  if nullif(trim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Informe o motivo da recusa';
  end if;

  select * into v_withdrawal from public.withdrawals where id = p_withdrawal_id for update;
  if not found then
    raise exception 'Saque não encontrado';
  end if;
  if v_withdrawal.status <> 'solicitado' then
    raise exception 'Saque já processado (status: %)', v_withdrawal.status;
  end if;

  update public.withdrawals
  set status = 'recusado', motivo_recusa = p_motivo
  where id = p_withdrawal_id;

  update public.commission_entries
  set withdrawal_id = null
  where withdrawal_id = p_withdrawal_id and status = 'disponivel';
end;
$$;

-- Saldo disponível ---------------------------------------------
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

-- Grants --------------------------------------------------------
revoke execute on function
  public.close_lead(uuid, text, text, integer, integer, boolean, integer),
  public.confirm_payment(uuid, integer),
  public.generate_monthly_charges(),
  public.request_withdrawal(integer, text, text),
  public.pay_withdrawal(uuid),
  public.refuse_withdrawal(uuid, text),
  public.seller_balance(uuid)
from public, anon;

grant execute on function
  public.close_lead(uuid, text, text, integer, integer, boolean, integer),
  public.confirm_payment(uuid, integer),
  public.generate_monthly_charges(),
  public.request_withdrawal(integer, text, text),
  public.pay_withdrawal(uuid),
  public.refuse_withdrawal(uuid, text),
  public.seller_balance(uuid)
to authenticated, service_role;

