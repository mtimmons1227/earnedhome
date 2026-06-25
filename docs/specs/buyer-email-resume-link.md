# Spec — Buyer Email + Resume Link (Phase II)
**Status: Planned (Phase II). Not yet built.** Email the buyer their estimate and a link to come back to it — primarily a re-engagement touchpoint for the loan officer, secondarily a convenience for the buyer.

## Why
A buyer who runs the numbers and leaves is a **warm lead**. Today we capture the lead + quote, but we don't send the buyer anything. Emailing them their estimate does three jobs at once:
1. Gives the buyer a **takeaway record** of what they saw.
2. Keeps the loan officer **top of mind** (re-engagement).
3. Gives the LO a natural reason to **follow up**.

The "resume link" lets them reopen their saved estimate without re-typing — a nicety, since the tool only has ~7 inputs.

## Two pieces (can ship independently)
### A. Buyer estimate email (higher value — build first)
On lead submit, send the buyer an email with:
- A friendly summary of their estimate (products, total payment, cash-to-close, "rates as of" date).
- Their loan officer's name + "no pressure, they'll reach out."
- The estimate-only disclosures (RESPA-appropriate; same wording as the on-screen disclosures).
- (Optional) the resume link from B.

### B. Resume link (the "coat-check ticket")
A link the buyer can click to reopen their saved estimate. In plain terms: **we email them a coat-check ticket** — a harmless random link — that quietly pulls up their saved estimate when clicked.

- The link contains a **random, high-entropy token** — never the buyer's data. (`/estimate/9f3a7b2k8x…`)
- The token **maps server-side** to the saved quote in the database. The real data lives on the server; the link is just the key that fetches it.
- **Reusable, ~30-day expiry.** It's "come back to your estimate," not a login — so we favor convenience. (A login link would expire in minutes; this is low-stakes.)
- Opens a **read-only** view of their estimate (or pre-fills the inputs). Not an account, not a login, not a mortgage application.

## Where it lives in the code (all in this same repo)
- **Save the quote + a token:** `quotes` table already exists; add a `resume_token` column (or a small `estimate_links` table). Generate the token in `src/app/api/lead/route.ts` (or `/api/quote`).
- **Send the email:** a provider like **Resend** (the org already uses it), called from `/api/lead` after the lead saves — or via a Power Automate webhook (see `ROADMAP_PHASE_2_3.md` #4).
- **Resume route:** a new `src/app/estimate/[token]/page.tsx` (+ a tiny API to look up the token) that loads the saved quote read-only.
- **Security:** random token (crypto-strong), no PII in the URL, 30-day expiry, revocable; rate-limit the lookup.

## What it deliberately does NOT do
- It is **not a login** and **not a full mortgage application** (no SSN, no financials). So it does **not** need MFA — that would be over-engineering for a payment *estimate*.
- It does **not** touch the rate workbook in any way (see the architecture note below).

## Compliance
Estimate-only disclosures travel in the email; general/educational, not personalized advice. Run the email copy past Richard's RESPA review (same as the on-screen copy).

## Acceptance criteria
- On lead submit, the buyer receives an email with their estimate summary + disclosures.
- The resume link reopens the correct saved estimate, works for ~30 days, and contains no personal data in the URL.
- A used/expired token fails gracefully ("this link has expired — run a fresh estimate").

## Dependencies
- An email provider (Resend) + verified sending domain.
- The lead-notification work (`ROADMAP_PHASE_2_3.md` #4) — same trigger point.
