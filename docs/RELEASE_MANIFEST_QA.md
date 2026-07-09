# Release Manifest — QA → Production

**What is on QA (`dev`) and promotes to Production on the next `dev → main` merge.**
_As of July 6, 2026. This is the approval + go-live checklist for the next production release._

> **Note (2026-07-06):** the **connect flow + emails** (buyer estimate, LO alert, Calendly, serverless fix) were **already promoted to Production** on July 6 (`main` @ `b0350d0`). What remains on QA-only below is the **Phase 1A agent attribution feature** and this session's buyer-connect UX polish.

> How to read this: everything below is **live on QA** (`dev--earnedhome.netlify.app`) and **not yet on Production** (`earnedhome.netlify.app`). Section A is Richard's/counsel's sign-off list; Section B is engineering (no sign-off, listed for completeness); Section C is the configuration that must be set as part of go-live. Nothing reaches production until `dev → main` is merged **and** Section C is done.

---

## A. Needs Richard / counsel sign-off before production

| # | Change | What to review | Doc |
|---|---|---|---|
| A1 | **Disclosure / educational copy** | The estimates-only / RESPA / Reg Z language and info-panel copy shown to buyers. | [`CHANGE_SIGNOFF_LOG.md`](CHANGE_SIGNOFF_LOG.md) #1 · `src/lib/pricing/disclosures.ts` |
| A2 | **Loan eligibility tiers** | Confirm the numbers match R Parry's lending matrix: conforming $832,750; Jumbo T1/T2 (680/700 credit, 89.99%/80% LTV); FHA $573,361; VA + VA-Jumbo tiers. | [`specs/eligibility-edit-checks.md`](specs/eligibility-edit-checks.md) |
| A3 | **Jumbo "10.01% down" wording** | The greyed-card message now reads "needs at least 10.01% down" (the true 89.99% LTV minimum) instead of a misleading "10%". | same as A2 |
| A4 | **Per-tenant identity** | The disclosure now shows the tenant's `legal_name` / `company_nmls` / `originator_name` / `nmls` (R Parry's confirmed values). | `supabase/migrations/0005_tenant_identity.sql` |
| A5 | **Buyer term/definition + disclosure copy** | Expanded **Mortgage Insurance** (incl. VA funding fee/waiver — corrects prior "VA has no MI"), the **RESPA/TILA "this is NOT a Loan Estimate"** disclaimer under Estimated Funds, new **Seller Credit** and **Military/Veteran** (links to va.gov) tooltips, and "consult your licensed Loan Officer" lines. | [`CHANGE_SIGNOFF_LOG.md`](CHANGE_SIGNOFF_LOG.md) #7 · `src/components/PathfinderTool.tsx` |
| A6 | **Buyer-estimate email copy** | The buyer email content + disclosures. **Now SENDING on QA** (Resend configured). Review before Prod buyers. | [`CHANGE_SIGNOFF_LOG.md`](CHANGE_SIGNOFF_LOG.md) #8–9 · `src/lib/email.ts` |
| A7 | **LO alert + agent copy email** | The loan-officer lead-alert and the realtor agent's copy ("via {agent}" / "your buyer signed up"). | [`CHANGE_SIGNOFF_LOG.md`](CHANGE_SIGNOFF_LOG.md) #9–10 · `src/lib/email.ts` |
| A8 | **Buyer connect UX copy** | Required-field messages, "Update my info," the connected-screen LO phone + Calendly reschedule line, and the buyer email "Book a time" CTA. | [`CHANGE_SIGNOFF_LOG.md`](CHANGE_SIGNOFF_LOG.md) #11 · `src/components/PathfinderTool.tsx` |

---

## B. Engineering changes (on QA, no sign-off needed)

- **Pricing latency:** Graph calls batched (`/$batch`, ~90 → ~6) and read batches serialized (fixed an intermittent partial-read bug). Measured **~7s → ~2s**.
- **Grid block-read (flag-gated):** optional single-read of the `EH_Out!eh_out_grid` block, `GRAPH_OUTPUT_MODE=grid`. Measured **~2s → ~1s, ~3 Graph calls**, numbers verified to the dollar vs. the workbook. Defaults to `cells` — **only active where the env var is set** (see C). Spec: [`specs/eh-out-tab-spec.md`](specs/eh-out-tab-spec.md).
- **Property Type input** (Single Family / 2-4 Unit / Condo / Manufactured) wired to `eh_in_propertyType`; **Temporary Buydown removed**.
- **Forgot-password (loan-officer only)** built and **flag-gated OFF** (`NEXT_PUBLIC_ENABLE_PASSWORD_RESET`). Not buyer-facing. **Do not enable** until Section C.
- **Buyer-estimate email (Resend) — ships DORMANT.** On lead submit, emails the buyer their eligibility-aware estimate (30/15-yr, per-product cash-to-close, scenario box) + disclosures, but **no-ops unless `RESEND_API_KEY` / `RESEND_FROM` are set** — safe on QA with no config; it will not send. Copy needs Richard sign-off (A6) + a verified Resend domain before enabling (Section C).
- **Desktop no-scroll layout** + heading/date tweaks.
- **Phase 1A Agent (Realtor) Attribution (2026-07-06):** per-agent `/a/<slug>` links tag buyers to a realtor; dashboard Agents page (add/edit/copy-link/email-link/on-off/filter); revoked links blocked; leads show agent + DISABLED badge; buyer "Update my info" edits the same lead. Migrations **0008/0009/0010** (already applied to the shared DB). Requires **`SUPABASE_SERVICE_ROLE_KEY`** on the deploy context (already set all contexts). Test script: [`AGENT_ATTRIBUTION_QA_TEST.md`](AGENT_ATTRIBUTION_QA_TEST.md).
- **Closed/funded production tracking (2026-07-08):** "Closed" → **"Closed / Funded"**; `closed_at` stamped on close; dashboard adds **Closed / Funded**, **Closed this month**, **Lead → Closed %**, **Close rate (this month)** in a counts-row + rates-row layout; cards refresh live on status change. Migration **0011** (`leads.closed_at`, applied to shared DB).

