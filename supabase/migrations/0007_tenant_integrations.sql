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
