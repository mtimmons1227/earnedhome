-- Move tenant-membership helpers into a non-exposed `private` schema so they
-- cannot be invoked via the PostgREST /rpc endpoint, while RLS policies still
-- use them. Clears security advisor lints 0028/0029. Applied to azfesppisxniclnntrmc.

create schema if not exists private;
grant usage on schema private to anon, authenticated;

create or replace function private.current_tenant_id()
returns uuid language sql stable security definer set search_path = public as $$
  select tenant_id from public.app_users where id = auth.uid() $$;
create or replace function private.is_tenant_member(tid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_users where id = auth.uid() and tenant_id = tid) $$;
create or replace function private.tenant_is_active(tid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tenants where id = tid and status = 'active') $$;
revoke all on function private.current_tenant_id() from public;
revoke all on function private.is_tenant_member(uuid) from public;
revoke all on function private.tenant_is_active(uuid) from public;
grant execute on function private.current_tenant_id() to anon, authenticated;
grant execute on function private.is_tenant_member(uuid) to anon, authenticated;
grant execute on function private.tenant_is_active(uuid) to anon, authenticated;

drop policy tenants_admin_update on public.tenants;
drop policy communities_read on public.communities;
drop policy communities_member_write on public.communities;
drop policy app_users_self_read on public.app_users;
drop policy quotes_public_insert on public.quotes;
drop policy quotes_member_read on public.quotes;
drop policy leads_public_insert on public.leads;
drop policy leads_member_read on public.leads;
drop policy leads_member_update on public.leads;
drop policy events_public_insert on public.events;
drop policy events_member_read on public.events;

drop function public.current_tenant_id();
drop function public.is_tenant_member(uuid);
drop function public.tenant_is_active(uuid);

create policy tenants_admin_update on public.tenants
  for update to authenticated using (private.is_tenant_member(id)) with check (private.is_tenant_member(id));
create policy communities_read on public.communities
  for select to anon, authenticated using (private.tenant_is_active(tenant_id));
create policy communities_member_write on public.communities
  for all to authenticated using (private.is_tenant_member(tenant_id)) with check (private.is_tenant_member(tenant_id));
create policy app_users_self_read on public.app_users
  for select to authenticated using (id = auth.uid() or tenant_id = private.current_tenant_id());
create policy quotes_public_insert on public.quotes
  for insert to anon, authenticated with check (private.tenant_is_active(tenant_id));
create policy quotes_member_read on public.quotes
  for select to authenticated using (private.is_tenant_member(tenant_id));
create policy leads_public_insert on public.leads
  for insert to anon, authenticated with check (private.tenant_is_active(tenant_id) and consent_tcpa = true);
create policy leads_member_read on public.leads
  for select to authenticated using (private.is_tenant_member(tenant_id));
create policy leads_member_update on public.leads
  for update to authenticated using (private.is_tenant_member(tenant_id)) with check (private.is_tenant_member(tenant_id));
create policy events_public_insert on public.events
  for insert to anon, authenticated with check (private.tenant_is_active(tenant_id));
create policy events_member_read on public.events
  for select to authenticated using (private.is_tenant_member(tenant_id));
