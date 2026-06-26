# Change Sign-off Log — EarnedHome

Running record of changes that need **Richard's (and where noted, counsel's) sign-off before they reach production** (the live Netlify site). Nothing on this list goes live until its status is **Approved → Live**.

**Status flow:** `Draft (dev)` → `In preview` (private link sent for review) → `Approved` (Richard/counsel OK'd) → `Live` (merged to `main`, deployed).

| # | Date | Change | Files / area | Branch | Status | Approved by / date |
|---|------|--------|--------------|--------|--------|--------------------|
| 1 | 2026-06-09 | Replaced placeholder buyer-tool disclosures with **R Parry's canonical rate-disclosure language** (advertisement/not-an-LE, APR definition, rate variability, MI & tax/insurance/flood assumptions, not-a-credit-decision, nontraditional products, licensing). Centralized as one shared source used by both pricing engines. Surfaces **NMLS #1924318 (LLC)** and **#927662 (Richard)** + Equal Housing. | `src/lib/pricing/disclosures.ts` (new), `stub.ts`, `graph.ts` | `dev` | **Draft — pending Richard preview + sign-off** | — |
| 2 | 2026-06-24 | **Loan eligibility tiers + greyed-out ineligible cards.** Conventional conforming + **Jumbo Tier 1/2** (680/700 credit, 89.99%/80% LTV) + >$3.5M LO-only; FHA ≤$573,361; **VA + VA-Jumbo** tiers (640/680 credit, >$2.5M ineligible). Ineligible products shown greyed with the reason. **Richard must confirm the limits/credit floors/LTV caps match his lending matrix** before production. | `src/lib/eligibility.ts`, `src/components/PathfinderTool.tsx` | `dev` | **Draft — pending Richard confirm numbers** | — |
| 3 | 2026-06-24 | **Seller Credit hidden** — default to $0 and remove from the buyer view in 1A (logic retained for later). Decided with Marvin; *not yet built.* | `src/components/PathfinderTool.tsx` (planned) | — | **Planned — to build** | — |
| 4 | 2026-06-25 | **Forgot-password (loan-officer only)** — built + verified locally; hidden behind `NEXT_PUBLIC_ENABLE_PASSWORD_RESET` (off). **GATE before enabling in production:** (a) **Resend SMTP** configured in Supabase (built-in email is rate-limited — *Resend deferred per Marvin June 25*), (b) QA+prod redirect URLs added, (c) recommended `token_hash` recovery template for cross-device. Buyers have no accounts; not buyer-facing. | `src/app/login/page.tsx`, `src/app/reset-password/page.tsx`, `src/app/auth/callback/route.ts` | `dev` | **Flag-OFF — blocked on Resend SMTP before go-live** | — |
| 5 | 2026-06-25 | **Jumbo Tier 1 "down needed" wording** — greyed-card message now reads **"needs at least 10.01% down"** (true 89.99% LTV minimum) instead of a misleading "10%". Buyer-facing copy. | `src/lib/eligibility.ts` | `dev` | **Draft — Richard FYI/confirm with A2 (eligibility)** | — |
| 6 | 2026-06-25 | **Per-tenant identity in disclosure** — disclosure identity line will render the tenant's `legal_name` / `company_nmls` / `originator_name` / `nmls` (R Parry values seeded via `0005`). Richard to confirm the values are correct. Legal prose unchanged. | `supabase/migrations/0005_tenant_identity.sql` (+ pending disclosure-templating code) | `dev` (DB applied) | **Draft — pending Richard confirm values** | — |

## Notes
- Source of the disclosure wording: `R Parry Financial LLC - Disclosure for Rate Calculation.docx` (R Parry Financial OneDrive → 06 Pathfinder 1A). Wording grouped into paragraphs; **not paraphrased** — confirm nothing material was dropped.
- How Richard reviews each item: see "sign-off options" — local screen-share, an exported copy doc, or a Netlify **deploy preview** link (preview ≠ production).
- A change is only marked **Live** after it is merged to `main` and the deploy is confirmed.
