# Phase 3 — Design
**AI-era name: Solution Architecture & Pipeline Design**
**Status: ✅ Complete**

## Purpose
Turn the chosen approach into a concrete blueprint: components, data flow, interfaces/contracts, and the user-facing shape — detailed enough to build from.

## Process (repeatable)
1. **Draw the architecture** — the components and how a request flows through them.
2. **Define the contracts** — the interfaces and data shapes each component agrees to.
3. **Design the data pipeline** — how external data is read, transformed, and cached.
4. **Design the UX** — screens, states, and copy.
5. **Note cross-cutting concerns** — security, multi-tenancy, error/empty states.

## What we did on EarnedHome (Phase 1A)

### Architecture
```
Buyer (browser, mobile-friendly)
        │
        ▼
Next.js 14 app (React + TypeScript)  ──► Supabase (Postgres + RLS + Auth)
        │                                  · multi-tenant, white-label by host
        │                                  · leads, tenants, sessions
        ▼
PricingAdapter (interface)
   ├── stub      → deterministic demo math
   └── graph     → Microsoft Graph (Excel) ──► loan officer's RateStream workbook
                                               in M365 SharePoint (source of record)
```

### Contracts (the stable seam)
The whole app talks only to `PricingAdapter` (`src/lib/pricing/types.ts`):
- **`PricingInput`** — the 7+ inputs (`homePrice`, `downPct`, `creditBand`, `occupancy`, `sellerCredit`, `veteran`, `firstTime`, plus VA flags) mapped to `eh_in_*` named ranges.
- **`PricingProduct`** — per-product outputs: `displayName` (the sheet's own heading, e.g. "Jumbo 30 Year Fixed"), rate, APR, P&I, taxes, insurance, MI, total, and the **Estimated Funds** breakdown (`loanFees`, `prepaids`, `downPayment`, `lessSeller`, `cashToClose`).
- **`PricingQuote`** — `ratesAsOf`, products[], disclosures[], and which `engine` produced it.

Because the contract is fixed, swapping stub↔graph is **zero front-end change**.

### The pricing pipeline (graph adapter)
1. **Auth** — app-only OAuth (client credentials); token cached until ~1 min before expiry.
2. **Serialize** — a process-level lock so only one request touches the shared workbook at a time.
3. **Session** — open a non-persisting workbook session (`persistChanges:false`).
4. **Write inputs** — PATCH each `eh_in_*` named range (indexes/booleans into Form-Control linked cells; whole-percent → decimal conversion for down %).
5. **Recalculate** — `application/calculate` (Full).
6. **Read outputs** — for each of the 6 product blocks read `eh_out_<prefix>_*`; read **`$select=text`** for the date so it shows "June 20, 2026", not a serial number; tolerant reads (`getRangeOpt`) so a not-yet-created optional name never breaks the quote.
7. **Close session**, cache the quote (5-min TTL keyed on the inputs), return.

### Source-of-record design (SharePoint)
The workbook lives in a SharePoint document library configured with **versioning, require check-out, and content approval**. Daily updates use **Upload → Replace**, which keeps the **same Graph item id**, so the app needs no re-pointing when rates change. Named ranges are injected at the **XML level** to preserve the Excel Form Controls (an openpyxl rewrite would strip them).

### UX design
- **Input panel** with buyer-friendly labels ("How you'll use the home" rather than "Occupancy") and ⓘ info icons on the terms buyers ask about (Military/Veteran, First-Time Buyer, Seller Credit, Temporary Buydown).
- **Results as cards**, one per applicable product, each with the payment breakdown and Estimated Funds rows.
- A single **"Understanding your estimate"** info panel (one good explainer, not dozens of scattered tooltips).
- The **"Ways to Lower Your Payment"** educational panel below the cards — the educated-buyer feature — as tap-to-expand rows (mobile-friendly, not hover), each tied to an existing lever and routing to the loan officer. (Design source: `EarnedHome_Educated_Buyer_Panel_Copy.md`.)
- A polished **lead-capture modal** (keeps results on one screen; opens on demand).
- The **"rates as of" date** shown next to the results heading ("Your numbers") for freshness/trust.
- **Empty/edge states:** if no products qualify, show a routing message instead of blank cards.

### Cross-cutting
- **Security:** secrets only in env vars (never committed); Supabase RLS isolates tenant data.
- **Multi-tenant:** tenant resolved by host for white-label branding.
- **Compliance:** disclosures travel with every quote; lead form carries consent.

## AI's role in this phase
**Maturity: AI-Assisted.** AI proposed the `PricingAdapter` architecture and the stub/graph split, designed the read-write-recalc-read pipeline, and shaped the named-range contract — design-pattern generation and data-flow optimization per the model. It also suggested UX patterns (one "Understanding your estimate" panel instead of dozens of tooltips). The human approved the architecture and the UX direction.

## Key artifacts
- `src/lib/pricing/types.ts` (the contract).
- **The named-range map:** `RateStream_Named_Range_Map_v4.md` (91 tags: 14 inputs, shared `ratesAsOf`, 6 products × 12–13 outputs incl. the Estimated-Funds breakdown) + `EarnedHome_Pricing_Engine_Field_Mapping_v4.xlsx` + `EarnedHome_Named_Ranges_for_Richard.docx`.
- **Architecture / stack:** `EarnedHome_Data_Architecture`, `EarnedHome_Brand_and_Product_Architecture`, `Platform_Stack_Roadmap_1A_to_4`, `Pathfinder_1A_WhiteLabel_and_Tenancy_Design`, `White_Label_and_URL_Model_Design_Note.md`.
- The SharePoint source-of-record configuration.
- UI design decisions realized in `src/components/PathfinderTool.tsx`.
- See [08-references.md](08-references.md) for the full artifact index.
