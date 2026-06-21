# Phase 4 — Development
**AI-era name: Build & Integration**
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

## AI's role in this phase
**Maturity: AI-Assisted (LLM copilot).** This is where AI contributed most directly: it generated the graph adapter, the stub, the `PathfinderTool` UI, and the tagging/test scripts, and suggested the fixes that mattered (the `downPct / 100` unit conversion, `$select=text` for dates, tolerant reads). Crucially, the *pricing logic itself was not AI-generated* — it stays in the partner's auditable workbook. Every AI edit was human-reviewed and verified (a rule reinforced after an editing tool once truncated files).

## Key artifacts
- `src/lib/pricing/{types,stub,graph,disclosures}.ts`
- `src/components/PathfinderTool.tsx`, `src/app/globals.css`
- `scripts/*` and the `package.json` script entries
- Git history on the `dev` branch
