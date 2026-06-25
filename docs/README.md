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

### Other in-repo docs
Deeper technical references that the phase docs link to: [`ARCHITECTURE.md`](ARCHITECTURE.md), [`PRICING_ENGINE.md`](PRICING_ENGINE.md), [`ENVIRONMENT_ARCHITECTURE.md`](ENVIRONMENT_ARCHITECTURE.md), [`INFRASTRUCTURE.md`](INFRASTRUCTURE.md), [`HOW_TO_DEPLOY.md`](HOW_TO_DEPLOY.md), [`RUNBOOK_connect_graph_engine.md`](RUNBOOK_connect_graph_engine.md), [`CHANGE_SIGNOFF_LOG.md`](CHANGE_SIGNOFF_LOG.md), [`ROADMAP_PHASE_2_3.md`](ROADMAP_PHASE_2_3.md), and the feature specs in [`specs/`](specs/).

## The standard, in one line
**Markdown is the source of truth; Word is the polished output generated from it.** Edit the Markdown; regenerate Word deliverables when you need something to hand off.
