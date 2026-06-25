-- 0005_tenant_identity.sql
-- EarnedHome — per-tenant STATIC compliance / identity fields (Phase 1A).
--
-- WHY: the buyer page already shows the loan officer's display name + NMLS from
-- the tenant row (header/footer). But the disclosure "identity line" still
-- hard-codes R Parry's legal entity + both NMLS numbers in code. These fields
-- move that identity data to the tenant so the page is fully per-LO, while the
-- general legal disclosure prose stays shared/locked in code.
--
-- These are STATIC (set once at onboarding). Frequently-changing fields are a
-- Phase II admin-dashboard concern.
--
-- Run in Supabase -> SQL Editor (shared DB = QA + prod). Idempotent.
--
-- FIELD GUIDE (the disclosure identity line renders: "{legal_name} — licensed
-- Mortgage Loan Originator, NMLS ID #{company_nmls}. {originator_name} — NMLS ID
-- #{nmls}. Equal Housing Lender. ..."):
--   legal_name      = legal entity            e.g. 'R Parry Financial, LLC'
--   company_nmls    = company / LLC NMLS       e.g. '1924318'
--   originator_name = individual MLO           e.g. 'Richard P. McHargue'
--   nmls            = originator NMLS  (existing column, header/footer)  e.g. '927662'
--   lo_name         = display name    (existing column, header/footer)  e.g. 'R Parry Financial'

-- ---- 1. Schema (run once) -------------------------------------------------
alter table public.tenants
  add column if not exists legal_name      text,
  add column if not exists company_nmls    text,
  add column if not exists originator_name text;

-- ---- 2. Per-tenant values -------------------------------------------------

-- TENANT: earnedhome  (master — R Parry Financial)
--   Values from the canonical disclosure doc. >>> CONFIRM before go-live. <<<
update public.tenants set
  lo_name         = 'R Parry Financial',
  legal_name      = 'R Parry Financial, LLC',
  company_nmls    = '1924318',
  originator_name = 'Richard P. McHargue',
  nmls            = '927662'
where slug = 'earnedhome';

-- TENANT: acme  (builder DEMO — Acme Homes)
--   Demo only. Currently borrows R Parry's 927662 — cleared. Fill when real.
update public.tenants set
  lo_name         = 'Acme Homes preferred lender',  -- display (demo)
  legal_name      = null,   -- TODO real: '«Acme lender legal entity, LLC»'
  company_nmls    = null,   -- TODO real: '«Acme company NMLS»'
  originator_name = null,   -- TODO real: '«Acme originator name»'
  nmls            = null     -- TODO real: '«Acme originator NMLS»' (was 927662 = R Parry's)
where slug = 'acme';

-- TENANT: bluekey  (agent DEMO — BlueKey Realty)
--   Demo only. Currently borrows R Parry's 927662 — cleared. Fill when real.
update public.tenants set
  lo_name         = 'BlueKey loan officer',         -- display (demo)
  legal_name      = null,   -- TODO real: '«BlueKey lender legal entity, LLC»'
  company_nmls    = null,   -- TODO real: '«BlueKey company NMLS»'
  originator_name = null,   -- TODO real: '«BlueKey originator name»'
  nmls            = null     -- TODO real: '«BlueKey originator NMLS»' (was 927662 = R Parry's)
where slug = 'bluekey';

-- ---- 3. Verify ------------------------------------------------------------
-- select slug, lo_name, legal_name, company_nmls, originator_name, nmls
-- from public.tenants order by slug;
