-- 0019_share_links.sql
-- Per-recipient share links for (A) agent->buyer invites and (B) buyer->friend
-- referrals. Keeps leads = real buyers who engaged; share_links holds the
-- invite/referral lifecycle (token, on/off, who-referred-whom). Additive/idempotent.
-- Access is server-side only (service role via API routes) — same posture as
-- agents (0008) and tenant_integrations (0007).

create table if not exists public.share_links (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id)    on delete cascade,
  agent_id          uuid references public.agents(id)              on delete set null,   -- owning agent
  lo_id             uuid references public.app_users(id)           on delete set null,   -- routing LO
  kind              text not null check (kind in ('agent_invite','buyer_referral')),
  recipient_name    text,
  recipient_email   text,
  token             uuid not null default gen_random_uuid(),                             -- the link credential
  active            boolean not null default true,                                       -- the on/off switch
  referrer_lead_id  uuid references public.leads(id) on delete set null,                 -- buyer who shared (Flow B)
  lead_id           uuid references public.leads(id) on delete set null,                 -- set when they convert
  suggested_agent_name  text,   -- friend named an agent not yet on EarnedHome
  suggested_agent_email text,
  created_at        timestamptz not null default now(),
  sent_at           timestamptz
);

create unique index if not exists share_links_token_key    on public.share_links(token);
create index        if not exists share_links_agent_idx    on public.share_links(agent_id) where active;
create index        if not exists share_links_tenant_idx   on public.share_links(tenant_id);
create index        if not exists share_links_referrer_idx on public.share_links(referrer_lead_id);

-- Trace a referred lead back to the buyer who shared (keeps billing/metrics honest).
alter table public.leads add column if not exists referred_by uuid references public.leads(id) on delete set null;
-- NOTE: leads.source already exists — set 'agent_invite' | 'buyer_referral' as appropriate.

-- RLS on with no anon/authenticated policy => service-role only. The agent portal
-- (token) and the buyer share act through server-side API routes; buyers and LOs
-- never query this table directly.
alter table public.share_links enable row level security;
