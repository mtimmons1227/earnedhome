-- EarnedHome Phase II ("rel") — LO sign-in invite timestamp
-- Mirrors agents.invite_sent_at: records when an LO was emailed their
-- set-password / sign-in link, so the dashboard can show "Link sent …".
alter table public.app_users add column if not exists invite_sent_at timestamptz;
