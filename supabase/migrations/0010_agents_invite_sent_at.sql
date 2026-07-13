-- Track when an agent was last emailed their share link (the "Email link"
-- button on the dashboard Agents page). Null = never sent. Updated server-side
-- by the invite route after a successful Resend send.
alter table public.agents
  add column if not exists invite_sent_at timestamptz;
