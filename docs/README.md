# EarnedHome — Documentation

This folder is the documentation home for EarnedHome. It follows a **standard layout used across all of these projects** so that, in any repo, you always know where to look:

1. **This README** — what the product does and how the documentation is organized.
2. **[`sdlc/`](sdlc/README.md)** — the Software Development Lifecycle, phase by phase.
3. **[`artifacts/`](artifacts/README.md)** — the supporting reference documents and Word deliverables.

## What EarnedHome is
A homebuyer mortgage-readiness and live-pricing tool. A buyer enters their scenario and gets real, lender-backed payment options — Conventional, FHA, and VA, including Jumbo variants — with a full monthly-payment and cash-to-close breakdown, plus plain-language education on how to lower their payment, then connects to a loan officer. The pricing engine is the loan officer's own Excel workbook, driven live through Microsoft Graph ("the spreadsheet is the engine"). Multi-tenant and white-label: each lending partner runs a branded instance.

## How the documentation is organized

### `sdlc/` — the lifecycle
The project is documented across the standard 8 phases. Each phase doc has the same shape (Purpose → Process → What we did → AI's role → Key artifacts).

| # | Phase | What it covers |
|---|---|---|
| 1 | [Planning](sdlc/01-planning.md) | Scope and purpose of the software |
| 2 | [Analysis](sdlc/02-analysis.md) | Gathering requirements and analyzing them |
| 3 | [Design](sdlc/03-design.md) | Architecture and design |
| 4 | [Implementation](sdlc/04-implementation.md) | Writing and integrating the code |
| 5 | [Testing](sdlc/05-testing.md) | Verifying it meets the requirements |
| 6 | [Deployment](sdlc/06-deployment.md) | Releasing the software to users |
| 7 | [Maintenance](sdlc/07-maintenance.md) | Ongoing support and updates |
| 8 | [Future Releases](sdlc/08-future-releases.md) | Planned, not-yet-built work (roadmap) |

Start with [`sdlc/README.md`](sdlc/README.md) for the index and current status, or [`sdlc/00-ai-in-the-sdlc.md`](sdlc/00-ai-in-the-sdlc.md) for how AI was used across the lifecycle.

### `artifacts/` — reference docs & deliverables
The [artifact index](artifacts/README.md) maps each SDLC phase to its supporting documents — the named-range mapping, architecture and stack docs, compliance logs, partner deliverables, and the compiled SDLC Word document. Reference docs are kept as Markdown here (searchable/editable); polished client deliverables stay as Word.

### Operational & release
| Doc | Purpose |
|---|---|
| [`SESSION_HANDOFF.md`](SESSION_HANDOFF.md) | **Start here** — current build state (QA vs Prod), what shipped, open items, next steps. |
| [`PRODUCTION_GO_LIVE.md`](PRODUCTION_GO_LIVE.md) | Consolidated go-live runbook. |
| [`RELEASE_MANIFEST_QA.md`](RELEASE_MANIFEST_QA.md) | What's on QA awaiting Production + the sign-off / config checklist. |
| [`CHANGE_SIGNOFF_LOG.md`](CHANGE_SIGNOFF_LOG.md) | Running log of changes needing Richard's / counsel's sign-off. |
| [`HOW_TO_DEPLOY.md`](HOW_TO_DEPLOY.md) | Deploy procedure. |
| [`RUNBOOK_connect_graph_engine.md`](RUNBOOK_connect_graph_engine.md) | Connecting the Graph pricing engine. |

### Tenant onboarding
| Doc | Purpose |
|---|---|
| [`TENANT_ONBOARDING.md`](TENANT_ONBOARDING.md) | **The run script** — clone a tenant in 3 SQL blocks + 1 manual step. |
| [`TENANT_ONBOARDING_CHECKLIST.md`](TENANT_ONBOARDING_CHECKLIST.md) | Full reference checklist (what every tenant needs). |
| [`TENANT_TEMPLATE_AND_CLONE.md`](TENANT_TEMPLATE_AND_CLONE.md) | The template-tenant + clone approach, explained. |

### Architecture & technical
[`ARCHITECTURE.md`](ARCHITECTURE.md) · [`PRICING_ENGINE.md`](PRICING_ENGINE.md) · [`ENVIRONMENT_ARCHITECTURE.md`](ENVIRONMENT_ARCHITECTURE.md) · [`INFRASTRUCTURE.md`](INFRASTRUCTURE.md) · [`WHITE_LABEL_ARCHITECTURE.md`](WHITE_LABEL_ARCHITECTURE.md)

### Roadmap, specs & testing
[`ROADMAP_PHASE_2_3.md`](ROADMAP_PHASE_2_3.md) · feature specs in [`specs/`](specs/) (connect flow, eligibility, agent attribution, per-tenant pricing, workbook swap, multi-LO routing, …) · QA scripts: [`AGENT_ATTRIBUTION_QA_TEST.md`](AGENT_ATTRIBUTION_QA_TEST.md), [`sdlc/05a-qa-test-plan.md`](sdlc/05a-qa-test-plan.md).

## The standard, in one line
**Markdown is the source of truth; Word is the polished output generated from it.** Edit the Markdown; regenerate Word deliverables when you need something to hand off.
