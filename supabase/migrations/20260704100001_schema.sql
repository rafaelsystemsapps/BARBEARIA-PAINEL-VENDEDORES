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
