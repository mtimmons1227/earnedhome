# Phase 1 — Planning
**Also known as (AI-era): Problem Framing & Scope Definition**
**Status: ✅ Complete**

## Purpose
Identify the *scope and purpose* of the software before any code: what we're building, why, who it's for, and what "in scope" means for this release.

## Process (repeatable)
1. **Frame the problem** in one sentence and name the primary user.
2. **State the mission** — the outcome the product exists to create.
3. **Set the scope** — what is in, and explicitly out, of this phase.
4. **Name the success criteria** at a high level (a number or a yes/no).
5. **Capture constraints** — legal/compliance, platforms, partners.
6. **Record assumptions and open questions** so they're tracked, not lost.

## What we did on EarnedHome (Phase 1A)

**Problem.** Homebuyers don't know what they actually qualify for, don't understand the levers that move their payment, and loan officers spend time hand-quoting scenarios. EarnedHome lets a buyer self-serve a real, loan-officer-backed payment estimate and then connects them to that loan officer.

**The mission — the "educated buyer."** EarnedHome's name is the thesis: a buyer should arrive at the closing table *educated* and mortgage-*ready*, not just handed a number. The product's job isn't a one-time quote — it's to teach the buyer how the numbers work and what they can do about them, then hand a warmer, better-informed lead to the loan officer. This is delivered by a **"Ways to Lower Your Payment"** educational panel on the results screen: tap-to-expand, plain-language items (ask the seller for closing-cost help; put more down or use a temporary buydown; compare a 30- vs 15-year loan; strengthen credit), each tied to a lever already in the tool and each routing to the licensed loan officer for specifics. The copy is deliberately **general and educational — not personalized advice** — to stay clear of steering/RESPA/UDAAP concerns.

**Primary users.** (1) The homebuyer running scenarios; (2) the loan officer (partner) whose pricing drives the numbers and who receives the lead.

**Scope of Phase 1A (in).** A working buyer tool that returns live payment options across the products the loan officer prices — 30/15-yr Conventional, 30/15-yr FHA, 30/15-yr VA, and their **Jumbo** variants — with a full monthly-payment and cash-to-close breakdown, the educational panel, and lead capture. Multi-tenant / white-label so each partner runs a branded instance.

**Scope of Phase 1A (out).** AI/LLM features, a 60-day readiness-plan generator, multi-loan-officer routing, and automated lead fan-out are **not** in this phase — they are recorded in [08-future-releases.md](08-future-releases.md).

**High-level success criteria.**
- Numbers shown match the loan officer's workbook **to the dollar**.
- All applicable products render, including Jumbo with correct dynamic headings.
- A buyer can get from inputs → options → "connect me" without leaving the page.
- The estimate carries a visible **"rates as of"** date so the buyer knows it's current.

**Constraints (overview).**
- **Compliance:** lead capture needs TCPA consent; figures are estimates with RESPA-appropriate disclosures; final terms come from the loan officer.
- **Multi-tenant / white-label:** each loan-officer partner gets their own branded instance.
- **Mobile-friendly:** buyers arrive on phones.

**Key assumption (logged):** the workbook exposes all product output blocks at once, so one recalculation yields every card. (Validated later — see [05-testing.md](05-testing.md).)

## AI's role in this phase
**Maturity: AI-Assisted.** An LLM development assistant helped frame the problem, articulate the educated-buyer mission, and draft the scope boundary (in vs. out of Phase 1A), and maintained the running build-status / continuity log. A human owned scope, the success criteria, and the partner/compliance constraints.

## Key artifacts
- **Scope & business framing:** `EarnedHome_Phase1A_Scope_OnePager.docx`, `Pathfinder_1A_Investor_Brief.docx`, `Pathfinder_1A_Cost_Revenue_and_Raise.docx`.
- **Educated-buyer requirement:** `EarnedHome_Educated_Buyer_Panel_Copy.md` ("Ways to Lower Your Payment").
- The continuity / build-status log maintained across the project.
- See the [artifact index](../artifacts/README.md) for the full list.
