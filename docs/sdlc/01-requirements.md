# Phase 1 — Requirements
**AI-era name: Problem Framing & Use-Case / Data Requirements**
**Status: ✅ Complete**

## Purpose
Decide *what* we're building and *why*, who it's for, what "done" looks like, and what data the system depends on — before any code.

## Process (repeatable)
1. **Frame the problem** in one sentence and name the primary user.
2. **Capture use cases** as short "a user can…" statements.
3. **Define success criteria** that are observable (a number or a yes/no), not vague.
4. **List data requirements** — every input the system consumes and every output it must produce, plus where the source-of-truth lives.
5. **Capture constraints** — legal/compliance, performance, platforms, partners.
6. **Record assumptions and open questions** so they're tracked, not lost.

## What we did on EarnedHome (Phase 1A)
**Problem.** Homebuyers don't know what they actually qualify for, don't understand the levers that move their payment, and loan officers spend time hand-quoting scenarios. EarnedHome lets a buyer self-serve a real, loan-officer-backed payment estimate and then connects them to that loan officer.

**The mission — the "educated buyer."** EarnedHome's name is the thesis: a buyer should arrive at the closing table *educated* and mortgage-*ready*, not just handed a number. The product's job isn't a one-time quote — it's to teach the buyer how the numbers work and what they can do about them, then hand a warmer, better-informed lead to the loan officer. Concretely, this is delivered by a **"Ways to Lower Your Payment"** educational panel on the results screen: tap-to-expand, plain-language items (ask the seller for closing-cost help; put more down or use a temporary buydown; compare a 30- vs 15-year loan; strengthen credit), each tied to a lever already in the tool and each routing to the licensed loan officer for specifics. The copy is deliberately **general and educational — not personalized advice** — to stay clear of steering/RESPA/UDAAP concerns. (Source: `EarnedHome_Educated_Buyer_Panel_Copy.md`.)

**Primary users.** (1) The homebuyer running scenarios; (2) the loan officer (partner) whose pricing drives the numbers and who receives the lead.

**Core use cases.**
- A buyer enters home price, down payment, credit band, occupancy, seller credit, and eligibility flags (military/veteran, first-time) and sees live payment options.
- Options span the products the loan officer prices: 30/15-yr Conventional, 30/15-yr FHA, 30/15-yr VA, and their **Jumbo** variants when the loan exceeds the conforming limit.
- Each option shows rate, APR, principal & interest, taxes, insurance, mortgage insurance, total monthly payment, and an **Estimated Funds** (cash-to-close) breakdown.
- The buyer learns how to lower their payment through the educational **"Ways to Lower Your Payment"** panel (no pressure, no personalized advice).
- The buyer connects to the loan officer through a lead-capture form.

**Success criteria.**
- Numbers shown match the loan officer's workbook **to the dollar**.
- All applicable products render, including Jumbo with correct dynamic headings.
- A buyer can get from inputs → options → "connect me" without leaving the page.
- The estimate carries a visible **"rates as of"** date so the buyer knows it's current.

**Data requirements.** The pricing logic is the loan officer's existing Excel workbook ("RateStream") — it is the **source of truth**, not something we re-implement. Inputs and outputs were specified as a fixed contract of **named ranges** (`eh_in_*` for the 7 inputs, `eh_out_*` per product for rate/APR/P&I/taxes/insurance/MI/total and the funds breakdown). The workbook updates **daily** with fresh rates.

**Constraints.**
- **Compliance:** lead capture needs TCPA consent; figures are estimates with RESPA-appropriate disclosures; final terms come from the loan officer.
- **Multi-tenant / white-label:** each loan-officer partner gets their own branded instance.
- **Mobile-friendly:** buyers arrive on phones.

**Key assumption (logged):** the workbook exposes all product output blocks at once, so one recalculation yields every card. (Validated later — see Phase 5.)

## AI's role in this phase
**Maturity: AI-Assisted.** An LLM development assistant synthesized requirements from partner conversations and the workbook field map (NLP-style extraction), drafted the named-range input/output contract, and maintained the running build-status/continuity log. A human owned scope, success criteria, and the partner/compliance constraints.

## Key artifacts
- The named-range input/output contract (`eh_in_*` / `eh_out_*`), later realized in `src/lib/pricing/types.ts`.
- **Scope & requirements:** `EarnedHome_Phase1A_Scope_OnePager`, `EarnedHome_Phase1A_Design_Document`, `Pathfinder_1A_UI_Copy_and_Labels`, `Guided_Wizard_Flow_Spec`.
- **Educated-buyer requirement:** `EarnedHome_Educated_Buyer_Panel_Copy.md` ("Ways to Lower Your Payment").
- **Compliance:** `Pathfinder_1A_Compliance_Review_Log`, `R Parry Financial — Rate Disclosure (CANONICAL)`.
- The continuity / build-status log maintained across the project.
- See [08-references.md](08-references.md) for the full artifact index.
