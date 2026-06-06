-- Loan-officer notes on a lead (free text). RLS already covers updates via
-- leads_member_update (tenant members only). Applied to azfesppisxniclnntrmc.
alter table public.leads add column if not exists notes text;
