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
