# Phase II — Test Script (multi-LO broker)

End-to-end walkthrough to verify the Phase II build before promoting `rel → test (QA) → main (PRD)`.
Runs **locally on the `rel` branch** against the single shared Supabase database (migrations 0012–0016 applied). Tick each box as you go.

## Before you start
- On branch **`rel`**, database freshly cleared (only the R Parry tenant + admins Richard/Marvin remain).
- **Email tip:** use plus-aliases of your own inbox so every account is unique but lands in one place — e.g. `marv_timmons+jane@yahoo.com`, `marv_timmons+realtor@yahoo.com`.
- Local email sends via the verified `rparryfinancial.com` sender; the LO alert routes to you via `LEAD_NOTIFY_OVERRIDE`.

## Pre-flight
- [ ] `npm run typecheck` (clean)
- [ ] `git add -A && git commit -m "..." && git push origin rel`
- [ ] `npm run dev`
- [ ] Sign in as **Richard** at `http://localhost:3000/login`

---

## 1 · Broker adds a loan officer
- [ ] Go to **/dashboard/los** → see **Richard** (Primary · Broker admin) and **Marvin** (Broker admin)
- [ ] Add LO **"Jane Officer"**, email `marv_timmons+jane@yahoo.com`, NMLS `1111111`
- [ ] Jane appears in the list as a plain LO (no Primary badge)

## 2 · Activate Jane's login
- [ ] Click **Email link** on Jane's row → "✓ Sign-in link sent …" appears
- [ ] Open the **"Set up your EarnedHome sign-in"** email → click **Set password & sign in**
- [ ] Set a password → you land on the dashboard **as Jane**
- [ ] *(Alt: set her password in Supabase → Authentication → Users)*

## 3 · Per-LO visibility (the headline)
- [ ] As **Jane**: dashboard shows **no leads** yet
- [ ] As **Jane**: **no "Loan officers"** nav link, **no LO filter** (she only sees her own world)
- [ ] Sign out

## 4 · Agent → LO (as Jane)
- [ ] Sign in as **Jane** → **/dashboard/agents** → add **"Jane's Realtor"**, email `marv_timmons+realtor@yahoo.com`
- [ ] Click **Email link** → the email contains **BOTH** links (share + status) with bookmark/keep-private guidance
- [ ] Copy the agent's **share link** (`/a/jane-realtor`) and **Status link** (`/agent/<token>`)

## 5 · Buyer through the agent link (routing + Option A + consent)
- [ ] Open **`/a/jane-realtor`** in a logged-out tab
- [ ] It reads **"Your loan officer: Jane Officer · NMLS 1111111"** (the agent's LO, not Richard)
- [ ] Header still shows **R Parry Financial · NMLS 1924318** (company brand)
- [ ] Run an estimate (e.g. $400,000 / $80,000 down) → **Get Payments** returns numbers
- [ ] Fill **"Test Buyer A"**, check **TCPA**, check **"I authorize Jane's Realtor to receive updates on my loan status"**, submit
- [ ] Confirmation reads "connected with **Jane Officer**"

## 6 · Lead routing + broker roll-up
- [ ] Sign in as **Jane** → she sees **Test Buyer A**; set status → **Working**
- [ ] Sign in as **Richard** → he also sees Test Buyer A, with **LO column = Jane Officer**
- [ ] Use the **LO filter → Jane** → the table narrows to only her leads

## 7 · Agent status portal (consent-gated)
- [ ] Open the agent's **Status link** (`/agent/<token>`)
- [ ] **Test Buyer A** shows **"In process"** (consent given + Jane set Working)
- [ ] Run a **second** buyer through `/a/jane-realtor` **without** ticking the consent box
- [ ] That second buyer shows only **"Connected"** (no progression) ✅

## 8 · Revoke a seat
- [ ] Turn **Jane's Realtor** off on the agents page
- [ ] `/a/jane-realtor` shows **"This link is no longer active"**
- [ ] The **Status link** shows **"This status link isn't active"**

## 9 · Primary routing (non-agent leads)
- [ ] As Richard: **/dashboard/los** → **Make primary → Jane**
- [ ] Open **localhost:3000** (no agent link) → "Your loan officer: **Jane Officer**"
- [ ] Run a lead there → it routes to **Jane** (the primary)
- [ ] **Make primary → Richard** again to restore

---

## Feature coverage
| Phase II feature | Covered by |
|---|---|
| LO management (add/manage, set primary) | 1, 9 |
| LO login + sign-in email link | 2 |
| Per-LO visibility (LO sees only own) | 3, 6 |
| Broker roll-up (LO column + filter) | 6 |
| Agent → LO routing | 5, 6 |
| Option A correspondence (LO person + company, NMLS) | 5, 9 |
| Two-link agent invite email | 4 |
| Agent status portal + buyer consent gate | 7 |
| Seat revocation | 8 |

## After testing
- Wipe test data again if desired (clear `leads`, `quotes`, `agents`, `events`; delete `role='lo'` app_users), leaving the tenant + admins.
- Remaining before production: **compliance sign-off** on the status-portal consent wording, then the **`rel → test → main`** promotion.

*Reminder: single shared database (no QA/Prod split yet) — do the split before real buyer volume.*
