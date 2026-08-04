# Change Requests — Backlog

Captured requests from Richard (and others) to build **later**. This is the "parking lot" — logging something here does **not** mean it's started. Triage and schedule from here.

> Different from [`CHANGE_SIGNOFF_LOG.md`](CHANGE_SIGNOFF_LOG.md): that log is for changes already **built** and awaiting sign-off before Production. This one is for requests **before** anything is built.

**Status flow:** `Captured` → `Planned` → `In progress` → `Done` (or `Parked` / `Won't do`).

| ID | Date | Requested by | Change | Area | Priority | Status | Notes |
|----|------|-------------|--------|------|----------|--------|-------|
| CR-001 | 2026-08-04 | Richard | **Rebrand EarnedHome → BuyerBridge** — wordmark + logo, in-app branding/header, emails, disclosures, and the production domain. | Branding | **BLOCKED** | Parked | 🛑 **"BUYERBRIDGE" is a LIVE US trademark — Reg. No. 6003449, owned by Dealers United, LLC (adtech SaaS).** `buyerbridge.com`/`.ai` domains taken. Using the same name + similar mark for a related SaaS is a likely-confusion infringement risk. **Do not use in the app/emails/domain without IP counsel.** Recommend selecting a clearable name (see BuyerSpan / BuyerCrossing / Bridgely). Not legal advice. |
| CR-002 | 2026-08-04 | Richard | **Richard's site `RealAnswer.Mortgage`** — define the relationship to the buyer tool. | Web / integration | TBD | Captured | Open question to confirm with Richard: does the buyer tool **live under / link from** RealAnswer.Mortgage, co-brand with it, or replace it? Decide before wiring anything. |
| CR-003 | 2026-08-04 | Marvin / Richard | **BuyerBridge logo** — design a primary logo + app icon. | Branding / design | Med | In progress | Concepts presented for review; will export the chosen mark as SVG + PNG. Gated by the name-clearance note in CR-001. |
| CR-004 | 2026-08-04 | Richard | **Rebrand "Loan Officer" → "Mortgage Advisor" system-wide** — all user-facing copy (buyer pages, dashboard, login, emails, errors, disclosures). | Copy / branding | — | Done (pending 2 flags) | ⚠️ **Compliance:** "loan officer" is the NMLS-licensed title; a few disclosure lines now read "licensed Mortgage Advisor" — **Richard to confirm his state permits the marketing title in disclosures.** Internal identifiers, the `/dashboard/los` URL, and the `lo` role are unchanged (not user-visible). |
| CR-005 | 2026-08-04 | (follow-up) | **Rename the "Loan Officer Manual" .docx** to "Mortgage Advisor Manual" — the onboarding email now references the new name. | Docs | Low | Captured | Keep the manual's title in sync with the CR-004 rebrand so the emailed label matches the actual document. |

## Notes
- Nothing here is committed to a release until it graduates to the sign-off log and gets built + approved.
- When an item starts, move it to `In progress` here and (once built) open a matching row in `CHANGE_SIGNOFF_LOG.md`.
