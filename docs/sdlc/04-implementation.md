# Phase 4 — Implementation
**Also known as (AI-era): Build & Integration**
**Status: ✅ Complete** — app built, live Graph engine integrated, committed and pushed to `dev`.

## Purpose
Write the code that realizes the design — the app, the integrations, and the supporting tooling — in small, verifiable increments.

## Process (repeatable)
1. **Build behind the contract** — implement the stub first so the UI is real before the integration lands.
2. **Integrate the live source** — implement the real adapter to the same contract.
3. **Build the UI** against the contract's data shapes.
4. **Add supporting tooling** (scripts) for the parts that aren't day-to-day app code.
5. **Commit in small, described increments** on a working branch.

## What we did on EarnedHome (Phase 1A)

### Pricing engine
- **Stub adapter** (`src/lib/pricing/stub.ts`) — illustrative amortization math across all 6 products so the front end and demos worked before the live workbook was wired.
- **Graph adapter** (`src/lib/pricing/graph.ts`) — the live integration. Implements the full pipeline from Phase 3: app-only token caching, 429/503 backoff, non-persisting sessions, write-7-inputs → recalc → read-6-blocks, the concurrency lock, and the TTL cache. Notable build details that earned their place:
  - `setRange("eh_in_downPct", input.downPct / 100, …)` — UI sends whole percent; the sheet stores a decimal.
  - Credit/occupancy written as **indexes** into Form-Control linked cells (`CREDIT_INDEX`, `OCCUPANCY_INDEX`).
  - `getRangeOpt` (tolerant read → `undefined` instead of throwing) so optional/not-yet-tagged outputs never break a quote.
  - `getRangeText` (`$select=text`) so the **date** reads as displayed text, not an Excel serial number.
  - Per-product `cashToClose` with a fallback to a shared tag.

### Front end
`src/components/PathfinderTool.tsx` — the buyer tool: the input panel, the product cards with full payment + **Estimated Funds** breakdown (`EfRow` helper), buyer-friendly labels, the ⓘ info tips (`openTip` state on Military/Veteran, First-Time Buyer, Seller Credit, Temporary Buydown), the single **"Understanding your estimate"** info modal (`InfoTerm` helper), and the polished **lead-capture modal** (`showLeadModal`). Products are filtered so VA only shows for veterans and only positive-payment products render; an empty result shows a routing message. The **"rates as of"** stamp sits next to the "Your numbers" heading. Responsive layout (`globals.css`: cards stack below 760px).

### Supporting tooling
Scripts (`scripts/`, wired into `package.json`): `test:tags`, `find:sp`, `create:ctc-names`, `create:va-names`, `test:va`, plus the named-range **tagging** that injects `eh_in_*`/`eh_out_*` at the XML level while preserving Form Controls. The tags are the implementation of the **named-range map** (`RateStream_Named_Range_Map_v4.md`, 91 ranges) — the precise cell-by-cell contract the code reads and writes.

### Engineering practices applied
- **One stable seam** (the adapter) kept UI and integration independently buildable.
- **Type safety** end to end (TypeScript, `satisfies PricingQuote`).
- **No secrets in code** — all Graph/Supabase credentials in `.env.local` (git-ignored).
- **Small commits on `dev`** with descriptive messages; e.g. the milestone commit "Live Graph engine end-to-end: SharePoint repoint, 6 products + Jumbo dynamic names, Estimated Funds breakdown, lead modal, info panels, buyer-friendly labels."

### Phase 1A increments (June 24–25)
- **Loan eligibility tiers + greyed-out cards** — `src/lib/eligibility.ts` expanded to the full lending matrix (conforming; **Jumbo Tier 1/2** with credit + LTV gates; FHA cap; **VA + VA-Jumbo** tiers); `PathfinderTool.tsx` renders ineligible products **greyed with the reason** (judged against the input snapshot that produced the quote). Spec: `docs/specs/eligibility-edit-checks.md`.
- **Property Type added; Temporary Buydown removed** — new `PropertyType` (Single Family / 2-4 Unit / Condo / Manufactured) wired to the existing `eh_in_propertyType` named range (Engine!F21, index 1-4) in the graph adapter. New `create:input-names` script documents/recreates the base input tags.
- **Latency — Graph `$batch`** — adapter rewritten to collapse ~90 sequential Graph calls per quote into ~6 (`/$batch`), with `quote.meta` (`tookMs` / `graphCalls`) telemetry. Measured **~7s → ~2s** on QA. The ~1s path ("block reads") is a workbook layout change — `docs/specs/graph-block-reads.md`.
- **Forgot-password (loan-officer only, flag-gated)** — `/login` reset mode, `/reset-password`, and a hardened `/auth/callback` (handles both PKCE `code` and `token_hash`; expired-link → `/login?reset=expired`). After a successful reset the recovery session is ended and the user is returned to sign in (`/login?reset=success`). Hidden behind `NEXT_PUBLIC_ENABLE_PASSWORD_RESET` (off on QA/prod). Buyers have no accounts and never see it.
- **Grid block-read (flag-gated, shipped)** — `graph.ts` gained a `GRAPH_OUTPUT_MODE=grid` path that reads the new **`EH_Out` reference tab** (`eh_out_grid`, `B2:N7`) in one call instead of ~78 cell reads. Measured **~2s → ~1s, ~3 Graph round-trips**, numbers verified to the dollar against the workbook. Defaults to `cells`; the `EH_Out` tab is live in the workbook. Spec: `docs/specs/eh-out-tab-spec.md`. (Also reverted an interim parallel-reads change that caused intermittent partial reads.)
- **Jumbo Tier 1 message fix** — `eligibility.ts` `downNeeded()` now keeps 2-decimal precision so the 89.99% LTV cap reads as **"needs at least 10.01% down"** instead of a misleading "10%". Clean tiers (5%, 3.5%, 20%) unchanged.
- **Per-tenant identity (DB)** — migration `0005_tenant_identity.sql` adds `legal_name`, `company_nmls`, `originator_name` to `tenants` (R Parry confirmed; demos null), so the disclosure identity line becomes per-LO data rather than hard-coded. Legal prose stays shared/locked. (Companion code — templating that line — is the follow-up.)

## AI's role in this phase
**Maturity: AI-Assisted (LLM copilot).** This is where AI contributed most directly: it generated the graph adapter, the stub, the `PathfinderTool` UI, and the tagging/test scripts, and suggested the fixes that mattered (the `downPct / 100` unit conversion, `$select=text` for dates, tolerant reads). Crucially, the *pricing logic itself was not AI-generated* — it stays in the partner's auditable workbook. Every AI edit was human-reviewed and verified (a rule reinforced after an editing tool once truncated files).

## Key artifacts
- `src/lib/pricing/{types,stub,graph,disclosures}.ts`
- `src/components/PathfinderTool.tsx`, `src/app/globals.css`
- `scripts/*` and the `package.json` script entries
- Git history on the `dev` branch
