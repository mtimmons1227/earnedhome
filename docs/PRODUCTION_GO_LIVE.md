# Production Go-Live Runbook — EarnedHome

**Single source of truth for taking EarnedHome (R Parry pilot) from QA to a real, buyer-facing production site.**
_Last updated: June 30, 2026. Owner: Marvin. Read alongside [`RELEASE_MANIFEST_QA.md`](RELEASE_MANIFEST_QA.md) (what's queued to promote), [`WHITE_LABEL_ARCHITECTURE.md`](WHITE_LABEL_ARCHITECTURE.md) (branding/domains), and [`sdlc/06-deployment.md`](sdlc/06-deployment.md) (deploy mechanics)._

> This runbook answers four questions: **(1)** what test-only state must be reset, **(2)** what configuration makes the system production-ready, **(3)** how buyers will see it (branding), and **(4)** how the URL/domain is set up. Nothing here changes code — it's the settings, SQL, and steps for go-live.

---

## 0. Current state at a glance

| Environment | URL | Branch | Pricing engine | Emails (Resend) |
|---|---|---|---|---|
| **Local** | `localhost:3000` | working tree | `graph` + `grid` (your `.env.local`) | configured for your testing |
| **QA / dev** | `dev--earnedhome.netlify.app` | `dev` | currently per dev context | **dormant** (no Resend keys set) |
| **Production** | `earnedhome.netlify.app` | `main` | **`stub` (demo) — not live pricing yet** | **dormant** (no Resend keys set) |

Production is **not yet live** in two senses: it runs the demo `stub` engine (not real Graph pricing), and email is dormant (no LO alerts / buyer estimates send). Both are deliberate and are flipped as part of go-live (§2).

---

## 1. Test-state to reset before production  ⚠️ (the "log")

These are values set for **testing** that must be changed before real buyers use the site. Verified live in Supabase on June 30, 2026.

| # | Item | Current (test) value | Production value | Where to change |
|---|---|---|---|---|
| T1 | **LO alert recipient** (`tenants.notify_email`) | **`marv_timmons@yahoo.com`** ← your inbox | `Richard@rparryfinancial.com` | SQL (§3) |
| T2 | **Test leads in DB** | **30 rows** (Jun 6–30, all test submissions) | clean — remove test rows | SQL (§3) |
| T3 | **Booking link** (`tenants.booking_url`) | `calendly.com/richard-800/30min` | Confirm this is Richard's real, branded Calendly handle (the `richard-800` slug looks auto-generated) | SQL (§3) or Calendly |
| T4 | **Email "from" domain** (`RESEND_FROM`) | `thetimmonsfoundation.org` (your founder domain, used for local testing) | An **R Parry–owned** sender (e.g. `no-reply@rparryfinancial.com`) verified in Resend — see §4/branding + deliverability | Netlify env (§2) + Resend |
| T5 | **Demo tenants** (`acme`, `bluekey`) | `status = active`, no LO contact info | Decide: keep as live builder demos, or set `status = 'suspended'` so they don't resolve in prod | SQL (§3) |

T1 is the important one for go-live: if it ships as-is, **every real buyer lead alert goes to your Yahoo inbox, not Richard.**

---

## 2. Production configuration (Netlify env vars)

Set on the **Production deploy context** in Netlify (Site config → Environment variables → scope to "Production"). These are settings, not code.

| Variable | Production value | Why |
|---|---|---|
| `PRICING_ADAPTER` | `graph` | **The big flip** — production currently runs `stub` (demo numbers). `graph` reads Richard's live RateStream workbook. |
| `GRAPH_OUTPUT_MODE` | `grid` | ~1s single-block read. Verify in QA first; leave unset to fall back to the proven cell-by-cell path. |
| `RESEND_API_KEY` | _(Richard/you set; never paste to me)_ | Turns on LO alerts + buyer estimate emails. Until set, both **no-op safely**. |
| `RESEND_FROM` | verified R Parry sender (T4) | Must be a **domain verified in Resend with SPF/DKIM** or mail lands in spam. |
| `NEXT_PUBLIC_ROOT_DOMAIN` | the production root domain (§5) | Drives host→tenant resolution. Defaults to `earnedhome.com` if unset. |
| `NEXT_PUBLIC_ENABLE_PASSWORD_RESET` | leave **off** | LO forgot-password is gated off until Resend SMTP is wired in Supabase. Not buyer-facing. |

Graph credentials (`GRAPH_*` workbook drive/item ids, tenant app creds) are already configured for the engine — confirm they're present on the Production context, not just dev.

---

## 3. Production SQL (run in Supabase SQL editor)

One block. Resets the test-state items from §1. **Review T3/T5 choices before running.**

```sql
-- T1: route real lead alerts to Richard (NOT the test inbox)
update public.tenants
   set notify_email = 'Richard@rparryfinancial.com'
 where slug = 'earnedhome';

-- T3: confirm/replace the booking link with Richard's real Calendly handle
-- (only run if the richard-800 slug is a placeholder)
-- update public.tenants
--    set booking_url = 'https://calendly.com/<richard-real-handle>/30min'
--  where slug = 'earnedhome';

-- T2: remove test leads before go-live.
-- Safest: delete everything captured during testing up to launch day.
-- REVIEW the count first, then uncomment the delete.
select count(*) from public.leads where created_at < '2026-07-01';
-- delete from public.leads where created_at < '2026-07-01';
-- (events/quotes referencing them can be cleaned the same way if desired)

-- T5: if the builder demos should NOT be reachable in production, suspend them
-- update public.tenants set status = 'suspended' where slug in ('acme','bluekey');

-- Verify final state
select slug, status, lo_name, nmls, lo_phone, notify_email, apply_url, booking_url, custom_domain
  from public.tenants order by slug;
```

Identity values shown in the disclosure (`legal_name` / `company_nmls` / `originator_name` / `nmls`, set by migration `0005`) should already be Richard's confirmed values — verify in the final `select`.

---

## 4. Branding — how buyers see it

Branding is **per-tenant, data-driven** — no code change to rebrand. It comes from the `tenants` row and renders in two places:

- **`tenants.branding` JSON** → `{ primary, accent, bg, initials, tag, logo_url? }`. `primary`/`accent`/`bg` set the theme CSS variables (`src/app/page.tsx`); `initials` + `tag` render in the header (`BrandHeader`); `logo_url` (optional) replaces the initials badge with an uploaded logo.
- **`lo_name` + `nmls`** → shown in the disclosure and the connect buttons ("Call R Parry Financial", "Powered by R Parry Financial · NMLS 927662").

**What R Parry shows today:**

| Field | Value |
|---|---|
| `name` | EarnedHome |
| `initials` badge | `EH` |
| `tag` | "Powered by R Parry Financial · NMLS 927662" |
| `primary / accent / bg` | `#1F3864` / `#2E75B6` / `#F4F6FA` (navy/blue) |
| `lo_name` / `nmls` | R Parry Financial / 927662 |

To use R Parry's real logo/colors at launch, update the `branding` JSON (and upload a logo to Supabase Storage, set `logo_url`). This is a data edit, not a deploy. Example:

```sql
update public.tenants
   set branding = branding
       || '{"primary":"#1F3864","accent":"#2E75B6","logo_url":"https://<storage>/rparry-logo.png"}'::jsonb
 where slug = 'earnedhome';
```

**Email branding** ties to T4: buyer/LO emails send from `RESEND_FROM`. For a branded, deliverable experience use an R Parry domain, not the foundation domain used in testing.

---

## 5. URL / custom domain setup

The platform resolves the tenant from the **hostname** (`src/lib/tenant.ts` `slugFromHost`). There are three ways the R Parry site can be reached, lowest to highest effort:

**(a) Netlify default (works today).** `earnedhome.netlify.app` → root host → falls back to the default `earnedhome` tenant. Fine for the pilot/demo; not a branded URL.

**(b) Subdomain on our root domain.** `rparry.earnedhome.com` → slug `rparry`. Requires: registering `earnedhome.com`, wildcard DNS + SSL on Netlify, `NEXT_PUBLIC_ROOT_DOMAIN=earnedhome.com`, and a tenant whose `slug` matches the subdomain. This is the fast path for onboarding multiple builders.

**(c) Custom domain (premium white-label).** `apply.rparryfinancial.com` → CNAME'd to our Netlify production deploy. Steps:

1. Add the domain in Netlify (Domain management → add custom domain) and let Netlify provision SSL.
2. Richard's DNS: CNAME the host to the Netlify target.
3. Store the mapping so host→tenant resolves: set `tenants.custom_domain` for the R Parry row (the schema already has this column) **or** add the host to the resolution path.
4. Add the domain to **Supabase Auth → Redirect URLs** (needed once LO login/password-reset is on).

For the **pilot**, (a) or a single subdomain (b) is enough. A custom domain (c) is the upgrade when R Parry wants the site to live under their own brand. Per [`WHITE_LABEL_ARCHITECTURE.md`](WHITE_LABEL_ARCHITECTURE.md), wildcard DNS + a scripted onboarding flow is the scale answer (20+ tenants).

---

## 6. Promotion process & verification

1. **Sign-offs (Richard / counsel):** approve [`RELEASE_MANIFEST_QA.md`](RELEASE_MANIFEST_QA.md) Section A — disclosure/RESPA copy, eligibility tiers, buyer term definitions, and the buyer/LO **email copy** before email is enabled.
2. **Apply §1 resets (SQL, §3)** and **§2 config (Netlify env)**.
3. **Merge `dev → main`** → Netlify auto-deploys production. (Confirm the connect-flow batch is on `dev` first — see RELEASE_MANIFEST note below.)
4. **Post-deploy verification:**
   - `npm run test:tags` + the $1 validation (numbers match the workbook).
   - Desktop + mobile smoke: run a quote, confirm eligible cards show / ineligible hide, latency ~1s.
   - Submit one real lead end-to-end → confirm the alert lands in **Richard's** inbox (T1), the buyer estimate arrives, and the lead appears in the dashboard.
   - Confirm Apply opens Blink, Call dials Richard's mobile, Book opens his Calendly with name+email prefilled.
   - Confirm forgot-password is hidden.
5. **Rollback path:** Netlify deploy history (app) + SharePoint version history (workbook).

---

## 7. Connect-flow batch — track in the release manifest

The connect-flow work (LO email alert via Resend, Apply/Call/Book/Reach-out buttons, Calendly name+email prefill, buyer-form defaults → 0, hide-ineligible-cards, "Mortgage Terms and Payment Definitions" link, migration `0006_lo_contact`) is **on local, not yet pushed to `dev`.** It must be pushed to QA and verified before it can promote with this release. See [`specs/connect-flow.md`](specs/connect-flow.md). Add it to [`RELEASE_MANIFEST_QA.md`](RELEASE_MANIFEST_QA.md) Sections A/B/C when pushed.

---

## Quick checklist

- [ ] T1 — `notify_email` → Richard (SQL)
- [ ] T2 — test leads cleaned (SQL)
- [ ] T3 — real Calendly link confirmed
- [ ] T4 — R Parry `RESEND_FROM` domain verified (SPF/DKIM)
- [ ] T5 — demo tenants kept or suspended
- [ ] `PRICING_ADAPTER=graph` on Production
- [ ] `GRAPH_OUTPUT_MODE=grid` on Production (after QA verify)
- [ ] `RESEND_API_KEY` + `RESEND_FROM` on Production
- [ ] Branding (logo/colors) finalized for R Parry
- [ ] URL/domain decided (default / subdomain / custom)
- [ ] Richard/counsel signed off RELEASE_MANIFEST Section A
- [ ] Connect-flow batch pushed to `dev` + verified
- [ ] `dev → main` merged, post-deploy verification passed
```