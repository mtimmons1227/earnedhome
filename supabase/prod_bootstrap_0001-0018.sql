-- EarnedHome — PRODUCTION bootstrap schema (migrations 0001–0018 concatenated)
-- Run ONCE in the new prod project's SQL Editor to build the full schema.
-- Fresh DB only. Backfill UPDATEs are no-ops on empty tables. Idempotent-safe.
-- Generated 2026-07-13T02:22:51Z

begin;

-- ============================================================
-- 0001_init_multitenant.sql
-- ============================================================
-- EarnedHome Phase 1A — multi-tenant foundation schema with RLS
-- Every business row carries tenant_id; row-level security enforces isolation.
-- Version-controlled source of truth; applied to project ref azfesppisxniclnntrmc.

create extension if not exists "pgcrypto";

create type tenant_type as enum ('master','builder','agent','lo_company');
create type tenant_status as enum ('active','suspended','pending');
create type user_role as enum ('admin','lo','staff');
create type lead_status as enum ('new','contacted','working','closed','lost');

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  type tenant_type not null default 'builder',
  status tenant_status not null default 'active',
  branding jsonb not null default '{}'::jsonb,
  lo_name text,
  nmls text,
  custom_domain text unique,
  created_at timestamptz not null default now()
);

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null, location text, active boolean not null default true,
  created_at timestamptz not null default now()
);
create index communities_tenant_idx on public.communities(tenant_id);

create table public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role user_role not null default 'lo',
  full_name text, email text, nmls text,
  created_at timestamptz not null default now()
);
create index app_users_tenant_idx on public.app_users(tenant_id);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  inputs jsonb not null, outputs jsonb not null, rates_as_of date,
  created_at timestamptz not null default now()
);
create index quotes_tenant_idx on public.quotes(tenant_id);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  community_id uuid references public.communities(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  full_name text, email text, phone text,
  consent_tcpa boolean not null default false, consent_text text, consent_at timestamptz,
  source text, routed_to text, status lead_status not null default 'new',
  created_at timestamptz not null default now()
);
create index leads_tenant_idx on public.leads(tenant_id);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  type text not null, payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index events_tenant_idx on public.events(tenant_id);

create or replace function public.current_tenant_id()
returns uuid language sql stable security definer set search_path = public as $$
  select tenant_id from public.app_users where id = auth.uid() $$;
create or replace function public.is_tenant_member(tid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_users where id = auth.uid() and tenant_id = tid) $$;
create or replace function public.tenant_is_active(tid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tenants where id = tid and status = 'active') $$;

alter table public.tenants enable row level security;
alter table public.communities enable row level security;
alter table public.app_users enable row level security;
alter table public.quotes enable row level security;
alter table public.leads enable row level security;
alter table public.events enable row level security;

create policy tenants_read_active on public.tenants
  for select to anon, authenticated using (status = 'active');
create policy tenants_admin_update on public.tenants
  for update to authenticated using (is_tenant_member(id)) with check (is_tenant_member(id));
create policy communities_read on public.communities
  for select to anon, authenticated using (tenant_is_active(tenant_id));
create policy communities_member_write on public.communities
  for all to authenticated using (is_tenant_member(tenant_id)) with check (is_tenant_member(tenant_id));
create policy app_users_self_read on public.app_users
  for select to authenticated using (id = auth.uid() or tenant_id = current_tenant_id());
create policy app_users_self_update on public.app_users
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy quotes_public_insert on public.quotes
  for insert to anon, authenticated with check (tenant_is_active(tenant_id));
create policy quotes_member_read on public.quotes
  for select to authenticated using (is_tenant_member(tenant_id));
create policy leads_public_insert on public.leads
  for insert to anon, authenticated with check (tenant_is_active(tenant_id) and consent_tcpa = true);
create policy leads_member_read on public.leads
  for select to authenticated using (is_tenant_member(tenant_id));
create policy leads_member_update on public.leads
  for update to authenticated using (is_tenant_member(tenant_id)) with check (is_tenant_member(tenant_id));
create policy events_public_insert on public.events
  for insert to anon, authenticated with check (tenant_is_active(tenant_id));
create policy events_member_read on public.events
  for select to authenticated using (is_tenant_member(tenant_id));

