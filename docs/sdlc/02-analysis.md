# Phase 2 — Analysis
**AI-era name: Feasibility & Approach Analysis**
**Status: ✅ Complete**

## Purpose
Decide *how* we'll satisfy the requirements: weigh options, pick an approach, and surface the risks before committing to a design.

## Process (repeatable)
1. **Enumerate approaches** for the hard part of the problem.
2. **Score each** against effort, accuracy, maintainability, and risk.
3. **Pick one** and write down *why* (and why not the others).
4. **Identify technical risks** and how each is mitigated.
5. **Confirm feasibility** with a small spike/proof before full design.

## What we did on EarnedHome (Phase 1A)

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
- **Concurrency on a single shared workbook** → use short-lived, non-persisting Graph **workbook sessions** plus an in-process **serialization lock** so requests don't stomp each other.
- **Latency / rate limits** → a short **TTL cache** keyed on the input set; **429/503 backoff** with `retry-after`.
- **Stale or volatile rates** → read and display a **"rates as of"** stamp from the sheet; cache TTL kept short (5 min).
- **Form controls in the workbook** (credit/occupancy are driven by Excel Form Controls via *linked cells*) → write the **index/boolean to the linked cell**, never the control; preserve controls when tagging named ranges.
- **Unit mismatches** (e.g. down payment %) → pin the contract: UI sends whole percent, the adapter converts to the decimal the sheet expects.
- **Conforming vs. Jumbo** → let the **sheet** decide via its own `=IF(loan>limit,…)` headers; the app reads the heading text rather than re-deriving limits.

### Feasibility confirmed
A spike read/wrote named ranges, recalculated, and read every product block back in one pass — confirming the "all blocks at once" assumption and the end-to-end Graph round-trip were viable.

## AI's role in this phase
**Maturity: AI-Assisted.** AI helped enumerate and score the three pricing approaches, pattern-matched the "drive the live workbook" solution, and surfaced the risk list (concurrency, caching, Form-Control linked cells, unit mismatches, Jumbo handling) — the predictive/pattern-recognition contribution the model describes for feasibility. The human made the final approach call and accepted the risks.

## Key artifacts
- The approach decision (workbook-as-engine) recorded in `src/lib/pricing/graph.ts` header notes.
- The adapter contract (`PricingAdapter`) and the stub/graph split.
- Risk list carried into Design (sessions, lock, cache, backoff, linked cells).
