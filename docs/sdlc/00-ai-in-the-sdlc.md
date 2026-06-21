# AI in the SDLC — Framework & How We Applied It
**The conceptual model behind these docs, and where EarnedHome sits on it.**

This document frames *how* AI was used across EarnedHome's development. It presents the traditional 7-phase SDLC, AI's role in each phase, the AI-maturity ladder, and a crosswalk to the phase docs in this folder. The phase docs (`01`–`07`) carry the concrete, project-specific record; this one carries the framework.

---

## The traditional SDLC (7 phases)

1. **Planning & Feasibility** — defining goals, scope, and resources.
2. **Requirements Gathering & Analysis** — identifying user needs and functional specifications.
3. **Design** — creating system architecture and data models.
4. **Implementation (Development)** — writing and coding the software.
5. **Testing** — validating functionality, performance, and security.
6. **Deployment** — releasing the software to production.
7. **Maintenance** — updating and supporting the system over time.

## AI's role in each phase (general model)

| Phase | How AI contributes |
|---|---|
| Planning & Feasibility | Predictive analytics and pattern recognition to estimate timelines, resources, and risks. |
| Requirements & Analysis | NLP over user feedback, conversations, and historical data to extract and refine requirements. |
| Design | Generating design patterns, suggesting architectures, optimizing data flow. |
| Development | AI-assisted coding (LLM copilots) to speed coding, suggest functions, improve consistency. |
| Testing | Auto-generating test cases, detecting edge cases, performing automated QA. |
| Deployment | Optimizing pipelines, predicting failures, monitoring performance. |
| Maintenance | Continuously scanning for vulnerabilities, detecting anomalies, automating incident response. |

## The AI-maturity ladder

- **AI-Assisted Development** — AI supports tasks (documentation, code completion, testing) while humans drive; frees developers for higher-level work.
- **AI-Autonomous Development** — AI generates whole applications from requirements, with human oversight on critical decisions.
- **Agentic SDLC** — autonomous AI agents collaborate, automate decisions, and enable self-optimizing systems.

**The principle:** AI SDLC is not a replacement for the traditional SDLC — it's an *enhancement* that embeds AI into each phase to automate, optimize, and accelerate, while keeping human expertise on the critical calls.

---

## Where EarnedHome sits

EarnedHome was built at the **AI-Assisted** level, with deliberate human oversight on every consequential decision. AI (an LLM development assistant) was used as a pair-programmer, analyst, and technical writer across all seven phases; a human owned scope, architecture sign-off, partner/compliance decisions, and verified every change. A few phases lean toward **agentic operations** — e.g., scheduled tasks that watch rates and route leads — but those run under human-approved guardrails.

Honest framing for reviewers: this project demonstrates **effective human-in-the-loop AI engineering**, not autonomous code generation. The value shown is judgment about *where* AI accelerates (integration boilerplate, test scaffolding, documentation, risk enumeration) versus *where* humans must stay in control (pricing accuracy, compliance, partner IP, production config).

### Benefits we actually realized
- **Faster time-to-market** — adapter, integration, UI, and this documentation set produced quickly.
- **Higher quality / fewer errors** — type-safe contracts plus AI-generated checks caught real defects (the down-% unit bug, the date serial-number bug, the missing-Jumbo bug).
- **Less manual repetitive labor** — named-range tagging, test scripts, and runbooks were AI-drafted.
- **Data-driven decisions** — golden-value reconciliation against the source workbook, to the dollar.

### Challenges we actively managed
- **Overreliance / loss of oversight** → every AI edit was human-reviewed; "verify after every edit" became a rule after an editing tool once truncated files.
- **Bias / explainability** → pricing logic is *not* AI-generated; it stays in the partner's auditable workbook (the source of truth), so the numbers are explainable and owned by a licensed professional.
- **Fragmented, ungoverned tooling** → one stable `PricingAdapter` seam, one source of record (SharePoint with versioning/approval), secrets only in env stores.

---

## Crosswalk — 7-phase model → these docs

| Traditional phase | AI-era name | Covered in |
|---|---|---|
| 1. Planning & Feasibility | Feasibility & Approach Analysis | [01-requirements.md](01-requirements.md) (planning/scope) + [02-analysis.md](02-analysis.md) (feasibility) |
| 2. Requirements & Analysis | Problem Framing & Data Requirements | [01-requirements.md](01-requirements.md) |
| 3. Design | Solution Architecture & Pipeline Design | [03-design.md](03-design.md) |
| 4. Implementation | Build & Integration | [04-development.md](04-development.md) |
| 5. Testing | Evaluation & Validation (Evals + UAT) | [05-testing.md](05-testing.md) |
| 6. Deployment | Deployment & Operations (LLMOps/MLOps) | [06-implementation.md](06-implementation.md) |
| 7. Maintenance | Continuous Operations & Assurance | [07-maintenance.md](07-maintenance.md) |

Each phase doc closes with an **"AI's role in this phase"** section recording what AI actually did on EarnedHome and at what maturity level.

---

## Sources (framework)
- Practical Logix — AI across the SDLC (requirements, planning).
- Snyk — Complete Guide to AI-Powered Software Development (design, testing, deployment, maintenance).
- IBM — AI in the SDLC (development).
- AWS — AI-Driven Development Life Cycle (AI-assisted vs. AI-autonomous).
- Sutherland — AI SDLC / Agentic SDLC (agentic model, governance challenges).
