# QA Test Plan — EarnedHome Phase 1A
**Companion to [05-testing.md](05-testing.md). The concrete test cases, the test harness, and the promotion process.**
**Status: ✅ QA complete (functional + integration + golden-value); partner UAT of copy pending.**

---

## 1. Environments & promotion flow

Code moves through three environments. Each is a gate — work only advances when the prior gate passes.

```
┌─────────────────────┐   git push    ┌──────────────────────┐   merge to main   ┌────────────────────────┐
│ 1. LOCAL WORKSTATION │ ────────────▶ │ 2. GITHUB → NETLIFY  │ ───────────────▶ │ 3. NETLIFY PRODUCTION  │
│  localhost:3000      │   (dev)       │    DEPLOY PREVIEW     │                  │  earnedhome.netlify.app │
│  npm run dev          │               │  unique preview URL   │                  │  (the live site)        │
│  typecheck + tests    │               │  per push/PR          │                  │                         │
└─────────────────────┘               └──────────────────────┘                  └────────────────────────┘
        DEV/QA                              REVIEW / STAGING                            PRODUCTION
```

| Stage | Where | Branch | What runs | Gate to pass |
|---|---|---|---|---|
| **1. Local workstation** | `localhost:3000` (`npm run dev`) | `dev` | `npm run typecheck`, `npm run lint`, the `test:*` scripts, manual click-through | Types clean, scripts green, feature works locally |
| **2. GitHub → Netlify preview** | Auto **Deploy Preview** on every push/PR | `dev` (and feature branches) | Netlify build; smoke test on the preview URL | Build succeeds; preview verified |
| **3. Netlify production** | `https://earnedhome.netlify.app` | `main` | Netlify production build + deploy | Post-deploy smoke (`test:tags`), visual check |

**Promotion rule:** develop and test on the **workstation** → push to **`dev`** (GitHub auto-builds a **Netlify Deploy Preview** to verify in a real cloud build) → when verified, **merge `dev` → `main`**, which Netlify auto-deploys to **production**.

### ▶ Will Netlify be the production code?
**Yes.** Netlify is the production hosting and CI/CD platform. The **production deploy built from the `main` branch is the production system**, served at the production URL (today `earnedhome.netlify.app`; a custom domain such as `earnedhome.com` attaches to that same Netlify production deploy at go-live). Every push to `main` rebuilds and redeploys production; older deploys stay available for one-click rollback. The remaining go-live steps are configuration, not a platform change: (1) point the custom domain at Netlify, and (2) set `PRICING_ADAPTER=graph` + the `GRAPH_*` env vars so production runs the **live engine** instead of the stub. Supabase (database/auth) and the partner's SharePoint-hosted workbook (the pricing engine) sit behind Netlify; Netlify serves the app and the API routes that call them.

---

## 2. Test types (the QA pyramid)

| Layer | Tool / command | What it proves |
|---|---|---|
| **Static** | `npm run typecheck` (`tsc --noEmit`), `npm run lint` | Types and contracts are sound; no broken references. |
| **Engine / unit** | `npm run validate:engine`, `test:inputs`, `test:fixed30`, `test:va` | The pricing adapter reads/writes the right named ranges and returns sane numbers per product. |
| **Integration / connection** | `npm run test:tags`, `npm run find:sp` | The app is pointed at the correct workbook and every named range resolves. |
| **Golden-value** | Compare adapter output to the live workbook | Numbers match the source of truth **to the dollar**. |
| **Functional UI** | Manual click-through (desktop + mobile) | Inputs, cards, modals, panels, lead capture behave. |
| **UAT** | Partner (loan officer) review | Pricing and disclosure/educational copy are approved for use. |

---

## 3. QA test cases

Inputs use the buyer-facing fields. "Expected" is what QA verified. **Result** reflects the last run on `dev`.

