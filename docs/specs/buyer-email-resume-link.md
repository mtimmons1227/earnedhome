# Spec — Buyer Email + Resume Link

**Status:**
- **Part A — Buyer estimate email: ✅ BUILT (Jul 6, 2026).** Sends on lead submit via Resend; live on QA.
- **Part B — Resume link: 📐 Designed, ready to build.** This doc.

Email the buyer their estimate and a link to come back to it — a re-engagement touchpoint for the loan officer and a convenience for the buyer.

## Why (updated)
A buyer who runs the numbers and leaves is a **warm lead**. The estimate email (Part A) gives them a takeaway and keeps the LO top-of-mind. But there's a gap Part B closes:

> **The "come back later, change my mind" problem.** A buyer connects on Tuesday. Thursday they decide they want to *talk now* — call, book a time, or start an application. Today the only way back to those actions is to **re-create the whole estimate from scratch.** That's friction on a high-intent moment.

So the resume link isn't just "reopen your numbers" — it's **"one tap back to your loan officer,"** permanently, from their inbox.

---

## Part A — Buyer estimate email ✅ (built)
On lead submit, the buyer gets an email with: their estimate summary (products, total payment, cash-to-close, "rates as of"), their LO's name + "no pressure, they'll reach out," and the estimate-only disclosures. **→ Add the Part B resume CTA to this email.**

---

## Part B — Resume link (the design)

### Goal
A returning buyer clicks the link in their email and lands on **their exact saved scenario, pre-filled, with all connect actions live** — Call · Book a time · Apply · Have them reach out — so they can act immediately, **with zero re-entry.**

### The token (the "coat-check ticket")
- The email link contains a **random, high-entropy token** — never the buyer's data: `/r/<token>` (e.g. `/r/9f3a7b2k8x…`).
- The token **maps server-side** to the saved lead + quote. The data lives on the server; the link is just the key.
- **Reusable, ~30-day expiry, revocable.** It's "come back to your estimate," not a login — so favor convenience (no MFA; it's a payment *estimate*, no SSN/financials).
- No PII in the URL; page is `noindex`.

### The resume page (`src/app/r/[token]/page.tsx`)
1. Look up the lead by `resume_token` **server-side (service role)** — public token-gated read, bypasses RLS by design.
2. **Invalid/expired** → friendly fallback: "This link has expired — run a fresh estimate →" (link to the tool).
3. **Valid** → load the saved **scenario inputs** (from the linked quote) + the buyer's **contact info**, then render **`PathfinderTool` pre-filled** with:
   - A small **"Welcome back, {firstName}"** banner.
   - Their scenario inputs restored (editable).
   - Pricing **recomputed live** against *current* rates (honest + current) with a "rates as of {today}" note.
   - **All connect actions live** (Call / Book / Apply / Reach out) — no re-collecting their info.

### Connect actions on resume (the crux)
- All four actions work exactly as the connect flow does today — but the buyer's name/email/phone are **already known**, so nothing is re-collected.
- **Re-engagement signal:** when a *resumed* buyer takes an action, log a **`lead_reengaged`** event and fire a **fresh LO alert** — e.g. *"Cindy came back and chose to book a time with you."* Use a distinct idempotency key so it is **not** de-duped against the original lead. A buyer returning to act is the **highest-intent moment** — Richard should hear about it.
- If they edit the numbers and recalculate, the action uses the **new** scenario (log a new quote; keep the same lead).

### What it deliberately does NOT do
- Not a login, not a mortgage application (no SSN/financials) → no MFA.
- Does not touch the rate workbook beyond a normal live quote.

---

## Build pieces (all in this repo)
1. **DB (migration `0008_resume_token`):** add `resume_token text unique` + `resume_expires_at timestamptz` to `leads`. Generate on insert.
2. **Lead route (`api/lead/route.ts`):** generate the token on lead creation; pass the resume URL (`https://{tenant-host}/r/{token}`) into the buyer estimate email payload.
3. **Email lib (`lib/email.ts`):** add a prominent **"Pick up where you left off →"** CTA button to the buyer estimate email.
4. **Resume page (`app/r/[token]/page.tsx`):** token lookup + reconstruct scenario + render `PathfinderTool` in "resumed" mode.
5. **PathfinderTool:** accept `initialScenario` + `initialContact` + `resumed` props → pre-fill inputs, skip contact re-collection, show connect actions + welcome banner.
6. **Re-engagement:** on a resumed action, insert `lead_reengaged` event + send the fresh LO alert.
7. **White-label:** build the resume URL on the **tenant's host** so the link stays branded (works with custom domains later).

## Security
Random crypto-strong token, no PII in URL, ~30-day expiry, revocable, `noindex`, rate-limit the lookup. Random tokens prevent enumeration.

## Compliance
Estimate-only disclosures travel in the email and on the resumed page (same wording as on-screen). Run the email copy past Richard's RESPA review.

## Acceptance criteria
- The buyer estimate email includes a working resume CTA.
- The link reopens the **correct** saved scenario, pre-filled, with **connect actions live**, for ~30 days; no PII in the URL.
- A resumed buyer can **call / book / apply** without re-entering anything.
- A resumed action fires a **fresh LO alert** ("came back and chose to …") and logs a `lead_reengaged` event (not de-duped).
- An expired/invalid token fails gracefully.

## Phasing
- **Phase 1 (MVP):** token + resume page (pre-filled scenario + connect actions) + email CTA.
- **Phase 2:** re-engagement LO alert + `lead_reengaged` event; "your numbers changed — update your LO"; a staff link in the LO alert to view the buyer's scenario in the dashboard.

## Dependencies
- Resend + verified sending domain ✅ (done).
- Part A buyer estimate email ✅ (done).
