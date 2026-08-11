-- 0020_agents_firm.sql
-- The agent's firm / brokerage (e.g., "Keller Williams"). Surfaced to the buyer
-- as "Your agent: <name> with <firm>" on the /a/<slug> run-numbers page, and
-- editable on the dashboard Agents page. Additive/idempotent.
alter table public.agents add column if not exists firm text;
