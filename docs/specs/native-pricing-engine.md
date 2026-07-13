# Spec — Native Pricing Engine (retire the workbook runtime)

## Goal
Replace the **live Excel-over-Graph** pricing engine with a **native code engine** behind the existing `PricingAdapter` interface — removing the concurrency ceiling and Graph latency, giving **true parallel, sub-second** pricing — **without** losing Richard's ability to own and update his rates, and without changing the front end.

## Why now
- **Correctness ceiling:** the shared workbook is a single mutable surface; `withLock` serializes quotes and can't coordinate across serverless instances → partial/mixed quotes under concurrency (already hit once). This is a *correctness* risk, not just speed.
- **Throughput:** one workbook, serialized at ~1.5s ≈ **~40 quotes/min** — a hard wall before multi-tenant traffic.
- **Latency/variance:** every quote = a Graph round-trip against a cloud workbook; ~1.4s warm, up to ~6s under load. Native = **predictable sub-second, no network hop.**
- **Scale/tenanting:** per-tenant workbooks (see `per-tenant-pricing.md`) multiply the Graph problem. Native sidesteps it.

## The core principle — separate LOGIC from DATA
The workbook is really two things tangled together:
1. **Calculation logic** — amortization, MI/MIP/funding-fee math, APR, prepaids, cash-to-close. **Stable.** → port to **code**.
2. **Rate data** — base-rate curves, LLPA/adjustment grids, MI factor tables, fee schedule, tax/insurance/escrow assumptions. **Changes daily; it's Richard's IP.** → extract to **versioned data** (JSON/DB) that Richard keeps updating.

Porting the *logic* to code while keeping the *data* Richard-owned is what makes this safe and keeps his workflow. We are **not** hardcoding rates.

## What the engine must reproduce (from the current contract)
Inputs (`eh_in_*`): `homePrice, downPct, sellerCredit, creditBand (9 bands), occupancy, propertyType, veteran, firstTime, vaPriorLoan, vaDisability, vaFundingFee`.
Outputs (`eh_out_*`) per product × **6 products** (30/15 Fixed, 30/15 FHA, 30/15 VA): `name, rate, apr, principalAndInterest, taxes, insurance, mortgageInsurance, loanFees, prepaids, downPayment, lessSeller, cashToClose` + top-level `cashToClose`, `ratesAsOf`.

## Decomposition — the native modules
Each is a pure function; together they replace the sheet:

| Module | Produces | Nature |
|---|---|---|
| **Eligibility** ✅ (already in `src/lib/eligibility.ts`) | which products are offered | done |
| **Rate resolution** | `rate` per product | **data-heavy** (base curve + LLPAs by credit × LTV × product × occupancy × property × loan-amount tier) — the hard part |
| **Amortization** | `principalAndInterest` | pure formula (rate, term, loan amount) |
| **Mortgage insurance** | `mortgageInsurance` | PMI factor table (conv >80% LTV, by credit×LTV) · FHA UFMIP + annual MIP · VA funding fee (rate table by down%, prior-use, disability waiver) |
| **Taxes & insurance** | `taxes`, `insurance` | assumption rates (property-tax %, HOI estimate) |
| **Fees** | `loanFees` | fee schedule (origination/underwriting/processing…) |
| **Prepaids / escrows** | `prepaids` | escrow months + per-diem interest |
| **APR** | `apr` | standard APR from rate + financed fees |
| **Cash-to-close** | `downPayment`, `lessSeller`, `cashToClose` | sum of the above − seller credit |

The **only** genuinely bespoke piece is **Rate resolution + the factor/fee tables** — everything else is standard mortgage math the `stub` adapter already approximates.

## Decoded mechanics (from RateStreamWorkBook — analyzed 2026-07-07)
The workbook is **4 sheets**: `Front` (display/outputs), `Engine` (3,555 cells of calc), `Rates` (the daily ratesheet), `EH_Out` (the grid). The Engine is fully decodable — it's standard mortgage math + lookup tables:

- **Rates sheet = a rate/price ladder.** Each product (Conv 30/15, Jumbo 30/15, VA 30/15, VA-Jumbo 30/15, FHA 30/15, Affordable) has paired **Rate** and **30-day price** columns (par pricing, e.g. rate 5.25 → price 96.11). This is the daily-changing data.
- **Rate selection = target-price XLOOKUP.** The Engine builds a price ladder per product (rate rows 81–99), applies **LLPA adjustments** (dollar/point deltas, e.g. `-1534`, `-3692` by tier), then `XLOOKUP`s the **rate at a target price tier** (`D105=3`). That's how a single rate is chosen per product.
- **P&I** = `PMT(rate/12/100, term*12, loanAmount) * -1` — pure amortization.
- **PMI** = `VLOOKUP(FICO, factorGrid)` — a FICO (620/640/660/680…) × LTV (80.01/85.01/90.01/95.01) **factor table** (rows 108–116) → annual % × loan ÷ 12.
- **FHA MIP / VA funding fee** = analogous rate tables (by term/LTV/down%, prior-use, disability waiver).
- **Loan amount / LTV / FICO** derived up top: `loanAmt = price − down`, `LTV = loan/price`, `FICO = XLOOKUP(creditBand)`.
- **Taxes, insurance, fees, prepaids, cash-to-close** = formula rows feeding the `Front!eh_out_*` cells.
- **Golden data included:** the workbook's cached output values (e.g. Conv-30 P&I = `$3,286.75` at the sample scenario) give a **penny-accurate validation set** for free.