insert into public.tenants (slug, name, type, branding, lo_name, nmls) values
  ('earnedhome','EarnedHome','master',
    '{"primary":"#1F3864","accent":"#2E75B6","bg":"#F4F6FA","initials":"EH","tag":"Powered by R Parry Financial · NMLS 927662"}'::jsonb,
    'R Parry Financial','927662'),
  ('acme','Acme Homes','builder',
    '{"primary":"#0B6B53","accent":"#13A077","bg":"#F1F8F5","initials":"AH","tag":"New homes, made simple · Financing by R Parry Financial"}'::jsonb,
    'Acme Homes preferred lender','927662'),
  ('bluekey','BlueKey Realty','agent',
    '{"primary":"#4A2C82","accent":"#7A52C0","bg":"#F6F2FC","initials":"BK","tag":"Your move starts here · Financing by R Parry Financial"}'::jsonb,
    'BlueKey loan officer','927662');

-- ============================================================
-- 0002_harden_helper_functions.sql
-- ============================================================
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

-- ============================================================
-- 0003_lead_idempotency.sql
-- ============================================================
-- Durable duplicate-lead prevention via an idempotency key.
-- The client sends one key per quote result; repeat submits collapse to one row,
-- and the unique index holds even against direct API calls. Applied to azfesppisxniclnntrmc.

alter table public.leads add column if not exists idempotency_key text;

-- Unique per tenant. NULLs are distinct in Postgres, so leads without a key
-- (e.g. legacy/direct inserts) are unaffected; only non-null keys are deduped.
create unique index if not exists leads_tenant_idempotency_uidx
  on public.leads (tenant_id, idempotency_key);

-- ============================================================
-- 0004_lead_notes.sql
-- ============================================================
-- Loan-officer notes on a lead (free text). RLS already covers updates via
-- leads_member_update (tenant members only). Applied to azfesppisxniclnntrmc.
alter table public.leads add column if not exists notes text;

