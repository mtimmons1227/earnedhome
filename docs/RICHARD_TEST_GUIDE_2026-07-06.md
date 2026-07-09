# EarnedHome — What's New to Test (for Richard)

**Date:** July 6, 2026
**Where to test:** the **test site** → `https://dev--earnedhome.netlify.app`
*(This is the preview/QA site — not the live one. Test freely; nothing here affects real buyers.)*

---

## What's new since you last looked

**1. Realtor (agent) links — the big one.**
You can now give each realtor partner their **own link**. When a buyer runs their numbers from that link:
- The buyer sees **"Your agent: [Realtor's name]"** on the results.
- The lead is **tagged to that realtor** in your dashboard, so you always know who sent whom.
- The realtor gets **their own copy** of the lead by email.
- You can **turn a realtor's link on or off** anytime — off means their link stops working (this is how seats get granted/revoked).

**2. Emails now send.** On connect, three emails go out: the **buyer's estimate**, **your lead alert** (now says "via [realtor]" when it came through one), and the **realtor's copy**.

**3. Buyers can fix their info.** After connecting, a buyer can click **"Update my info"** to correct their name/email/phone — it updates the same lead, no duplicate.

**4. Small touches.** The connected screen now shows **your phone number** and a note that they can reschedule from the Calendly email. The header shows the **company NMLS (1924318)**.

---

## How to test it (about 10 minutes)

1. **Sign in** — go to `https://dev--earnedhome.netlify.app/login` and sign in with your dashboard account.
2. **Add a realtor** — click **Agents** (top right) → fill in a name + **an email you can check** → **Add agent**. (Use a spare email so you can see the realtor's copy.)
3. **Get their link** — click **Copy link** (or **Email link** to send it to them).
4. **Be the buyer** — open that link in a new tab. Confirm you see **"Your agent: [name]"**, enter a home price + down payment, run it, then **Connect me with a loan officer**, fill in name/email/phone, and submit.
5. **Check your dashboard** — go to **Leads**. The new lead should show the **realtor's name** in the **Agent** column.
6. **Check the emails** — the buyer email, your alert ("via [realtor]"), and the realtor's copy should all arrive.
7. **Test turning it off** — back on **Agents**, click **Turn off** for that realtor, then reopen their link → it should say **"This link is no longer active."** Turn it back on and it works again.

---

## What I'd love your eyes on (feedback)

- **Wording** — the buyer's estimate email, your alert, the realtor's email, and the on-screen copy. Anything you want changed for **compliance/RESPA** before this goes live?
- **The realtor flow** — does the give/turn-off model match how you'd actually work with your agents?
- **Anything confusing** for a buyer or a realtor.

---

## A couple of things to know while testing

- **Emails may land in spam.** The test site sends from a test email domain, so Yahoo/Gmail may filter it — check your spam folder. (On the live site we'll send from an R Parry–verified domain.)
- **Your "new lead" alert** currently goes to the **test inbox** we set up, not your real inbox — tell Marvin if you want it pointed at your email for testing.
- This is the **test site**. When you're happy with it, we promote it to the live site.

Questions or changes — just send them to Marvin.
