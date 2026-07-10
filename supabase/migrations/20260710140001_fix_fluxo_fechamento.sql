-- =============================================================
-- Patch de correção — Fluxo de fechamento, cobrança e valores
-- =============================================================
-- Corrige 4 problemas relatados:
--
-- 1) Fechar venda gerava comissão sem o admin confirmar o pagamento.
--    Causa: venda sem setup nascia 'ativo' e a 1a mensalidade só
--    vinha pelo cron. Agora fechar SEMPRE cria a cobrança pendente
--    (setup, se houver, + 1a mensalidade) e NENHUMA comissão nasce
--    até o admin confirmar o pagamento.
--
-- 2) Novo status 'aguardando_pagamento': cliente fechado fica
--    pendente até o 1o pagamento ser confirmado. Só então vira
--    'ativo' e entra no MRR / geração mensal.
--
-- 3) Dia de vencimento agora aceita 1..31 e é ajustado para o
--    último dia do mês em meses mais curtos (fevereiro etc.).
--
-- 4) Override do gestor não aparecia no painel do gestor nem do
--    admin: a comissão nascia certa, mas a leitura tinha bug de
--    competência. A parte de leitura é corrigida no código (React);
--    aqui garantimos os dados corretos.
-- =============================================================

-- 1) Novo status de cliente -----------------------------------
alter type public.client_status add value if not exists 'aguardando_pagamento';

-- 2) Helper: último dia de vencimento válido para uma competência
-- Recebe o dia desejado (1..31) e a data-base do mês; devolve uma
-- data real (se pedir 31 em fevereiro, retorna 28/29).
create or replace function public.vencimento_do_mes(
  p_competencia date,
  p_dia integer
)
returns date
language sql immutable
set search_path = public
as $$
  select least(
    p_competencia + (greatest(p_dia, 1) - 1),
    (date_trunc('month', p_competencia) + interval '1 month - 1 day')::date
  );
$$;

-- 3) close_lead(): aceita dia 1..31, cria cobranças pendentes,
-- não gera comissão, e cliente fica aguardando confirmação -----
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
  v_comp date := date_trunc('month', current_date)::date;
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
  -- Agora aceita 1..31 (o dia é ajustado por mês na cobrança).
  if p_dia_vencimento is null or p_dia_vencimento not between 1 and 31 then
    raise exception 'Dia de vencimento deve estar entre 1 e 31';
  end if;

  -- Snapshot do gestor (se o seller estiver num time ativo).
  select * into v_seller from public.profiles where id = v_lead.seller_id;
  v_gestor_id := v_seller.gestor_id;
  if v_gestor_id is not null then
    select * into v_gestor from public.profiles where id = v_gestor_id;
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
  else
    if p_setup_cents is not null then
      raise exception 'Setup informado para venda sem setup';
    end if;
    v_pct_recorrente := 30;
    v_pct_setup := null;
  end if;

  -- Bonificação do time (gestor cede pontos do próprio override).
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

  -- Cliente SEMPRE nasce aguardando confirmação de pagamento.
  -- Nunca 'ativo' direto: nada de comissão antes de o admin confirmar.
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
    'aguardando_pagamento',
    now()
  ) returning id into v_client_id;

  -- Cobrança do setup (se houver), pendente de confirmação.
  if p_tem_setup then
    insert into public.payments (client_id, tipo, competencia, vencimento, valor_esperado_cents, status)
    values (v_client_id, 'setup', v_comp, current_date, p_setup_cents, 'aguardando');
  end if;

  -- Cobrança da 1a mensalidade, pendente de confirmação.
  -- (Não depende mais do cron — nasce no fechamento.)
  insert into public.payments (client_id, tipo, competencia, vencimento, valor_esperado_cents, status)
  values (
    v_client_id,
    'mensalidade',
    v_comp,
    public.vencimento_do_mes(v_comp, p_dia_vencimento),
    p_mensalidade_cents,
    'aguardando'
  )
  on conflict (client_id, competencia) where (tipo = 'mensalidade') do nothing;

  return v_client_id;
end;
$$;

-- 4) confirm_payment(): ao confirmar a 1a mensalidade, ativa o
-- cliente. Gera comissão do seller e do gestor (já existia). -----
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

  -- Comissão do seller (floor para não estourar centavos).
  v_pct := case when v_payment.tipo = 'setup' then v_client.pct_setup else v_client.pct_recorrente end;

  insert into public.commission_entries
    (seller_id, client_id, payment_id, tipo, competencia, valor_cents, origem, status)
  values (
    v_client.seller_id, v_client.id, v_payment.id, v_payment.tipo, v_payment.competencia,
    floor(v_valor_pago * coalesce(v_pct, 0) / 100.0)::integer, 'venda_propria', 'disponivel'
  ) returning id into v_entry_id;

  -- Comissão do gestor (override), mesma transação.
  if v_client.gestor_id is not null then
    v_pct_gestor := case
      when v_payment.tipo = 'setup' then coalesce(v_client.pct_gestor_setup, 0)
      else coalesce(v_client.pct_gestor_recorrente, 0)
    end;
    if v_pct_gestor > 0 then
      insert into public.commission_entries
        (seller_id, client_id, payment_id, tipo, competencia, valor_cents, origem, status)
      values (
        v_client.gestor_id, v_client.id, v_payment.id, v_payment.tipo, v_payment.competencia,
        floor(v_valor_pago * v_pct_gestor / 100.0)::integer, 'override_time', 'disponivel'
      );
    end if;
  end if;

  -- Ativa o cliente no 1o pagamento confirmado (mensalidade ou,
  -- se não houver mensalidade ainda, ao confirmar o setup).
  if v_client.status in ('aguardando_pagamento', 'aguardando_setup') then
    update public.clients set status = 'ativo' where id = v_client.id;
  end if;

  return v_entry_id;
end;
$$;

-- 5) generate_monthly_charges(): usa o vencimento ajustado por mês
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
      public.vencimento_do_mes(date_trunc('month', current_date)::date, c.dia_vencimento),
      c.mensalidade_cents,
      'aguardando'
    from public.clients c
    where c.status in ('ativo', 'inadimplente')
    on conflict (client_id, competencia) where (tipo = 'mensalidade') do nothing
    returning 1
  )
  select count(*) into v_count from inserted;

  return v_count;
end;
$$;

grant execute on function
  public.close_lead(uuid, text, text, integer, integer, boolean, integer),
  public.confirm_payment(uuid, integer),
  public.generate_monthly_charges(),
  public.vencimento_do_mes(date, integer)
to authenticated, service_role;
