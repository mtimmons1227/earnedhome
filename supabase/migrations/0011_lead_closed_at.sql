-- Track WHEN a lead closed/funded, so the dashboard can report closed deals per
-- period (this month/year) by close date, not by lead-created date. Set by the
-- lead-update route when status → 'closed'; cleared if the lead is reopened.
alter table public.leads
  add column if not exists closed_at timestamptz;

create index if not exists leads_closed_at_idx on public.leads (closed_at) where closed_at is not null;
