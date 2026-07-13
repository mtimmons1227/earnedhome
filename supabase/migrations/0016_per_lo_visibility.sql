-- EarnedHome Phase II ("rel") — Per-LO visibility (role-aware RLS)
-- Broker admins see ALL of their tenant's leads/agents; loan officers see only
-- their OWN (leads assigned to them, agents they own). Backward-compatible: today
-- everyone with access is an admin, so nothing changes for R Parry / Richard — the
-- LO-scoped branch only activates once role='lo' users sign in.
-- Safe on the shared DB (no data change; admins keep full visibility).
-- NOTE: security helpers live in the `private` schema (see migration 0002).

-- Helper: is the current signed-in user a broker admin?
create or replace function private.current_role_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_users where id = auth.uid() and role = 'admin')
$$;

-- Leads: read — admin sees all in tenant; LO sees only their assigned leads.
drop policy if exists leads_member_read on public.leads;
create policy leads_member_read on public.leads
  for select to authenticated
  using (
    private.is_tenant_member(tenant_id)
    and (private.current_role_is_admin() or assigned_lo_id = auth.uid())
  );

-- Leads: update — same scoping (an LO can only work their own leads).
drop policy if exists leads_member_update on public.leads;
create policy leads_member_update on public.leads
  for update to authenticated
  using (
    private.is_tenant_member(tenant_id)
    and (private.current_role_is_admin() or assigned_lo_id = auth.uid())
  )
  with check (
    private.is_tenant_member(tenant_id)
    and (private.current_role_is_admin() or assigned_lo_id = auth.uid())
  );

-- Agents: read — admin sees all; LO sees only the agents they own.
drop policy if exists agents_member_read on public.agents;
create policy agents_member_read on public.agents
  for select to authenticated
  using (
    private.is_tenant_member(tenant_id)
    and (private.current_role_is_admin() or lo_id = auth.uid())
  );
