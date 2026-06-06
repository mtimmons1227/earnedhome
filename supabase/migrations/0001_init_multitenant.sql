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
