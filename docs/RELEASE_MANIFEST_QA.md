# Release Manifest — QA → Production

**What is on QA (`dev`) and promotes to Production on the next `dev → main` merge.**
_As of June 25, 2026. This is the approval + go-live checklist for the next production release._

> How to read this: everything below is **live on QA** (`dev--earnedhome.netlify.app`) and **not yet on Production** (`earnedhome.netlify.app`). Section A is Richard's/counsel's sign-off list; Section B is engineering (no sign-off, listed for completeness); Section C is the configuration that must be set as part of go-live. Nothing reaches production until `dev → main` is merged **and** Section C is done.

---

## A. Needs Richard / counsel sign-off before production

| # | Change | What to review | Doc |
|---|---|---|---|
| A1 | **Disclosure / educational copy** | The estimates-only / RESPA / Reg Z language and info-panel copy shown to buyers. | [`CHANGE_SIGNOFF_LOG.md`](CHANGE_SIGNOFF_LOG.md) #1 · `src/lib/pricing/disclosures.ts` |
| A2 | **Loan eligibility tiers** | Confirm the numbers match R Parry's lending matrix: conforming $832,750; Jumbo T1/T2 (680/700 credit, 89.99%/80% LTV); FHA $573,361; VA + VA-Jumbo tiers. | [`specs/eligibility-edit-checks.md`](specs/eligibility-edit-checks.md) |
| A3 | **Jumbo "10.01% down" wording** | The greyed-card message now reads "needs at least 10.01% down" (the true 89.99% LTV minimum) instead of a misleading "10%". | same as A2 |
| A4 | **Per-tenant identity** | The disclosure now shows the tenant's `legal_name` / `company_nmls` / `originator_name` / `nmls` (R Parry's confirmed values). | `supabase/migrations/0005_tenant_identity.sql` |

---

## B. Engineering changes (on QA, no sign-off needed)

- **Pricing latency:** Graph calls batched (`/$batch`, ~90 → ~6) and read batches serialized (fixed an intermittent partial-read bug). Measured **~7s → ~2s**.
- **Grid block-read (flag-gated):** optional single-read of the `EH_Out!eh_out_grid` block, `GRAPH_OUTPUT_MODE=grid`. Measured **~2s → ~1s, ~3 Graph calls**, numbers verified to the dollar vs. the workbook. Defaults to `cells` — **only active where the env var is set** (see C). Spec: [`specs/eh-out-tab-spec.md`](specs/eh-out-tab-spec.md).
- **Property Type input** (Single Family / 2-4 Unit / Condo / Manufactured) wired to `eh_in_propertyType`; **Temporary Buydown removed**.
- **Forgot-password (loan-officer only)** built and **flag-gated OFF** (`NEXT_PUBLIC_ENABLE_PASSWORD_RESET`). Not buyer-facing. **Do not enable** until Section C.
- **Desktop no-scroll layout** + heading/date tweaks.

---

## C. Pre-promotion configuration (part of go-live)

These are **not** code merges — they're settings to apply when promoting:

1. **Production engine flip (the big one):** Production currently runs the **`stub`** (demo) engine. Going live on real pricing = set **`PRICING_ADAPTER=graph`** on the Production context, then run `test:tags` and the $1 validation.
2. **`EH_Out` tab in the live workbook:** ✅ confirmed present (grid mode returns real numbers). Required before flipping `GRAPH_OUTPUT_MODE=grid`.
3. **Grid read per environment:** after QA verification, set **`GRAPH_OUTPUT_MODE=grid`** on QA, then Production. Leave unset to stay on the proven cell-by-cell path.
4. **Forgot-password gate:** before setting `NEXT_PUBLIC_ENABLE_PASSWORD_RESET=true` anywhere — configure **Resend SMTP** in Supabase (built-in email is rate-limited), add QA+prod redirect URLs, (recommended) `token_hash` recovery template. **Resend deferred per Marvin (June 25).** See [`sdlc/06-deployment.md`](sdlc/06-deployment.md) go-live checklist.
5. **Custom domain + branding** (when chosen): root domain DNS/SSL on Netlify; pilot builder branding.

---

## D. How to promote

1. Richard/counsel approve Section A (eligibility numbers + disclosure copy).
2. Complete the Section C settings relevant to this release.
3. Merge **`dev → main`** → Netlify auto-deploys Production.
4. Post-deploy: `test:tags`, $1 validation, desktop+mobile smoke check; confirm forgot-password is hidden and the grid/engine behave as configured.
5. Rollback path: Netlify deploy history (app) + SharePoint version history (workbook).

---

## Still NOT on QA (parked — future sessions)
- Buyer estimate email + resume link (Phase 1A/II — researched, not built).
- Loan-amount display on cards (price − down; app-computed; not built).
- Per-LO disclosure-template engine + admin dashboard (Phase II).
- VA-15 engine fix (Richard's workbook — `eh_out_va15_apr/downPayment/cashToClose` blank). See [`sdlc/05a-qa-test-plan.md`](sdlc/05a-qa-test-plan.md) §6.1.
