# Phase 5 — Testing
**Also known as (AI-era): Evaluation & Validation (Evals + UAT)**
**Status: ✅ QA complete** — functional, integration, and golden-value testing done (app reconciled to the source workbook to the dollar). Remaining: the loan officer's RESPA/UAT review of the educational copy.

> 📋 **The concrete test cases, the test harness, and the local → GitHub → Netlify promotion flow live in [05a-qa-test-plan.md](05a-qa-test-plan.md).**

## Purpose
Prove the system does what the requirements said — correctness, integration, and the numbers themselves — and that the partner agrees the output is right.

## Process (repeatable)
1. **Static checks** — types compile, no obvious breakage.
2. **Integration checks** — the live connection works and points at the right source.
3. **Golden-value evals** — compare system output against a trusted reference, to the dollar.
4. **End-to-end / UX checks** — the real screen on real devices.
5. **User Acceptance (UAT)** — the partner signs off on accuracy.
6. **Regression guard** — keep the checks runnable so future changes are safe.

## What we did on EarnedHome (Phase 1A)

### Static checks
- `tsc` typecheck across the app; the `PricingQuote`/`PricingProduct` contracts enforced at compile time (`satisfies`).
- Post-edit verification (brace/structure balance) after large edits, after an editing issue once truncated files — lesson learned and built into the routine: **verify after every edit**.

### Integration & connection checks
- **`test:tags`** — proves the app is reading the **correct** workbook and that every named range resolves. This caught a real defect: after a SharePoint move the app was still pointed at the **old** file (new tags reported "NOT FOUND"). `find:sp` retrieved the new drive/item IDs, the env was updated, and `test:tags` then confirmed **"connected to the new tagged file."**
- **`test:va`** — exercises the VA product path end to end.

### Golden-value evaluation (the core eval)
The trusted reference is the loan officer's workbook itself. We compared the app's rendered numbers against the sheet **cell by cell**. Result: matches to the dollar — e.g. VA Jumbo 30-yr **P&I $12,921** (app) vs **$12,920.65** (sheet, rounded). Every product block reconciled.

### Defects found and fixed during validation
- **$0 payments** in the GUI → root cause was the **down-% unit mismatch** (app sent `10`, sheet expected `0.10`); fixed with `downPct / 100`. (A workbook external link was a secondary red herring, resolved separately.)
- **Date showed "46193.39"** → Excel serial number; fixed by reading `$select=text`.
- **"These don't match" (only VA showed / Jumbo missing)** → the app's loan-limit hiding was suppressing Jumbo Conventional/FHA; removed it so the app shows exactly what the sheet returns, with the sheet's own dynamic Jumbo headings.

### End-to-end / UX & mobile
- Full click-through: inputs → 6 product cards (incl. Jumbo dynamic names) → Estimated Funds breakdown → lead modal → info panel.
- "Rates as of" date renders correctly next to the heading.
- Mobile responsiveness verified by narrowing the viewport / device emulation (cards stack below 760px).

### User Acceptance (UAT)
The loan officer is the acceptance authority for pricing: he updates rates and confirms the displayed numbers are his. The info-panel and ⓘ definition copy are flagged for his RESPA review before launch (placeholders in code until signed off).

## AI's role in this phase
**Maturity: AI-Assisted.** AI auto-generated the test/connection scripts, reasoned about edge cases (Jumbo headers, $0 payments, the date serial number, the missing-product case), and drove the golden-value reconciliation against the source workbook. The human remained the acceptance authority alongside the loan officer, who signs off on pricing — exactly the human-in-the-loop guardrail the framework calls for on critical decisions.

## Key artifacts
- `scripts/test-tags.ts`, `scripts/test-va.ts`, `scripts/find-sharepoint-file.ts` (npm: `test:tags`, `test:va`, `find:sp`).
- The golden reconciliation (app vs workbook, to the dollar).
- The defect/fix log carried in the build-status doc.
