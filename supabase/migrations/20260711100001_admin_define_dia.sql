-- =============================================================
-- Patch 1 — Admin define o dia da mensalidade na confirmação
-- =============================================================
-- Muda quem decide o dia de vencimento: agora é o ADMIN, no momento
-- de confirmar a 1a mensalidade — não o seller no fechamento.
--
-- Fluxo novo:
--   1. Seller fecha informando só mensalidade + setup (opcional).
--      Nenhum dia é pedido.
--   2. Nasce a cobrança da mensalidade (e do setup, se houver) com
--      status 'aguardando' e vencimento provisório (hoje).
--   3. Admin confirma a mensalidade e ESCOLHE O DIA. Esse dia é
--      gravado no cliente e vira o dia fixo dos próximos meses.
--   4. Setup e mensalidade são confirmados separadamente.
-- =============================================================

-- 1) dia_vencimento passa a ser opcional (definido na confirmação)
-- e aceita 1..31 (ajustado por mês na hora de gerar a cobrança).
alter table public.clients
  alter column dia_vencimento drop not null;

alter table public.clients
  drop constraint if exists clients_dia_vencimento_check;

alter table public.clients
  add constraint clients_dia_vencimento_check
  check (dia_vencimento is null or dia_vencimento between 1 and 31);

-- 2) close_lead(): sem dia de vencimento. Cria cobranças pendentes.
create or replace function public.close_lead(
  p_lead_id uuid,
  p_barbearia text,
  p_cidade text,
  p_mensalidade_cents integer,
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

  -- Cliente nasce aguardando pagamento, SEM dia definido ainda.
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
    null,  -- dia definido pelo admin ao confirmar a mensalidade
    p_tem_setup,
    p_setup_cents,
    v_pct_recorrente,
    v_pct_setup,
    v_pct_gestor_rec,
    v_pct_gestor_setup,
    'aguardando_pagamento',
    now()
  ) returning id into v_client_id;

  -- Cobrança do setup (se houver), pendente.
  if p_tem_setup then
    insert into public.payments (client_id, tipo, competencia, vencimento, valor_esperado_cents, status)
    values (v_client_id, 'setup', v_comp, current_date, p_setup_cents, 'aguardando');
  end if;

  -- Cobrança da 1a mensalidade, pendente. Vencimento provisório
  -- (hoje); o dia real é definido pelo admin na confirmação.
  insert into public.payments (client_id, tipo, competencia, vencimento, valor_esperado_cents, status)
  values (v_client_id, 'mensalidade', v_comp, current_date, p_mensalidade_cents, 'aguardando')
  on conflict (client_id, competencia) where (tipo = 'mensalidade') do nothing;

  return v_client_id;
end;
$$;

-- 3) confirm_payment(): admin escolhe o dia ao confirmar mensalidade
-- p_dia_vencimento é obrigatório para mensalidade (define o dia
-- fixo do cliente); ignorado para setup.
create or replace function public.confirm_payment(
  p_payment_id uuid,
  p_valor_pago_cents integer default null,
  p_dia_vencimento integer default null
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
  v_dia integer;
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

  -- Ao confirmar a mensalidade, o admin define o dia de vencimento.
  if v_payment.tipo = 'mensalidade' then
    v_dia := coalesce(p_dia_vencimento, v_client.dia_vencimento);
    if v_dia is null or v_dia not between 1 and 31 then
      raise exception 'Informe o dia de vencimento (1 a 31) ao confirmar a mensalidade';
    end if;
    -- Grava o dia no cliente (vira o dia fixo dos próximos meses) e
    -- ajusta o vencimento desta competência para o dia escolhido.
    update public.clients set dia_vencimento = v_dia where id = v_client.id;
    update public.payments
    set vencimento = public.vencimento_do_mes(v_payment.competencia, v_dia)
    where id = v_payment.id;
  end if;

  update public.payments
  set status = 'confirmado',
      valor_pago_cents = v_valor_pago,
      confirmed_at = now(),
      confirmed_by = auth.uid()
  where id = p_payment_id;

  v_pct := case when v_payment.tipo = 'setup' then v_client.pct_setup else v_client.pct_recorrente end;

  insert into public.commission_entries
    (seller_id, client_id, payment_id, tipo, competencia, valor_cents, origem, status)
  values (
    v_client.seller_id, v_client.id, v_payment.id, v_payment.tipo, v_payment.competencia,
    floor(v_valor_pago * coalesce(v_pct, 0) / 100.0)::integer, 'venda_propria', 'disponivel'
  ) returning id into v_entry_id;

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

  -- Ativa o cliente ao confirmar o 1o pagamento.
  if v_client.status in ('aguardando_pagamento', 'aguardando_setup') then
    update public.clients set status = 'ativo' where id = v_client.id;
  end if;

  return v_entry_id;
end;
$$;

-- Remove a versão antiga de 2 args para evitar ambiguidade de overload.
drop function if exists public.confirm_payment(uuid, integer);

grant execute on function
  public.close_lead(uuid, text, text, integer, boolean, integer),
  public.confirm_payment(uuid, integer, integer)
to authenticated, service_role;

-- Remove a assinatura antiga de close_lead (com dia_vencimento).
drop function if exists public.close_lead(uuid, text, text, integer, integer, boolean, integer);
