# EarnedHome

**A homebuyer mortgage-readiness platform.** A buyer enters their scenario and gets real, lender-backed payment options — Conventional, FHA, and VA, including Jumbo variants — with a full monthly-payment and cash-to-close breakdown, plus plain-language education on **how to lower their payment**, then connects to a loan officer. The thesis is in the name: buyers should arrive *educated* and mortgage-*ready*, not just handed a number. Multi-tenant and white-label: each lending partner runs a branded instance.

> **Note for reviewers:** This is the public overview of a production project built with a lending partner. Partner identity, pricing logic, credentials, and proprietary workbook internals are intentionally **not** included here. The pricing model itself is the partner's IP and lives outside this repository. Start with the **documentation index** at [`docs/README.md`](docs/README.md); engineering decisions and the full SDLC are in [`docs/sdlc/`](docs/sdlc/README.md), and current build status is in [`docs/SESSION_HANDOFF.md`](docs/SESSION_HANDOFF.md).

---

## What makes it interesting (engineering highlights)

- **"The spreadsheet is the engine."** Rather than re-implementing (and inevitably drifting from) the partner's intricate, daily-updated pricing logic, the app drives the partner's own Excel workbook **live** through the Microsoft Graph API — reading and writing **named ranges**, recalculating, and reading every product back in one pass. The numbers match the source of truth by construction.
- **A single stable seam.** All pricing flows through one `PricingAdapter` interface with two implementations — a deterministic `stub` for local/demo work and a live `graph` adapter — swappable by a single environment variable, with **zero front-end change**.
- **Production-grade integration details.** App-only OAuth with token caching, non-persisting workbook sessions, a process-level concurrency lock over the shared workbook, 429/503 backoff, a short TTL cache, tolerant reads, and reading displayed *text* (not raw serial values) for correctly formatted dates.
- **Source-of-record operations.** The workbook lives in SharePoint with versioning, check-out, and content approval; daily rate updates use *Replace* (which preserves the file's id), so new rates flow through with no redeploy.

## Stack

- **Next.js 14** (App Router, React, TypeScript) — one codebase, mobile → full web.
- **Supabase** (Postgres + Auth + Storage) — multi-tenant via `tenant_id` + Row-Level Security.
- **Microsoft Graph (Excel)** — drives the partner's live workbook server-side, behind the pricing interface.
- **Netlify** — hosting + CI/CD from GitHub.

## Project layout

```
src/
  app/                buyer page, layout, API routes (/api/quote, /api/lead)
  components/         BrandHeader, PathfinderTool (the buyer tool UI)
  lib/
    pricing/          PricingAdapter contract + stub + live Graph adapter
    supabase/         server (RLS) + admin (service-role) clients
    tenant.ts         host → tenant resolution + branding
  middleware.ts       resolves tenant from request host
scripts/              connection checks + named-range tagging tooling
docs/sdlc/            full software development lifecycle, phase by phase
supabase/migrations/  versioned DDL (multi-tenant schema + RLS + seeds)
```

## The pricing contract

The app only ever calls `PricingAdapter` (`src/lib/pricing/types.ts`), whose fields mirror the workbook's named ranges (`eh_in_*` inputs / `eh_out_*` outputs). It's backed by `stubAdapter` (illustrative math — **not** real pricing) by default, or `graphAdapter` (the live workbook) when `PRICING_ADAPTER=graph`. Same contract, no UI change.

## Getting started

```
npm install
cp .env.example .env.local   # fill in values
npm run dev                  # http://localhost:3000
```

Test other tenants locally via the Host header:
```
curl -H "Host: acme.earnedhome.com" http://localhost:3000
```

**Development & deployment workflow** (local → GitHub → Netlify) is documented in [`CONTRIBUTING.md`](CONTRIBUTING.md). The as-built infrastructure (environments, database, pricing-engine config) is in [`docs/INFRASTRUCTURE.md`](docs/INFRASTRUCTURE.md).

## Environment

| Var | Purpose |
|-----|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe key (RLS-enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; trusted writes |
| `NEXT_PUBLIC_ROOT_DOMAIN` | Base domain for subdomain routing |
| `PRICING_ADAPTER` | `stub` (default) or `graph` |
| `GRAPH_*` | Microsoft Entra app + workbook ids (live engine) |

*Secrets live only in the host's environment store and a git-ignored `.env.local` — never in the repo.*

## How this was built

The full lifecycle is documented for review in **[`docs/sdlc/`](docs/sdlc/README.md)**. Start with **[how AI was used across the SDLC](docs/sdlc/00-ai-in-the-sdlc.md)** (the 7-phase model, AI's role per phase, and the AI-maturity ladder), then the phase docs — each paired with its modern AI-era name and closing with an "AI's role in this phase" note:

1. [Requirements — Problem Framing & Data Requirements](docs/sdlc/01-requirements.md)
2. [Analysis — Feasibility & Approach Analysis](docs/sdlc/02-analysis.md)
3. [Design — Solution Architecture & Pipeline Design](docs/sdlc/03-design.md)
4. [Development — Build & Integration](docs/sdlc/04-development.md)
5. [Testing — Evaluation & Validation (Evals + UAT)](docs/sdlc/05-testing.md)
6. [Deployment — Deployment & Operations (LLMOps/MLOps)](docs/sdlc/06-implementation.md)
7. [Maintenance — Continuous Operations & Assurance](docs/sdlc/07-maintenance.md)

**What's built vs. planned:** [`docs/ROADMAP_PHASE_2_3.md`](docs/ROADMAP_PHASE_2_3.md) is the honest ledger — Phase 1A is shipped; AI/LLM features, the 60-day readiness-plan generator, lead-handoff automation, and performance instrumentation are **planned (Phase II/III), not yet in the code.**

## Compliance

TCPA consent is captured with exact text + timestamp and is **required** to store or route a lead. Reg Z disclosures render with every quote. RESPA is treated as the legal gate before charging customers; fee structure is reviewed with counsel. Displayed figures are estimates; final terms come from the loan officer.
