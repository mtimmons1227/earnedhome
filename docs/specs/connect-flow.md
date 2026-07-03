# Connect-with-a-Loan-Officer flow — design & build log

**Status:** Phase 1A. DB foundation built (`supabase/migrations/0006_lo_contact.sql`). Code build (LO alert + connect buttons) pending. Calendar deferred.
**Last updated:** 2026-06-30.

## Goal
Turn the "Connect me with a loan officer" step into a real conversion point: give the buyer easy ways to act, capture the lead (with consent), and **alert the loan officer instantly** so interest never sits unseen.

## Today's behavior (the gap this closes)
Buyer clicks "Connect me with a loan officer" → fills a short form (name / email / phone + TCPA consent) → the lead is saved, an event is logged, and the buyer gets their estimate email. **The LO is NOT notified in real time** — they have to check the dashboard. That missing alert is the highest-value piece.

## The buyer's connect actions
All actions capture the lead (name/email/phone + TCPA consent) **and** fire the LO alert.

| Action | What it does | Source |
|---|---|---|
| 📝 **Apply / Reserve your mortgage** | Save lead + alert LO → open the LO's online application | `tenants.apply_url` (R Parry = his Blink "Reserve" link) |
| 📞 **Call now** | Save lead + alert LO → `tel:` dial the LO | `tenants.lo_phone` |
| ✉️ **Have them reach out** | Save lead + alert LO; LO follows up (today's behavior) | existing lead form |
| 📅 **Book a time** *(deferred)* | Save lead + alert LO → open the LO's scheduling link | `tenants.booking_url` (none yet) |

**Smart sequencing:** on "Apply" (and "Book a time"), EarnedHome saves the lead and emails the LO the alert **first**, then opens the external link — so the LO is notified with the buyer's scenario *and* the buyer continues to the real application.

## The LO alert
- **v1 = EMAIL only**, via the existing Resend setup (same tool that sends the buyer estimate). Sent to `tenants.notify_email`. Contents: buyer name / phone / email, scenario summary, which action they chose, link to the dashboard lead. Best-effort / non-blocking (same pattern as the buyer email).
- **SMS (Twilio) deferred** — adds a paid per-text dependency. Turn on "when funds / first paying LO" (decision locked 6/30/2026).

## Phasing & decisions (locked 6/30/2026)
- **No Calendly in v1.** Richard has no scheduling link yet; ship Apply + Call + Reach-out (+ alert). Add "Book a time" the moment a `booking_url` exists.
- **RECOMMENDATION — set up a (free) booking link before demoing to builders.** A "Book a time" option makes the partner demo feel complete. Free options: **Microsoft Bookings** (free if the LO is on M365, writes to Outlook) or **free Calendly** (one "intro call" event type is enough). Cost stays with the LO; EarnedHome pays nothing and stays tool-agnostic.
- **SMS later** (Twilio) — see above.
- **Tool-agnostic by design:** EarnedHome just stores a per-tenant link and opens it. Each partner brings their own application + calendar tools.

## Pilot config (R Parry — seeded in `0006_lo_contact.sql`)
- `lo_phone` = **817-905-8660** (Richard's mobile)
- `notify_email` = **Richard@rparryfinancial.com**
- `apply_url` = **https://www.blink.mortgage/app/signup/p/rparryfinancialllc/richardmchargue** (his Blink "Reserve Your Mortgage" application)
- `booking_url` = **null** (TODO: Richard's Calendly/Bookings link — needed for the builder demo)

## Where this data lives — and the future dashboard
- **Now:** four columns on the `tenants` row (migration `0006`), set once via SQL at onboarding — same place `lo_name` / `nmls` already live. Fine for one LO.
- **Later (Phase II):** an **LO-settings / onboarding dashboard** so an LO edits their phone, alert email, apply link, booking link, and branding without SQL. Build it when onboarding the **2nd–3rd** LO (when SQL-per-LO gets repetitive). Already on the roadmap (white-label/onboarding) — see `sdlc/08-future-releases.md`.

## Build steps
- [x] **DB:** `0006_lo_contact.sql` — `lo_phone`, `notify_email`, `apply_url`, `booking_url` + R Parry values. *(Run in Supabase SQL Editor.)*
- [ ] **Server — LO alert:** add `sendLoLeadAlert()` to `src/lib/email.ts`; in `src/app/api/lead/route.ts`, look up the tenant's `notify_email` + `lo_name` and send the alert after the lead insert (best-effort). *No-ops if Resend / notify_email unset.*
- [ ] **Plumb tenant fields:** add `apply_url`, `lo_phone`, `booking_url` to the `getTenantBySlug` select + `Tenant` type (`src/lib/tenant.ts`); pass to `<PathfinderTool>` via `src/app/page.tsx`.
- [ ] **UI — connect actions:** in `PathfinderTool` lead/connect step, render **Apply** (`apply_url`), **Call now** (`lo_phone`), **Reach out** (existing). Show **Book a time** only when `booking_url` is set. Each saves the lead + triggers the alert before opening any external link.

## Compliance
LO alert is internal (fine). Calling/texting the **buyer** stays gated on TCPA consent (already enforced). Application/booking links are buyer-initiated. External links (Blink, Calendly) open in a new tab.
