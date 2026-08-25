-- 0021_broadcasts.sql
-- Daily Broadcast: a built-in email tool. Contacts = the imported (non-BuyerBridge)
-- recipient list; broadcasts = a sent/queued email; broadcast_recipients = the
-- per-send log (carries the per-recipient unsubscribe token); email_unsubscribes =
-- the suppression list honored across every send. All server-side (RLS on, no
-- anon/authenticated policy) — the dashboard acts through admin-gated API routes.

create table if not exists public.contacts (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  email        text not null,
  first_name   text,
  last_name    text,
  fields       jsonb not null default '{}'::jsonb,          -- open-ended extra merge fields
  status       text  not null default 'active' check (status in ('active','unsubscribed','bounced')),
  source       text,                                        -- e.g. 'import 2026-08-19'
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
-- emails are always stored lower-cased by the app, so a plain unique index works
-- (and lets the API upsert on conflict (tenant_id, email) for de-duped imports).
create unique index if not exists contacts_tenant_email_key
  on public.contacts (tenant_id, email);
create index if not exists contacts_tenant_idx on public.contacts (tenant_id);

create table if not exists public.broadcasts (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  created_by    uuid references public.app_users(id) on delete set null,
  audience      text not null check (audience in ('agents','contacts')),
  subject       text not null,
  body_html     text not null,
  status        text not null default 'draft' check (status in ('draft','sending','sent','failed')),
  total         int  not null default 0,
  sent_count    int  not null default 0,
  scheduled_for timestamptz,
  sent_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists broadcasts_tenant_idx on public.broadcasts (tenant_id, created_at desc);

create table if not exists public.broadcast_recipients (
  id           uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references public.broadcasts(id) on delete cascade,
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  email        text not null,
  first_name   text,
  status       text not null default 'queued' check (status in ('queued','sent','delivered','opened','bounced','failed','skipped')),
  unsub_token  uuid not null default gen_random_uuid(),     -- the /unsubscribe/<token> credential
  error        text,
  sent_at      timestamptz,
  created_at   timestamptz not null default now()
);
create unique index if not exists broadcast_recipients_token_key on public.broadcast_recipients (unsub_token);
create index if not exists broadcast_recipients_bcast_idx on public.broadcast_recipients (broadcast_id);

create table if not exists public.email_unsubscribes (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  email        text not null,
  reason       text,
  created_at   timestamptz not null default now()
);
create unique index if not exists email_unsubscribes_tenant_email_key
  on public.email_unsubscribes (tenant_id, email);

alter table public.contacts              enable row level security;
alter table public.broadcasts            enable row level security;
alter table public.broadcast_recipients  enable row level security;
alter table public.email_unsubscribes    enable row level security;
