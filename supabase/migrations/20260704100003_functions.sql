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