-- ============================================================
-- 0005_tenant_identity.sql
-- ============================================================
-- 0005_tenant_identity.sql
-- EarnedHome — per-tenant STATIC compliance / identity fields (Phase 1A).
--
-- WHY: the buyer page already shows the loan officer's display name + NMLS from
-- the tenant row (header/footer). But the disclosure "identity line" still
-- hard-codes R Parry's legal entity + both NMLS numbers in code. These fields
-- move that identity data to the tenant so the page is fully per-LO, while the
-- general legal disclosure prose stays shared/locked in code.
--
-- These are STATIC (set once at onboarding). Frequently-changing fields are a
-- Phase II admin-dashboard concern.
--
-- Run in Supabase -> SQL Editor (shared DB = QA + prod). Idempotent.
--
-- FIELD GUIDE (the disclosure identity line renders: "{legal_name} — licensed
-- Mortgage Loan Originator, NMLS ID #{company_nmls}. {originator_name} — NMLS ID
-- #{nmls}. Equal Housing Lender. ..."):
--   legal_name      = legal entity            e.g. 'R Parry Financial, LLC'
--   company_nmls    = company / LLC NMLS       e.g. '1924318'
--   originator_name = individual MLO           e.g. 'Richard P. McHargue'
--   nmls            = originator NMLS  (existing column, header/footer)  e.g. '927662'
--   lo_name         = display name    (existing column, header/footer)  e.g. 'R Parry Financial'

-- ---- 1. Schema (run once) -------------------------------------------------
alter table public.tenants
  add column if not exists legal_name      text,
  add column if not exists company_nmls    text,
  add column if not exists originator_name text;

-- ---- 2. Per-tenant values -------------------------------------------------

-- TENANT: earnedhome  (master — R Parry Financial)
--   Values from the canonical disclosure doc. >>> CONFIRM before go-live. <<<
update public.tenants set
  lo_name         = 'R Parry Financial',
  legal_name      = 'R Parry Financial, LLC',
  company_nmls    = '1924318',
  originator_name = 'Richard P. McHargue',
  nmls            = '927662'
where slug = 'earnedhome';

-- TENANT: acme  (builder DEMO — Acme Homes)
--   Demo only. Currently borrows R Parry's 927662 — cleared. Fill when real.
update public.tenants set
  lo_name         = 'Acme Homes preferred lender',  -- display (demo)
  legal_name      = null,   -- TODO real: '«Acme lender legal entity, LLC»'
  company_nmls    = null,   -- TODO real: '«Acme company NMLS»'
  originator_name = null,   -- TODO real: '«Acme originator name»'
  nmls            = null     -- TODO real: '«Acme originator NMLS»' (was 927662 = R Parry's)
where slug = 'acme';

-- TENANT: bluekey  (agent DEMO — BlueKey Realty)
--   Demo only. Currently borrows R Parry's 927662 — cleared. Fill when real.
update public.tenants set
  lo_name         = 'BlueKey loan officer',         -- display (demo)
  legal_name      = null,   -- TODO real: '«BlueKey lender legal entity, LLC»'
  company_nmls    = null,   -- TODO real: '«BlueKey company NMLS»'
  originator_name = null,   -- TODO real: '«BlueKey originator name»'
  nmls            = null     -- TODO real: '«BlueKey originator NMLS»' (was 927662 = R Parry's)
where slug = 'bluekey';

-- ---- 3. Verify ------------------------------------------------------------
-- select slug, lo_name, legal_name, company_nmls, originator_name, nmls
-- from public.tenants order by slug;

-- ============================================================
-- 0006_lo_contact.sql
-- ============================================================
-- 0006_lo_contact.sql
-- EarnedHome — per-tenant loan-officer CONTACT + connect-action fields (Phase 1A).
--
-- WHY: the "Connect me with a loan officer" step needs, per tenant: a phone for
-- the "Call now" button, an email to ALERT when a buyer submits, the LO's online
-- application ("Apply / Reserve your mortgage") link, and (optionally) a
-- scheduling/booking link for a "Book a time" button.
--
-- These are STATIC per-LO config (set at onboarding). Today they're seeded here;
-- a Phase II "LO settings" dashboard will let an LO edit them without SQL
-- (see docs/specs/connect-flow.md and sdlc/08-future-releases.md).
--
-- Run in Supabase -> SQL Editor (shared DB = QA + prod). Idempotent.
--
-- FIELD GUIDE:
--   lo_phone     = number for the "Call now" tel: button     e.g. '817-905-8660'
--   notify_email = where buyer-lead ALERTS are emailed        e.g. 'Richard@rparryfinancial.com'
--   apply_url    = the LO's online application / "reserve" link (opens on "Apply")
--   booking_url  = the LO's scheduling link (Calendly / MS Bookings) — optional ("Book a time")

-- ---- 1. Schema (run once) -------------------------------------------------
alter table public.tenants
  add column if not exists lo_phone     text,
  add column if not exists notify_email text,
  add column if not exists apply_url    text,
  add column if not exists booking_url  text;

-- ---- 2. Per-tenant values -------------------------------------------------

-- TENANT: earnedhome  (master — R Parry Financial / Richard McHargue)
update public.tenants set
  lo_phone     = '817-905-8660',                                                            -- mobile (per Richard, 6/30/2026)
  notify_email = 'Richard@rparryfinancial.com',
  apply_url    = 'https://www.blink.mortgage/app/signup/p/rparryfinancialllc/richardmchargue', -- Blink "Reserve Your Mortgage" application
  booking_url  = null     -- TODO: set when Richard provides a Calendly / MS Bookings link (needed for the builder demo)
where slug = 'earnedhome';

-- Demos (acme/bluekey) left null on purpose — they render no connect actions until real LOs are wired.

-- ============================================================
-- 0007_tenant_integrations.sql
-- ============================================================
-- 0007_tenant_integrations.sql
-- Per-tenant CRM push configuration for the vendor-neutral lead-event seam.
-- The lead store stays in Supabase; this row tells the downstream flow which
-- CRM (if any) to push a tenant's leads into, and how to authenticate.
-- Idempotent.

create table if not exists public.tenant_integrations (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  crm_type    text not null default 'none'
              check (crm_type in ('none','followupboss','lasso','boldtrail','other')),
  crm_api_key text,                                  -- secret; service-role only (RLS below)
  crm_config  jsonb not null default '{}'::jsonb,    -- e.g. FUB source/tags, Lasso projectId
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id)
);

alter table public.tenant_integrations enable row level security;

-- No anon / authenticated policies are defined => only the server-side service
-- role can read or write these rows. Buyers and signed-in LOs can NEVER read the
-- CRM API keys. (Add a narrow admin-only policy later if the dashboard edits these.)

-- Seed R Parry with no CRM push: the dashboard + email alert are enough for the
-- single-LO pilot. Flip crm_type to 'followupboss' / 'lasso' (and set the key)
-- when a partner actually has a CRM to feed.
insert into public.tenant_integrations (tenant_id, crm_type)
select id, 'none' from public.tenants where slug = 'earnedhome'
on conflict (tenant_id) do nothing;

-- ============================================================
-- 0008_agents.sql
-- ============================================================
-- 0008_agents.sql
-- Realtor agents under a tenant (the LO's 5-10 referral partners) + per-lead
-- attribution. Access is server-side only (service role via API routes, gated by
-- the existing admin auth) — same pattern as tenant_integrations (0007). Idempotent.

create table if not exists public.agents (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  email       text,
  phone       text,
  slug        text not null,                       -- URL key: /a/<slug>
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, slug)                          -- slug unique within a tenant
);

create index if not exists agents_tenant_active_idx on public.agents (tenant_id) where active;

-- Attribute each lead to the agent who ran the estimate (nullable: direct/LO
-- leads have no agent). ON DELETE SET NULL so removing an agent never drops leads.
alter table public.leads
  add column if not exists agent_id uuid references public.agents(id) on delete set null;

create index if not exists leads_agent_idx on public.leads (agent_id);

-- RLS on: no anon/authenticated policies => only the server-side service role can
-- read/write agents. The dashboard manages agents through admin-gated API routes;
-- the public /a/<slug> link resolves the agent server-side. Buyers/LOs never query
-- this table directly.
alter table public.agents enable row level security;

-- ============================================================
-- 0009_agents_member_read.sql
-- ============================================================
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

-- ============================================================
-- 0010_agents_invite_sent_at.sql
-- ============================================================
-- Track when an agent was last emailed their share link (the "Email link"
-- button on the dashboard Agents page). Null = never sent. Updated server-side
-- by the invite route after a successful Resend send.
alter table public.agents
  add column if not exists invite_sent_at timestamptz;

-- ============================================================
-- 0011_lead_closed_at.sql
-- ============================================================
-- Track WHEN a lead closed/funded, so the dashboard can report closed deals per
-- period (this month/year) by close date, not by lead-created date. Set by the
-- lead-update route when status → 'closed'; cleared if the lead is reopened.
alter table public.leads
  add column if not exists closed_at timestamptz;

create index if not exists leads_closed_at_idx on public.leads (closed_at) where closed_at is not null;

-- ============================================================
-- 0012_multi_lo_foundation.sql
-- ============================================================
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

-- ============================================================
-- 0013_agents_lo_id.sql
-- ============================================================
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

-- ============================================================
-- 0014_app_users_invite_sent_at.sql
-- ============================================================
-- EarnedHome Phase II ("rel") — LO sign-in invite timestamp
-- Mirrors agents.invite_sent_at: records when an LO was emailed their
-- set-password / sign-in link, so the dashboard can show "Link sent …".
alter table public.app_users add column if not exists invite_sent_at timestamptz;

-- ============================================================
-- 0015_agent_status_portal.sql
-- ============================================================
-- EarnedHome Phase II ("rel") — Agent status portal
-- Gives a referral agent one page to see the status of the buyers they referred,
-- reached by a secret, revocable per-agent token. Stage-only; the buyer must
-- consent to sharing loan status (borrower NPI stays with the LO).
-- Additive/idempotent.

-- Secret token for the agent's status portal link (/agent/<token>). Unguessable,
-- unique, and separate from the public /a/<slug> share slug so it can be rotated
-- or revoked without changing the share link.
alter table public.agents add column if not exists status_token uuid;
update public.agents set status_token = gen_random_uuid() where status_token is null;
alter table public.agents alter column status_token set default gen_random_uuid();
create unique index if not exists agents_status_token_key on public.agents(status_token);

-- Buyer's affirmative consent to share their loan STATUS with their referring
-- agent. Default false → the portal shows only "Connected" until the buyer opts in.
alter table public.leads add column if not exists agent_status_consent boolean not null default false;

-- ============================================================
-- 0016_per_lo_visibility.sql
-- ============================================================
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

-- ============================================================
-- 0017_app_users_phone.sql
-- ============================================================
-- Phase II: capture a contact phone number for each loan officer (mirrors the
-- agent sign-up, which already collects a phone). Additive and nullable — no
-- backfill needed; existing LOs simply have no phone until edited.
alter table public.app_users add column if not exists phone text;

-- ============================================================
-- 0018_buyer_consent_link.sql
-- ============================================================
-- Buyer self-service status-sharing consent link.
-- A per-lead random token gives the buyer a private page to allow/revoke sharing
-- their loan status with their referring agent. Additive; audit fields track the
-- current setting's when/how (full history lives in the events table).
alter table public.leads add column if not exists consent_token uuid;
alter table public.leads add column if not exists agent_status_consent_at timestamptz;
alter table public.leads add column if not exists agent_status_consent_source text;

-- Backfill a token for existing rows, then make it defaulted + required + unique.
update public.leads set consent_token = gen_random_uuid() where consent_token is null;
alter table public.leads alter column consent_token set default gen_random_uuid();
alter table public.leads alter column consent_token set not null;
create unique index if not exists leads_consent_token_key on public.leads (consent_token);

-- Record provenance for consents that were already on (legacy signup checkbox).
update public.leads
  set agent_status_consent_source = 'signup',
      agent_status_consent_at = coalesce(agent_status_consent_at, created_at)
  where agent_status_consent = true and agent_status_consent_source is null;

commit;
