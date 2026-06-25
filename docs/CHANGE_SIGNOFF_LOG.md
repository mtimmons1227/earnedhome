# Change Sign-off Log — EarnedHome

Running record of changes that need **Richard's (and where noted, counsel's) sign-off before they reach production** (the live Netlify site). Nothing on this list goes live until its status is **Approved → Live**.

**Status flow:** `Draft (dev)` → `In preview` (private link sent for review) → `Approved` (Richard/counsel OK'd) → `Live` (merged to `main`, deployed).

| # | Date | Change | Files / area | Branch | Status | Approved by / date |
|---|------|--------|--------------|--------|--------|--------------------|
| 1 | 2026-06-09 | Replaced placeholder buyer-tool disclosures with **R Parry's canonical rate-disclosure language** (advertisement/not-an-LE, APR definition, rate variability, MI & tax/insurance/flood assumptions, not-a-credit-decision, nontraditional products, licensing). Centralized as one shared source used by both pricing engines. Surfaces **NMLS #1924318 (LLC)** and **#927662 (Richard)** + Equal Housing. | `src/lib/pricing/disclosures.ts` (new), `stub.ts`, `graph.ts` | `dev` | **Draft — pending Richard preview + sign-off** | — |
| 2 | 2026-06-24 | **Loan eligibility tiers + greyed-out ineligible cards.** Conventional conforming + **Jumbo Tier 1/2** (680/700 credit, 89.99%/80% LTV) + >$3.5M LO-only; FHA ≤$573,361; **VA + VA-Jumbo** tiers (640/680 credit, >$2.5M ineligible). Ineligible products shown greyed with the reason. **Richard must confirm the limits/credit floors/LTV caps match his lending matrix** before production. | `src/lib/eligibility.ts`, `src/components/PathfinderTool.tsx` | `dev` | **Draft — pending Richard confirm numbers** | — |
| 3 | 2026-06-24 | **Seller Credit hidden** — default to $0 and remove from the buyer view in 1A (logic retained for later). Decided with Marvin; *not yet built.* | `src/components/PathfinderTool.tsx` (planned) | — | **Planned — to build** | — |

## Notes
- Source of the disclosure wording: `R Parry Financial LLC - Disclosure for Rate Calculation.docx` (R Parry Financial OneDrive → 06 Pathfinder 1A). Wording grouped into paragraphs; **not paraphrased** — confirm nothing material was dropped.
- How Richard reviews each item: see "sign-off options" — local screen-share, an exported copy doc, or a Netlify **deploy preview** link (preview ≠ production).
- A change is only marked **Live** after it is merged to `main` and the deploy is confirmed.