**Conclusion: nothing in the engine is exotic.** It's a rate/price ladder + LLPA deltas + target-price selection + `PMT` + factor-table lookups (PMI/MIP/VA) + fee/prepaid formulas. All portable to code; the only per-tenant, daily-changing part is the **Rates sheet + LLPA/factor grids** → that becomes the `RateData`.

## Rate-data model (extracted from the workbook, versioned)
```
RateData {
  ratesAsOf: string
  baseRates: { product → rate }                 // or a price/point curve
  llpaAdjustments: Adj[]                          // {product?, creditBand, ltvBucket, occupancy?, propertyType?, loanTier?, delta}
  miFactors: { pmi grid; fhaUfmip; fhaAnnual; vaFundingFee table }
  feeSchedule: { line items }
  assumptions: { propertyTaxPct, hoiEstimate, escrowMonths, perDiemBasis }
}
```
Stored as a versioned JSON blob (per tenant → ties into `per-tenant-pricing.md`), with `ratesAsOf` for the disclosure line.

## Keeping Richard's daily rate updates (critical)
He must not lose his Excel workflow. Options, best first:
1. **Ratesheet importer (recommended):** Richard keeps a **clean, structured ratesheet tab** he edits daily; an importer (run on upload, or on a schedule via Graph read of just that tab — a *read*, not a per-quote calc) parses it into the `RateData` JSON. He edits Excel; the engine runs in code. Best of both.
2. **Admin rate console:** a dashboard screen to edit rate data directly (later).
3. **Scheduled snapshot:** a daily job reads the workbook once, produces `RateData`, commits it. (Graph used once/day, not per quote.)

## Adapter integration (zero front-end change)
Add a third adapter behind the existing interface: `getPricingAdapter()` → `stub` | `graph` | **`native`**, selected by `PRICING_ADAPTER`. Same `quote(input): PricingQuote`. The app, emails, and eligibility are untouched. `graph` stays as the **reference oracle** during validation.

## How I extract the workbook (the analysis step)
Once I have a **copy of the `.xlsx`**, I dump it programmatically (openpyxl): **every named range, every cell formula, every lookup grid** → a complete formula inventory. Then I classify each as *logic* (→ code) or *data* (→ `RateData`), and trace each `eh_out_*` back through its formula chain to the `eh_in_*` inputs. This is the cell-by-cell reverse engineering — it needs the file; it can't be done from the running app.

## Validation — shadow mode (the safety net)
1. Build a **scenario matrix**: 9 credit bands × LTV steps × 6 products × price tiers × occupancy/property/veteran combos (thousands of cases).
2. Run **`graph` and `native` side by side**, compare **to the penny** on every output, using the existing harness (`scripts/validate-engine.ts`, `engine-golden.json`).
3. Iterate on formula fidelity (rounding order, truncation, factor interpolation) until **100% match**.
4. Optionally run native **in shadow** in production (compute both, serve graph, log diffs) before flipping.

## Phased plan
1. **Extract & inventory** — dump the workbook, classify logic vs data, map every output→input chain. *(needs the file)*
2. **Data model + first import** — define `RateData`, extract R Parry's current values, build the importer.
3. **Build native modules** — rate resolution + the 8 calc modules behind the adapter.
4. **Shadow-validate** — scenario matrix vs graph, to the penny, fix drift.
5. **Cutover** — `PRICING_ADAPTER=native` on QA → Prod; keep graph as fallback/reference.
6. **Decommission** the per-quote Graph path; Graph remains only for the once-daily rate import.

## What I need from you to start
1. **A copy of the RateStream workbook (`.xlsx`)** — the single most important input; without it there's no cell-level reverse engineering.
2. **`Field_Mapping_v3`** (the named-range → cell map referenced in `graph.ts`).
3. **`scripts/engine-golden.json`** (already in-repo) + any known-good scenario/output pairs Richard trusts.
4. Confirmation of the **rate-update workflow** Richard prefers (importer vs console vs daily snapshot).

## Risks & mitigations
- **Formula fidelity** (rounding, order, hidden helper cells) → shadow-compare to the penny; graph stays as oracle.
- **Richard's IP / trust** → he keeps owning the *rates* (data); we port only the *math*. Frame as "same numbers, faster engine," validated against his own workbook.
- **Daily rate accuracy** → importer keyed to his existing ratesheet so his daily edits still drive pricing.
- **Edge cases** (jumbo tiers, VA funding-fee waivers, manufactured/condo adj) → all in the scenario matrix before cutover.

## Effort (rough)
Extraction + data model: ~1–2 focused passes once the file is in hand. Native modules: the bulk, but bounded (8 modules + rate resolution, with the `stub` as a starting skeleton). Shadow-validation: iterative but mechanical. This is a **contained, well-bounded project** because the I/O contract and eligibility are already locked and the `graph` engine is a perfect oracle to validate against.
