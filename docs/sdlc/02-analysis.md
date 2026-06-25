# Phase 2 — Analysis
**Also known as (AI-era): Requirements & Feasibility Analysis**
**Status: ✅ Complete**

## Purpose
Gather the detailed requirements and analyze them: turn the scope from Planning into concrete use cases, a data contract, and a chosen technical approach — and surface the risks — before committing to a design.

## Process (repeatable)
1. **Capture use cases** as short "a user can…" statements.
2. **Specify data requirements** — every input the system consumes and every output it must produce, plus where the source-of-truth lives.
3. **Define detailed success criteria and constraints.**
4. **Enumerate approaches** for the hard part of the problem and **score each** against effort, accuracy, maintainability, and risk.
5. **Pick one** and write down *why* (and why not the others).
6. **Identify technical risks** and mitigations, then **confirm feasibility** with a small spike before full design.

## Part A — Requirements gathering

**Core use cases.**
- A buyer enters home price, down payment, credit band, occupancy, seller credit, and eligibility flags (military/veteran, first-time) and sees live payment options.
- Options span the products the loan officer prices: 30/15-yr Conventional, 30/15-yr FHA, 30/15-yr VA, and their **Jumbo** variants when the loan exceeds the conforming limit.
- Each option shows rate, APR, principal & interest, taxes, insurance, mortgage insurance, total monthly payment, and an **Estimated Funds** (cash-to-close) breakdown.
- The buyer learns how to lower their payment through the educational **"Ways to Lower Your Payment"** panel (no pressure, no personalized advice).
- The buyer connects to the loan officer through a lead-capture form.

**Data requirements.** The pricing logic is the loan officer's existing Excel workbook ("RateStream") — it is the **source of truth**, not something we re-implement. Inputs and outputs were specified as a fixed contract of **named ranges** (`eh_in_*` for the inputs, `eh_out_*` per product for rate/APR/P&I/taxes/insurance/MI/total and the funds breakdown). The workbook updates **daily** with fresh rates.

**Detailed success criteria.** Numbers match the workbook to the dollar; all applicable products render (incl. Jumbo with sheet-driven headings); the buyer completes inputs → options → connect on one screen; a visible "rates as of" date travels with every estimate.

**Constraints (detailed).**
- **Compliance:** TCPA consent on lead capture; RESPA-appropriate disclosures; final terms come from the loan officer; educational copy must avoid personalized advice/steering.
- **Multi-tenant / white-label:** tenant resolved by host; branded per partner.
- **Mobile-first:** buyers arrive on phones.

## Part B — Feasibility & approach analysis

### The central decision: where does pricing live?
The hardest question was how to produce real mortgage numbers. Three approaches were considered:

| Approach | Verdict |
|---|---|
| **Re-implement the loan officer's pricing logic in code** | Rejected. The logic is intricate, loan-officer-owned, and changes daily; a code copy would drift and create a compliance liability. |
| **Call a third-party pricing API** | Rejected for 1A. Doesn't reflect *this* loan officer's pricing, sheets, and overlays; adds cost and a dependency. |
| **Drive the loan officer's own Excel workbook live** ✅ | Chosen. "The spreadsheet is the engine." The workbook already *is* the trusted source; we read/write it through Microsoft Graph so the numbers are, by construction, the loan officer's own. |

**Why this wins:** zero logic duplication, the loan officer keeps full ownership and updates rates daily in a tool they know, and the app is guaranteed to match the sheet because it *is* the sheet.

### The adapter decision
To avoid coupling the UI to Microsoft Graph, we analyzed for a **`PricingAdapter` interface** with two implementations: a deterministic **`stub`** (fast local/demo math) and **`graph`** (the live workbook), switched by one env var (`PRICING_ADAPTER`). This lets the front end be built and demoed before the live workbook is wired, and keeps the integration swappable.

### Risks identified and mitigations
- **Concurrency on a single shared workbook** → short-lived, non-persisting Graph **workbook sessions** plus an in-process **serialization lock**.
- **Latency / rate limits** → a short **TTL cache** keyed on the input set; **429/503 backoff** with `retry-after`.
- **Stale or volatile rates** → read and display a **"rates as of"** stamp; keep cache TTL short (5 min).
- **Form controls in the workbook** (credit/occupancy via Excel Form Controls + linked cells) → write the **index/boolean to the linked cell**, never the control; preserve controls when tagging named ranges.
- **Unit mismatches** (e.g. down-payment %) → pin the contract: UI sends whole percent, the adapter converts to the decimal the sheet expects.
- **Conforming vs. Jumbo** → let the **sheet** decide via its own `=IF(loan>limit,…)` headers; the app reads the heading text rather than re-deriving limits.

### Feasibility confirmed
A spike read/wrote named ranges, recalculated, and read every product block back in one pass — confirming the "all blocks at once" assumption and the end-to-end Graph round-trip were viable.

## AI's role in this phase
**Maturity: AI-Assisted.** AI synthesized requirements from partner conversations and the workbook field map (NLP-style extraction), drafted the named-range input/output contract, then helped enumerate and score the three pricing approaches and surfaced the risk list (concurrency, caching, Form-Control linked cells, unit mismatches, Jumbo handling). The human made the final approach call and accepted the risks.

## Key artifacts
- The named-range input/output contract (`eh_in_*` / `eh_out_*`), later realized in `src/lib/pricing/types.ts`.
- The approach decision (workbook-as-engine) recorded in `src/lib/pricing/graph.ts` header notes.
- **Requirements & UX specs:** `EarnedHome_Phase1A_Design_Document.docx`, `Pathfinder_1A_UI_Copy_and_Labels.docx`, `Guided_Wizard_Flow_Spec.md`.
- **Feasibility / phasing:** `Pathfinder_1A_Phased_Build_Plan.docx`, `EarnedHome_Phase1A_Budget.xlsx`.
- **Compliance:** `Pathfinder_1A_Compliance_Review_Log.docx`, `R Parry Financial — Rate Disclosure (CANONICAL).docx`.
- See the [artifact index](../artifacts/README.md) for the full list.
