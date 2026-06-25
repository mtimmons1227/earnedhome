# EarnedHome — Software Development Lifecycle (SDLC)

_How this product was built, phase by phase, using the standard 8-phase SDLC. Each phase explains its repeatable process and records what was actually done on EarnedHome Phase 1A._

EarnedHome is a homebuyer mortgage-readiness and live-pricing tool. A buyer enters their scenario; the app returns real mortgage payment options (Conventional, FHA, VA, and their Jumbo variants) plus estimated cash-to-close, then routes the buyer to a loan officer. The pricing engine is the loan officer's own Excel workbook, driven live through Microsoft Graph — "the spreadsheet is the engine."

## Start here
**[00-ai-in-the-sdlc.md](00-ai-in-the-sdlc.md)** — the framework: the SDLC phases, AI's role in each, the AI-maturity ladder (Assisted → Autonomous → Agentic), and where EarnedHome sits. Read this for the *how AI was used* story.

## The phases

| # | Phase | Doc | Status |
|---|---|---|---|
| 1 | Planning | [01-planning.md](01-planning.md) | ✅ Complete |
| 2 | Analysis | [02-analysis.md](02-analysis.md) | ✅ Complete |
| 3 | Design | [03-design.md](03-design.md) | ✅ Complete |
| 4 | Implementation | [04-implementation.md](04-implementation.md) | ✅ Complete |
| 5 | Testing | [05-testing.md](05-testing.md) · [QA plan](05a-qa-test-plan.md) | ✅ QA complete · partner UAT of copy pending |
| 6 | Deployment | [06-deployment.md](06-deployment.md) | 🔄 In progress (on stub; flip to live engine on Netlify) |
| 7 | Maintenance | [07-maintenance.md](07-maintenance.md) | ⏳ Begins at go-live |
| 8 | Future Releases | [08-future-releases.md](08-future-releases.md) | 🗺️ Planned (roadmap) |

**Where Phase 1A stands:** Planning through **Implementation and QA Testing are done** — the app is built and the live pricing engine is verified against the source workbook to the dollar. Remaining: flip production to the live engine on Netlify (Deployment), the partner's RESPA review of the educational copy (UAT), then ongoing Maintenance. Phase 8 records what's planned next.

**Supporting artifacts:** the [artifact index](../artifacts/README.md) maps this narrative to the actual working documents (the named-range mapping, the stack/architecture docs, the requirements and educated-buyer specs, compliance logs).

## How to read these
Each phase doc follows the same shape so a manager can skim any one in a couple of minutes:
1. **Purpose** — what the phase is for, in one line.
2. **Process** — the repeatable steps (works for the next feature/phase too).
3. **What we did on EarnedHome** — the concrete record for Phase 1A.
4. **AI's role in this phase** — what AI did, and at what maturity level.
5. **Key artifacts** — the files/tools produced.

## Tech stack at a glance
- **Front end / app:** Next.js 14 (React + TypeScript), hosted on Netlify (CI/CD from GitHub).
- **Data / auth:** Supabase (Postgres, Row-Level Security, Auth) — multi-tenant, white-label by host.
- **Pricing engine:** the loan officer's Excel workbook in Microsoft 365 SharePoint, read/written live via the **Microsoft Graph** Excel API using **named ranges** (`eh_in_*` inputs, `eh_out_*` outputs).
- **Pattern:** a `PricingAdapter` interface with two implementations — a `stub` (deterministic demo math) and `graph` (the live workbook), swapped by one env var.