### A. Pricing engine — golden values (adapter vs. workbook)
| ID | Scenario (inputs) | Expected | Result |
|---|---|---|---|
| QA-01 | Home $400,000 · 10% down · credit 760–779 · Primary · seller credit $0 | 6 product cards; P&I/taxes/ins/MI/total each match the workbook to the dollar | ✅ Pass |
| QA-02 | Home $1,200,000 · 20% down · 740–759 · Primary (loan $960k > $832,750) | Conventional/FHA card **headings read "Jumbo …"** (sheet-driven); numbers match sheet | ✅ Pass |
| QA-03 | Veteran ✓ · Home $1,000,000 · 0% down · 700–719 (VA Jumbo) | VA Jumbo 30 **P&I ≈ $12,921** (sheet $12,920.65); VA cards show **"—" for MI** | ✅ Pass |
| QA-04 | Same inputs, 30-yr vs 15-yr | 15-yr rate < 30-yr rate; 15-yr P&I higher; both reconcile to sheet | ✅ Pass |

### B. Input handling & units
| ID | Scenario | Expected | Result |
|---|---|---|---|
| QA-05 | Down payment entered as **10%** | App writes **0.10** to the sheet's Down% cell (unit conversion) — not 10 | ✅ Pass (regression: fixed the $0-payment bug) |
| QA-06 | Down payment > home price | Inline friendly error; no quote with impossible values | ✅ Pass |
| QA-07 | Home price ≤ 0 (or below floor) | Required/validation error in place of the bad value | ✅ Pass |
| QA-08 | Seller credit negative | Rejected (must be ≥ 0) | ✅ Pass |

### C. Product visibility & routing
| ID | Scenario | Expected | Result |
|---|---|---|---|
| QA-09 | Veteran **unchecked** | **No VA cards**; VA-only checkboxes hidden | ✅ Pass |
| QA-10 | Veteran **checked** | VA cards appear; 3 VA checkboxes show (Prior VA loan / VA disability / Finance funding fee) | ✅ Pass |
| QA-11 | Inputs that return no positive-payment product | Routing message instead of blank/zeroed cards | ✅ Pass |

> **Eligibility tiers (June 24).** Ineligible products are shown **greyed-out with a reason** (decided UX), not hidden; eligibility is judged against the input snapshot that produced the quote. Rules in `src/lib/eligibility.ts` per `docs/specs/eligibility-edit-checks.md`.

| ID | Scenario | Expected | Result |
|---|---|---|---|
| QA-21 | Home $1,200,000 · 10% down · credit **660–679** (Jumbo Tier 1 needs 680) | Conventional/Jumbo card **greyed**: "This jumbo tier needs a credit score of 680+." | ⏳ Verify on QA |
| QA-22 | Home $4,500,000 · $500,000 down (loan > $3.5M) | Conventional card **greyed**: "Above our jumbo limit ($3,500,000)…" | ⏳ Verify on QA |
| QA-23 | Home $650,000 · $30,000 down · First-Time **unchecked** (loan > $573,361) | FHA card **greyed**: "FHA isn't available above $573,361…" | ⏳ Verify on QA |
| QA-24 | Veteran ✓ · Home $2,600,000 (loan > $2.5M) | VA card **greyed**: "Above the VA jumbo limit ($2,500,000)…" | ⏳ Verify on QA |
| QA-25 | Eligible jumbo (Home $1,200,000 · 15% down · 720–739) | Cards show **normally** (no greying) | ⏳ Verify on QA |

### D. Display & formatting
| ID | Scenario | Expected | Result |
|---|---|---|---|
| QA-12 | "Rates as of" stamp | Shows formatted date (e.g. **"June 20, 2026"**), not an Excel serial like `46193.39` | ✅ Pass (reads `$select=text`) |
| QA-13 | Estimated Funds breakdown | Loan fees + prepaids + down payment − seller credit = **cash-to-close**, per product | ✅ Pass |
| QA-14 | Mobile (≤ 760px) | Cards stack; modals/panels usable; nothing clipped | ✅ Pass |