> **Email/domain now LIVE (both environments):** `rparryfinancial.com` verified in Resend; `RESEND_FROM` = `no-reply@rparryfinancial.com`; `home.rparryfinancial.com` is the branded production URL (SSL). See [`CHANGE_SIGNOFF_LOG.md`](CHANGE_SIGNOFF_LOG.md) #13–14 and [`SESSION_HANDOFF.md`](SESSION_HANDOFF.md) §1.

---

## C. Pre-promotion configuration (part of go-live)

These are **not** code merges — they're settings to apply when promoting:

1. **Production engine flip (the big one):** Production currently runs the **`stub`** (demo) engine. Going live on real pricing = set **`PRICING_ADAPTER=graph`** on the Production context, then run `test:tags` and the $1 validation.
2. **`EH_Out` tab in the live workbook:** ✅ confirmed present (grid mode returns real numbers). Required before flipping `GRAPH_OUTPUT_MODE=grid`.
3. **Grid read per environment:** after QA verification, set **`GRAPH_OUTPUT_MODE=grid`** on QA, then Production. Leave unset to stay on the proven cell-by-cell path.
4. **Forgot-password gate:** before setting `NEXT_PUBLIC_ENABLE_PASSWORD_RESET=true` anywhere — configure **Resend SMTP** in Supabase (built-in email is rate-limited), add QA+prod redirect URLs, (recommended) `token_hash` recovery template. **Resend deferred per Marvin (June 25).** See [`sdlc/06-deployment.md`](sdlc/06-deployment.md) go-live checklist.
5. **Custom domain + branding** (when chosen): root domain DNS/SSL on Netlify; pilot builder branding.
6. **Buyer-estimate email (Resend):** ✅ **configured on QA** (`RESEND_API_KEY` + verified `RESEND_FROM` = `thetimmonsfoundation.org`). Emails send. **Before Prod buyers:** get Richard's RESPA sign-off on buyer/LO/agent copy (A6–A8); verify `rparryfinancial.com` in Resend, then set Prod `RESEND_FROM` to it.
7. **Lead-alert recipient (`notify_email`):** shared DB value — set to **Richard** before real Prod buyers (`update tenants set notify_email='richard@rparryfinancial.com' where slug='rparry';`). Set `LEAD_NOTIFY_OVERRIDE` on QA/local to keep test alerts off Richard's inbox.
8. **Agent feature service key:** `SUPABASE_SERVICE_ROLE_KEY` must be set on the deploy context (already set on all contexts) — the agents CRUD/invite routes fail without it.

---

## D. How to promote

1. Richard/counsel approve Section A (eligibility numbers + disclosure copy).
2. Complete the Section C settings relevant to this release.
3. Merge **`dev → main`** → Netlify auto-deploys Production.
4. Post-deploy: `test:tags`, $1 validation, desktop+mobile smoke check; confirm forgot-password is hidden and the grid/engine behave as configured.
5. Rollback path: Netlify deploy history (app) + SharePoint version history (workbook).

---

## Still NOT on QA (parked — future sessions)
- Buyer **resume ("magic") link** (`/r/<token>`) to reopen a saved estimate — still not built (the in-session "Update my info" partly covers the "change my mind" case).
- **Per-tenant pricing** — each LO's own workbook. Spec ready: [`specs/per-tenant-pricing.md`](specs/per-tenant-pricing.md). Not built (pricing still reads shared env-var workbook).
- **Per-tenant disclosures** — move the shared R Parry disclosure module to tenant data (needed before a 2nd live LO). No spec yet.
- **Super-admin Tenants page** — form wrapper around the onboarding clone script ([`TENANT_ONBOARDING.md`](TENANT_ONBOARDING.md)). Not built.
- Loan-amount display on cards (price − down; app-computed; not built).
- VA-15 engine fix (Richard's workbook — `eh_out_va15_apr/downPayment/cashToClose` blank). See [`sdlc/05a-qa-test-plan.md`](sdlc/05a-qa-test-plan.md) §6.1.
