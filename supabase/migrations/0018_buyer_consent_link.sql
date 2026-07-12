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
