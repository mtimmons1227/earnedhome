-- Agents: let signed-in staff READ agents in their own tenant.
--
-- 0008 enabled RLS on agents but added no policy, so only the service-role
-- client (admin API) could see them. That's fine for the /agents admin page and
-- the public /a/<slug> link (both go through service role), but the dashboard
-- leads table reads as the signed-in user and embeds agents ( name ) — with no
-- SELECT policy, RLS hid every agent row and the Agent column showed "—" even
-- though leads.agent_id was set correctly.
--
-- This adds the same tenant-scoped read policy the other business tables use
-- (private.is_tenant_member). Writes stay service-role only (agents are still
-- created/updated exclusively through the admin API), so this only grants read.
create policy agents_member_read on public.agents
  for select to authenticated using (private.is_tenant_member(tenant_id));
