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