### E. Education & lead capture
| ID | Scenario | Expected | Result |
|---|---|---|---|
| QA-15 | "Ways to Lower Your Payment" panel | Tap-to-expand rows open on tap (mobile), each routes to the loan officer | ✅ Pass |
| QA-16 | "Understanding your estimate" info panel + ⓘ icons | Single panel opens; ⓘ tips toggle (Military/Veteran, First-Time, Seller Credit, Buydown) | ✅ Pass |
| QA-17 | Submit lead **without** TCPA consent | Blocked — consent is required to store/route a lead | ✅ Pass |
| QA-18 | Submit lead **with** consent | Lead persists, linked to its quote; confirmation panel shows; duplicate re-submit prevented | ✅ Pass |

### F. Integration / connection
| ID | Scenario | Expected | Result |
|---|---|---|---|
| QA-19 | `npm run test:tags` | Reports the app is reading the **correct** workbook; all named ranges resolve | ✅ Pass ("connected to the new tagged file") |
| QA-20 | `npm run test:va` | VA path runs live end to end | ✅ Pass |

---

## 4. Pre-merge checklist (workstation → `dev`)
- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean
- [ ] Relevant `test:*` scripts green (`test:tags` at minimum; `test:va` if VA touched)
- [ ] Manual click-through of the changed area, desktop **and** mobile
- [ ] No secrets added to tracked files (`.env*.local` only)

## 5. Pre-production checklist (`dev` → `main` → Netlify production)
- [ ] Netlify **Deploy Preview** built and smoke-tested on its preview URL
- [ ] Production env vars set in Netlify (`PRICING_ADAPTER=graph` + `GRAPH_*` + Supabase) for live-engine release
- [ ] Post-deploy `test:tags` against the deployed config
- [ ] Partner UAT sign-off on pricing + educational/disclosure copy (RESPA)
- [ ] Rollback path confirmed (Netlify deploy history + SharePoint version history)

## 6. Defects found & fixed during QA
| Defect | Root cause | Fix | Verified by |
|---|---|---|---|
| All payments showed **$0** | Down % unit mismatch (app sent `10`, sheet wanted `0.10`) | `downPct / 100` in the adapter | QA-05, QA-01 |
| Date showed **`46193.39`** | Excel date serial number read via `values` | Read `$select=text` (`getRangeText`) | QA-12 |
| Only VA showed / **Jumbo missing** | App's loan-limit hiding suppressed Jumbo Conventional/FHA | Removed the hiding; show what the sheet returns with its dynamic Jumbo headings | QA-02 |
| App read the **old** workbook after the SharePoint move | Stale `GRAPH_WORKBOOK_ITEM_ID` | `find:sp` → new IDs → `test:tags` reconfirmed | QA-19 |

### 6.1 Open defects (not yet fixed)
| Defect | Where | Root cause | Owner / fix |
|---|---|---|---|
| **VA 15-yr card** shows **APR 0.000%, Down Payment $0, Estimated Total $0** (found June 24) | **Engine (workbook)** | The VA 15-yr output named ranges (`eh_out_va15_apr`, `eh_out_va15_downPayment`, `eh_out_va15_cashToClose`) return blank; the app displays blank as 0. The VA **30-yr** block is correct, so it's a VA-15-only mapping gap. | **Richard** — point the VA-15 APR / down-payment / cash-to-close cells at the right formulas (mirror the VA-30 block). App needs no change. Raise at 6/25. |

### 6.2 Performance (June 24)
- Quote latency on the live engine cut from **~6–9s → ~2s** by batching Graph calls (`/$batch`, ~90 round-trips → ~6). Telemetry via `quote.meta.tookMs` / `graphCalls`. Path to ~1s ("block reads") is a workbook layout change for Richard — see `docs/specs/graph-block-reads.md`.

## 7. Sign-off
- **QA (functional, integration, golden-value):** ✅ complete on `dev`.
- **UAT (partner):** ⏳ pending the loan officer's RESPA review of the educational copy and final pricing confirmation.
- **Production release:** gated on the Pre-production checklist (Section 5).
