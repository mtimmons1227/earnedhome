# Artifact Index & References
**Where the supporting documents live, organized by SDLC phase.**

These are the working artifacts produced across the project. They live in the **internal project workspace** (the private R Parry Financial project folder), not in this repository — partner-identifying and proprietary material is intentionally kept out of the code repo. This index exists so a reviewer (or a future session) can confirm the full paper trail exists and find each piece.

> **Repo vs. workspace:** files ending in `.ts`/`.tsx`/`.css` are in this repository. Files ending in `.docx`/`.xlsx`/`.md` (other than these SDLC docs) live in the internal project workspace under the listed folder.

---

## Phase 1 — Requirements / Planning
- `EarnedHome_Phase1A_Scope_OnePager.docx` — scope, in/out of Phase 1A.
- `EarnedHome_Phase1A_Design_Document.docx` — the requirements + design narrative.
- `Pathfinder_1A_Investor_Brief.docx`, `Pathfinder_1A_Cost_Revenue_and_Raise.docx` — business framing.
- `Pathfinder_1A_UI_Copy_and_Labels.docx`, `Guided_Wizard_Flow_Spec.md` — UX requirements & copy.
- **Educated buyer:** `EarnedHome_Educated_Buyer_Panel_Copy.md` — the "Ways to Lower Your Payment" panel (the educated-buyer feature spec).
- **Compliance:** `Pathfinder_1A_Compliance_Review_Log.docx`, `R Parry Financial — Rate Disclosure (CANONICAL).docx`.

## Phase 2 — Analysis / Feasibility
- `Pathfinder_1A_Phased_Build_Plan.docx` — phasing & feasibility.
- `Agentic_AI_Roadmap.md` — where AI/agentic capability is headed (maturity path).
- `EarnedHome_Phase1A_Budget.xlsx` — resource/cost feasibility.

## Phase 3 — Design / Architecture
- **Mapping (the engine contract):**
  - `RateStream_Named_Range_Map_v4.md` — the canonical 91-tag named-range map (inputs, shared `ratesAsOf`, 6 products × outputs incl. Estimated-Funds).
  - `EarnedHome_Pricing_Engine_Field_Mapping_v4.xlsx` — the field map spreadsheet.
  - `EarnedHome_Named_Ranges_for_Richard.docx` — partner-facing cell map.
- **Stack / architecture:**
  - `EarnedHome_Data_Architecture.docx`
  - `EarnedHome_Brand_and_Product_Architecture.docx`
  - `Platform_Stack_Roadmap_1A_to_4.docx`
  - `Pathfinder_1A_WhiteLabel_and_Tenancy_Design.docx`, `White_Label_and_URL_Model_Design_Note.md`
  - `EarnedHome_Revenue_Stack.docx` — the business/revenue stack.
- `Community_Tax_Design_Note.md`, `GUI_Input_Edit_Checks_and_Limits.md` — design notes.
- In-repo: `src/lib/pricing/types.ts` (the `PricingAdapter` contract).

## Phase 4 — Development
- In-repo: `src/lib/pricing/{types,stub,graph,disclosures}.ts`, `src/components/PathfinderTool.tsx`, `src/app/globals.css`, `scripts/*`, `package.json`.
- `Pathfinder_1A_UI_Prototype.html` — the original prototype the UI was ported from.

## Phase 5 — Testing
- In-repo: `scripts/test-tags.ts`, `scripts/test-va.ts`, `scripts/find-sharepoint-file.ts`.
- Golden reference: the live RateStream workbook (app reconciled to it, to the dollar).

## Phase 6 — Deployment
- Netlify project config + environment variables (host-side).
- `Richard_Daily_RateStream_Update_Guide` (.md/.docx) — the daily rate-update runbook.

## Phase 7 — Maintenance
- `Build_Status_2026-06-06_Live_Pilot.md` — the running continuity / where-we-left-off log.
- `00_START_HERE_Project_Context.md` — project context for resuming.
- SharePoint version history + Netlify deploy history (dual rollback).

---

*If a referenced file moves or is renamed, update this index. It is the map from the SDLC narrative to the actual working documents.*
