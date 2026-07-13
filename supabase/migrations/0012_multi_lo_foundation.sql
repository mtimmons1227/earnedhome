-- EarnedHome Phase II ("rel") — Multi-Loan-Officer foundation
-- Additive and safe on the shared QA/Prod database: only new nullable columns +
-- a backfill. No existing column, policy, or behavior is altered, so Phase 1A
-- (single broker/LO) keeps working exactly as before. This is the groundwork for
-- routing a buyer to a specific LO and tagging each lead to that LO.
-- Idempotent (re-runnable).

-- 1. Loan-officer identity flags on app_users.
--    is_primary → the default LO for the tenant; active → seat on/off.
alter table public.app_users add column if not exists is_primary boolean not null default false;
alter table public.app_users add column if not exists active     boolean not null default true;

-- 2. Per-tenant routing strategy (how a buyer is matched to an LO).
--    Starts at 'default' (single primary LO) for every existing tenant.
alter table public.tenants add column if not exists lo_routing text not null default 'default';
alter table public.tenants drop constraint if exists tenants_lo_routing_chk;
alter table public.tenants add constraint tenants_lo_routing_chk
  check (lo_routing in ('default','community','round_robin','buyer_choice'));

-- 3. Community → LO link (for the future 'community' routing strategy). Nullable.
alter table public.communities add column if not exists lo_id uuid
  references public.app_users(id) on delete set null;

-- 4. Link each lead to the specific LO it was routed to.
--    routed_to (free-text display copy) is kept unchanged; assigned_lo_id is the
--    reliable reference used for per-LO reporting and (later) per-LO visibility.
alter table public.leads add column if not exists assigned_lo_id uuid
  references public.app_users(id) on delete set null;
create index if not exists leads_assigned_lo_idx
  on public.leads(assigned_lo_id) where assigned_lo_id is not null;

-- 5. Backfill: for any tenant that has exactly one active LO/admin user, flag them
--    primary — so single-LO shops (like R Parry, where Richard is broker+LO) start
--    routing leads to that person automatically, with no manual step.
update public.app_users u
set is_primary = true
where u.active = true
  and u.role in ('lo','admin')
  and (
    select count(*) from public.app_users x
    where x.tenant_id = u.tenant_id and x.active = true and x.role in ('lo','admin')
  ) = 1
  and not exists (
    select 1 from public.app_users p
    where p.tenant_id = u.tenant_id and p.is_primary = true
  );
