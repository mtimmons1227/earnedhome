# Artifacts & Reference Index
**Where the supporting documents live, organized by SDLC phase.**

This folder is the home for **reference documents and deliverables** that support the SDLC narrative in [`../sdlc/`](../sdlc/README.md). Two kinds of files belong here:

- **In-repo reference docs** — searchable/editable Markdown copies of mappings, notes, and specs (the Word version, when one exists, is the polished deliverable).
- **Deliverables (Word)** — polished documents handed to a partner/reviewer; these stay in `.docx` form.

> **Repo vs. internal workspace.** Many of EarnedHome's working artifacts (partner-identifying or proprietary `.docx`/`.xlsx` files) deliberately live in the **internal R Parry Financial project workspace**, *not* in this public repo. They are listed below so the full paper trail is discoverable. Where a file is safe to keep here, place it in this folder and link it from the relevant phase doc.

---

## Phase 1 — Planning
- `EarnedHome_Phase1A_Scope_OnePager.docx` — scope, in/out of Phase 1A. *(internal workspace)*
- `Pathfinder_1A_Investor_Brief.docx`, `Pathfinder_1A_Cost_Revenue_and_Raise.docx` — business framing. *(internal workspace)*
- `EarnedHome_Educated_Buyer_Panel_Copy.md` — the "Ways to Lower Your Payment" educated-buyer spec. *(internal workspace)*

## Phase 2 — Analysis
- `EarnedHome_Phase1A_Design_Document.docx` — the requirements + design narrative. *(internal workspace)*
- `Pathfinder_1A_UI_Copy_and_Labels.docx`, `Guided_Wizard_Flow_Spec.md` — UX requirements & copy. *(internal workspace)*
- `Pathfinder_1A_Phased_Build_Plan.docx`, `EarnedHome_Phase1A_Budget.xlsx` — feasibility, phasing, cost. *(internal workspace)*
- `Pathfinder_1A_Compliance_Review_Log.docx`, `R Parry Financial — Rate Disclosure (CANONICAL).docx` — compliance. *(internal workspace)*
- In-repo: `src/lib/pricing/types.ts` (the `PricingAdapter` contract).

## Phase 3 — Design
- **Mapping (the engine contract):**
  - `RateStream_Named_Range_Map_v4.md` — the canonical 91-tag named-range map (inputs, shared `ratesAsOf`, 6 products × outputs incl. Estimated-Funds). *(internal workspace — keep a Markdown copy here when brought into the repo)*
  - `EarnedHome_Pricing_Engine_Field_Mapping_v4.xlsx` — the field-map spreadsheet. *(internal workspace)*
  - `EarnedHome_Named_Ranges_for_Richard.docx` — partner-facing cell map (deliverable). *(internal workspace)*
- **Stack / architecture:** `EarnedHome_Data_Architecture.docx`, `EarnedHome_Brand_and_Product_Architecture.docx`, `Platform_Stack_Roadmap_1A_to_4.docx`, `Pathfinder_1A_WhiteLabel_and_Tenancy_Design.docx`, `White_Label_and_URL_Model_Design_Note.md`, `EarnedHome_Revenue_Stack.docx`. *(internal workspace)*
- In-repo: [`../ARCHITECTURE.md`](../ARCHITECTURE.md), [`../PRICING_ENGINE.md`](../PRICING_ENGINE.md), [`../ENVIRONMENT_ARCHITECTURE.md`](../ENVIRONMENT_ARCHITECTURE.md), [`../INFRASTRUCTURE.md`](../INFRASTRUCTURE.md), `src/lib/pricing/types.ts`.

## Phase 4 — Implementation
- In-repo: `src/lib/pricing/{types,stub,graph,disclosures}.ts`, `src/components/PathfinderTool.tsx`, `src/app/globals.css`, `scripts/*`, `package.json`.
- `Pathfinder_1A_UI_Prototype.html` — the original prototype the UI was ported from. *(internal workspace)*

## Phase 5 — Testing
- In-repo: `scripts/test-tags.ts`, `scripts/test-va.ts`, `scripts/find-sharepoint-file.ts`; [`../sdlc/05a-qa-test-plan.md`](../sdlc/05a-qa-test-plan.md).
- Golden reference: the live RateStream workbook (app reconciled to it, to the dollar).

## Phase 6 — Deployment
- In-repo: [`../HOW_TO_DEPLOY.md`](../HOW_TO_DEPLOY.md), [`../RUNBOOK_connect_graph_engine.md`](../RUNBOOK_connect_graph_engine.md), [`../specs/workbook-swap-tool.md`](../specs/workbook-swap-tool.md).
- Netlify project config + environment variables (host-side).
- `Richard_Daily_RateStream_Update_Guide` (.md/.docx) — the daily rate-update runbook (deliverable). *(internal workspace)*

## Phase 7 — Maintenance
- In-repo: [`../CHANGE_SIGNOFF_LOG.md`](../CHANGE_SIGNOFF_LOG.md).
- `Build_Status_2026-06-06_Live_Pilot.md`, `00_START_HERE_Project_Context.md` — continuity logs. *(internal workspace)*
- SharePoint version history + Netlify deploy history (dual rollback).

## Phase 8 — Future Releases
- In-repo: [`../ROADMAP_PHASE_2_3.md`](../ROADMAP_PHASE_2_3.md), [`../specs/multi-loan-officer-routing.md`](../specs/multi-loan-officer-routing.md).
- `Agentic_AI_Roadmap.md` — the AI/agentic maturity path. *(internal workspace)*

## Compiled deliverable
- `EarnedHome_SDLC_Documentation.docx` — the full SDLC narrative (Planning → Future Releases) compiled into a single polished Word document for reviewers. Generated from the Markdown in [`../sdlc/`](../sdlc/README.md); regenerate when the Markdown changes.

---

*If a referenced file moves or is renamed, update this index. It is the map from the SDLC narrative to the actual working documents.*
