# Agent Attribution — QA Test Script

**Environment:** QA — `https://dev--earnedhome.netlify.app`
**Sign-in:** dashboard account (admin or LO) at `/login`
**You'll need:** two email inboxes you control — one to act as the **buyer**, one to act as the **agent** (so you can see the agent's copy). A test address is fine for both.

> Reminder: QA runs **live pricing** and **real emails** (from `thetimmonsfoundation.org`). External inboxes (Yahoo/Gmail) may land in **Spam** — that's deliverability, not a failure. Check Spam if an email is missing.

Mark each step **PASS / FAIL** as you go.

---

## 1. Agent management (dashboard)

1.1 Sign in → click **Agents** in the top nav. → *The Agents page loads.*

1.2 **Add an agent:** Name `Jane Realtor`, Email = **your agent inbox**, Phone `(972) 555-0100` → **Add agent**.
→ *Jane appears in the list with a link `…/a/jane-realtor`, and the header shows "1 active · 1 total".*

1.3 **Copy link:** click **Copy link** → paste somewhere.
→ *Clipboard has `https://dev--earnedhome.netlify.app/a/jane-realtor`; button briefly says "Copied!".*

1.4 **Email link:** click **Email link**.
→ *Button shows "Sending…" then "Sent!". A line "✓ Link sent <date/time>" appears under the link. The agent inbox receives "Your EarnedHome estimate link" with an "Open your link" button and the showings wording.*

1.5 **Edit:** click **Edit** → change Phone to `(972) 555-0199` → **Save**.
→ *Row updates in place; the link/slug is unchanged.*

1.6 **Toggle color:** confirm the toggle button is **red "Turn off"** while Jane is active.

---

## 2. Buyer attribution (the core loop)

2.1 Open Jane's link `…/a/jane-realtor` in a fresh tab.
→ *Results show **"Your agent: Jane Realtor"** above "Your loan officer: R Parry Financial".*

2.2 Enter Home Price `560000`, Down `112000` → run the numbers → **Connect me with a loan officer** → fill Name `Rhonda Tester`, Email = **your buyer inbox**, Phone, check consent → **Submit**.
→ *Success screen: "You're connected with R Parry Financial."*

2.3 Dashboard → **Leads** → refresh.
→ *Newest lead (Rhonda) shows **Jane Realtor** in the **Agent** column.*

2.4 Check **buyer inbox**.
→ *"Your home payment estimate" email arrives, ending with a **"Book a time with R Parry Financial"** button + a **"Call …"** line (LO phone).*

2.5 Check the **notify inbox** (LO alert).
→ *"New buyer lead — Rhonda Tester" email, and it reads **"(via Jane Realtor)"** with an **Agent:** row.*

2.6 Check the **agent inbox** (Jane's).
→ *"Your buyer Rhonda Tester just signed up" email arrives.*

---

## 3. Regular page still works (regression — no agent)

3.1 Open the plain site `https://dev--earnedhome.netlify.app/` (no `/a/…`).
→ *No "Your agent" line appears.*

3.2 Run an estimate → submit with a different name.
→ *Lead saves; in the Leads table its **Agent** column is **"—"** (blank). Buyer + LO emails still fire; no agent copy is sent.*

---

## 4. Revoke a seat (turn off)

4.1 Agents page → click **Turn off** on Jane (button is red).
→ *Jane shows a grey **SEAT OFF** tag; button turns **green "Turn on"**; header count drops to "0 active · 1 total".*

4.2 **Filter:** set **Show: Active only** → Jane hidden. Set **Show: Turned off** → Jane appears. Set **All** → Jane appears.

4.3 Open Jane's link `…/a/jane-realtor` again (fresh tab / hard refresh).
→ ***"This link is no longer active"** page appears — **no** estimate form, **no** "Get my estimate" button.*

4.4 Dashboard → **Leads** → find Rhonda's lead.
→ *Agent column shows **Jane Realtor** with a red **DISABLED** badge; expanded detail shows "Jane Realtor (disabled)".*

4.5 Agents page → **Turn on** Jane (green) → re-open her link.
→ *The estimate tool loads again with "Your agent: Jane Realtor". (Turn back off if you want to leave it revoked.)*

---

## 5. Sign-off

| Section | Result | Notes |
|---|---|---|
| 1. Agent management | ☐ Pass ☐ Fail | |
| 2. Buyer attribution | ☐ Pass ☐ Fail | |
| 3. Regular page (regression) | ☐ Pass ☐ Fail | |
| 4. Revoke / disable | ☐ Pass ☐ Fail | |

**Tester:** ____________________  **Date:** ____________________

> Not in scope for this script (still to build): the buyer **resume link** (`/r/<token>` to reopen a saved estimate).
