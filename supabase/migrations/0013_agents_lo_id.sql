-- EarnedHome Phase II ("rel") — Agent → Loan Officer association
-- A referral partner belongs to a specific LO (the person they trust), not just
-- the broker. This lets an agent's link route the buyer to that agent's LO, and
-- lets the agent's book travel with the LO later (re-parenting).
-- Additive/idempotent: one new nullable column + a backfill.

-- Which LO owns this agent. Nullable; on LO delete, unset (agent stays with tenant).
alter table public.agents add column if not exists lo_id uuid
  references public.app_users(id) on delete set null;
create index if not exists agents_lo_idx on public.agents(lo_id) where lo_id is not null;

-- Backfill: existing agents → the tenant's primary LO (for R Parry, that's Richard),
-- so current attribution keeps routing correctly.
update public.agents a
set lo_id = (
  select u.id from public.app_users u
  where u.tenant_id = a.tenant_id and u.is_primary = true and u.active = true
  limit 1
)
where a.lo_id is null;
