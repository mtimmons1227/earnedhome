-- 0006_lo_contact.sql
-- EarnedHome — per-tenant loan-officer CONTACT + connect-action fields (Phase 1A).
--
-- WHY: the "Connect me with a loan officer" step needs, per tenant: a phone for
-- the "Call now" button, an email to ALERT when a buyer submits, the LO's online
-- application ("Apply / Reserve your mortgage") link, and (optionally) a
-- scheduling/booking link for a "Book a time" button.
--
-- These are STATIC per-LO config (set at onboarding). Today they're seeded here;
-- a Phase II "LO settings" dashboard will let an LO edit them without SQL
-- (see docs/specs/connect-flow.md and sdlc/08-future-releases.md).
--
-- Run in Supabase -> SQL Editor (shared DB = QA + prod). Idempotent.
--
-- FIELD GUIDE:
--   lo_phone     = number for the "Call now" tel: button     e.g. '817-905-8660'
--   notify_email = where buyer-lead ALERTS are emailed        e.g. 'Richard@rparryfinancial.com'
--   apply_url    = the LO's online application / "reserve" link (opens on "Apply")
--   booking_url  = the LO's scheduling link (Calendly / MS Bookings) — optional ("Book a time")

-- ---- 1. Schema (run once) -------------------------------------------------
alter table public.tenants
  add column if not exists lo_phone     text,
  add column if not exists notify_email text,
  add column if not exists apply_url    text,
  add column if not exists booking_url  text;

-- ---- 2. Per-tenant values -------------------------------------------------

-- TENANT: earnedhome  (master — R Parry Financial / Richard McHargue)
update public.tenants set
  lo_phone     = '817-905-8660',                                                            -- mobile (per Richard, 6/30/2026)
  notify_email = 'Richard@rparryfinancial.com',
  apply_url    = 'https://www.blink.mortgage/app/signup/p/rparryfinancialllc/richardmchargue', -- Blink "Reserve Your Mortgage" application
  booking_url  = null     -- TODO: set when Richard provides a Calendly / MS Bookings link (needed for the builder demo)
where slug = 'earnedhome';

-- Demos (acme/bluekey) left null on purpose — they render no connect actions until real LOs are wired.
