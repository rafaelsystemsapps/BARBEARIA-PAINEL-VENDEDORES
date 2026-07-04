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
