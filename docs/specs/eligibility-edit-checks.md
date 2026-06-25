# EarnedHome — Loan Eligibility Edit Checks (Phase 1A)

**For: Richard's review + project documentation. As of June 24, 2026.**

This documents the "edit checks" — the rules that decide which loan products a buyer is eligible for, what they're warned about, and what's blocked — in plain lending terms. It covers (1) how the checks run, (2) what's in place today, (3) the new edits we're adding, and (4) where the numbers live so they're easy to maintain.

---

## 1. How the checks run (and why it's fast)

Every rule lives in **one place** and runs in **two spots**:

- **Instantly in the buyer's browser** as they type — so a product greys out or a hint appears with no waiting. This is pure math; it adds no delay.
- **Authoritatively on the server** when they press *Get Payments* — the same rule, re-checked, and the result is stored on the saved quote so the loan officer and any follow-up email reflect the true verdict and nothing can be bypassed.

Because the rules are local math (not a call out to the pricing workbook), they do **not** slow down the quote. They can actually speed it up: if a scenario qualifies for nothing, we can skip the pricing engine entirely.

**Ineligible products are shown greyed-out with the reason** (e.g., "This jumbo tier needs a credit score of 700+"), not hidden — so the buyer understands why and is nudged to talk to the loan officer.

---

## 2. Edit checks in place today

### Input checks (block the estimate, shown in a red notice)
- Home price must be greater than $0.
- Down payment must be less than the home price.
- Down payment can't be negative.

### Eligibility rules (grey out the product card with a reason)

**Conventional / Jumbo** (one continuum by loan size; loan = price − down):

| Tier | Loan amount | Min credit | Max LTV (min down) |
|---|---|---|---|
| Conforming | ≤ $832,750 | 620 | 95% (5%); 97% (3%) first-time |
| Jumbo Tier 1 | $832,751 – $2,000,000 | 680 | 89.99% (~10%) |
| Jumbo Tier 2 | $2,000,001 – $3,500,000 | 700 | 80% (20%) |
| Above limit | > $3,500,000 | — | Speak with a loan officer (ineligible under standard rules) |

**FHA** — loan ≤ $573,361 (base $563,500 + financed UFMIP at 1.75%, assumed financed); credit ≥ 620; max LTV 96.5% (3.5% down).

**VA** (shown only when *Military / Veteran* is checked; 100% LTV — no down required):

| Tier | Loan amount | Min credit |
|---|---|---|
| Standard VA | ≤ $832,750 | 620 |
| VA Jumbo | $832,751 – $1,500,000 | 640 |
| VA Jumbo | $1,500,001 – $2,500,000 | 680 |
| Above limit | > $2,500,000 | Ineligible for funding |

### Consent gate
- A lead is never saved or routed without the buyer's explicit TCPA contact consent.

---

## 3. New edits we're adding

### A. Occupancy enforcement *(correctness gap — highest priority)*
The buyer already chooses Primary / Second Home / Investment, but the rules ignore it today. Adding:

- **FHA and VA are primary-residence programs.** If occupancy is **Second Home** or **Investment**, those products grey out.
- **Conventional** stays available for second home / investment, but with the program's **higher down-payment / lower-LTV** requirements for those occupancies (exact figures are institution-specific — *Richard to confirm*; typical: second home ~10% down, investment ~15–25% down).

### B. Seller Credit — remove from the buyer view *(decided)*
- **Default Seller Credit to $0 and hide the field** in Phase 1A.
- **Keep the underlying logic and plumbing** so it can be re-enabled later without rebuilding — the buyer simply can't set it for now.
- This sidesteps the need for interested-party-contribution caps (which vary by program and LTV) until we choose to expose the field again.

### C. Institutional overlays become Loan-Officer settings *(maintenance)*
See §4. The agency baseline (Fannie/Freddie, FHA, VA limits) and each loan officer's **institution-specific overlays** (their investor's min credit, max LTV, jumbo breakpoints) move out of code and into an admin screen, so changes never require a developer.

### D. Minimum loan floor *(optional)*
Many investors won't fund very small loans (often ~$50k). A low-end stopper that routes those buyers to the loan officer. *Richard to confirm if needed and the floor.*

### E. VA detail logic *(optional, later)*
The buyer can already indicate **prior VA loan**, **VA disability**, and **finance the funding fee** — these are collected but don't yet drive an edit. (Disability typically exempts the funding fee; prior use changes its percentage.) Wire these when the VA funding-fee math is finalized in the workbook.

---

## 4. Where the numbers live (so they're easy to maintain)

The eligibility numbers are **per loan officer**, because each LO chooses their lending institution/investor (e.g., Rocket vs. Bank of America) and each investor sets its own requirements. Two layers:

- **Agency baseline** — Fannie/Freddie conforming limit, FHA limit, VA limit. National; changes roughly yearly; shared by everyone as the default.
- **Institution overlays** — the LO's investor-specific minimums and caps (jumbo tier credit/LTV, any credit overlays). Change anytime; set per loan officer.

At quote time the system uses *the loan officer's overlays layered on top of the agency baseline.* A loan officer with no special overlays just gets the baseline.

**The plan:** an admin screen (gated like the existing Rate Workbook tool) where an authorized user edits these numbers — with validation (tiers can't overlap, LTV ≤ 100%, credit within a real band), version history, and one-click rollback (the same "a bad change is one click back" safety as the rate workbook). No code deploy when Fannie/Freddie or an investor changes a number.

> Recommendation: build the editor for the **agency baseline first** (one shared set) for the pilot, and add the per-loan-officer overlay editor when a second institution actually comes on board — design for many, build for one.

---

## 5. Open decisions for Richard

1. **Occupancy figures** — confirm the down-payment / max-LTV for conventional **second home** and **investment** (institution-specific).
2. **Minimum loan floor** — do we need one, and at what amount?
3. **Which numbers are agency-baseline vs. institution overlay** — our read: conforming/FHA/VA limits = baseline; jumbo + VA-jumbo credit/LTV tiers = overlay. Confirm.
4. **Who edits the admin screen** — Richard, Marvin, or both?
5. **Effective-dating** — should agency limits be schedulable to flip on a date (e.g., Jan 1), or just take effect when saved?

---

*All customer-facing wording and the eligibility logic are subject to Richard's RESPA/compliance review before going live.*
