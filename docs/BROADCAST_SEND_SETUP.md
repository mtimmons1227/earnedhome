# Turning On the Daily Broadcast (Email Send) — Setup Guide

**Audience:** Marvin / Richard. **Goal:** flip the BuyerBridge Broadcast tool from "compose & preview" to actually **sending** email — on the **free** plan.

> The Broadcast composer already works (audience picker, rich editor, Load-from-Word, real-recipient preview, recipient checklist). Sending is **deliberately off** until the steps below are done, so nothing can be emailed by accident.

---

## What it costs

**Free to start.** Resend's free plan sends **up to 100 emails/day** (3,000/month) and lets you verify **up to 3 domains**. That's enough to run daily broadcasts to up to 100 selected recipients at no cost.

**Resend Pro (~$20/mo)** is only needed later, if Richard wants to send **more than 100/day**. (When that happens, we raise the in-app cap with one setting — `BROADCAST_DAILY_CAP` — no code change.)

---

## Step 1 — Add the sending subdomain in Resend

We send bulk email from a **dedicated subdomain** (`news.rparryfinancial.com`) so a marketing complaint never hurts the deliverability of the app's important transactional email (buyer estimates, LO alerts).

1. Sign in at **resend.com** → left menu **Domains** → **Add Domain**.
2. Enter **`news.rparryfinancial.com`** → **Add**.
3. Resend shows a set of **DNS records** to add — typically:
   - an **SPF** record (TXT),
   - one or more **DKIM** records (CNAME or TXT),
   - a **DMARC** record (TXT),
   - a **return-path / MX** record.
4. Add those exact records at your DNS host — **Network Solutions** (or have **Raise Your Media / Dominika** add them, since they manage the DNS).
5. Back in Resend, wait until the domain shows **Verified** (usually minutes, sometimes a few hours).

> Tip: copy each record from Resend exactly. If a value ends with a dot or your host adds the domain automatically, follow your host's convention so you don't double up (e.g. `news.rparryfinancial.com.rparryfinancial.com`).

---

## Step 2 — Set the sender in Netlify

1. Netlify → the BuyerBridge site → **Site configuration** → **Environment variables** → **Add a variable**.
2. Add:
   - **Key:** `BROADCAST_FROM`
   - **Value:** `R Parry Financial <news@news.rparryfinancial.com>`
   - **Scope:** at least **Production** (add **Branch deploys** too if you want to test on the QA URL first).
3. (Optional) other overrides — all already default to R Parry's values, set only if you want to change them:
   - `BROADCAST_DAILY_CAP` — the per-send limit (defaults to **100**).
   - `BROADCAST_ADDRESS`, `BROADCAST_WEBSITE`, `BROADCAST_PHONE`, `BROADCAST_PRIVACY_URL`, `BROADCAST_FOOTER_LOGO` — the footer identity.

---

## Step 3 — Redeploy

Netlify → **Deploys** → **Trigger deploy** → **Deploy site**. Environment variables only take effect on a fresh deploy.

---

## Step 4 — Verify it's live and send a test

1. Open **Dashboard → Broadcasts**. The yellow **"Sending is not enabled yet"** banner should be **gone**, and the **Send** buttons active.
2. Compose (or Load from Word), pick an audience, check the **Preview** (it shows a real recipient's real links).
3. Click **Send test to me** → check your inbox **and spam folder**.
4. In **Recipients**, select up to **100** people, then **Send to N selected**.

---

## Good to know

- **Compliance is automatic.** Every broadcast carries the **PO Box address** and a working **Unsubscribe** link (required by CAN-SPAM). Anyone who unsubscribes is skipped on every future send.
- **Stay under the cap.** The app blocks sends over 100 (server-side too), so you can't accidentally exceed the free limit.
- **Warm up.** For best deliverability on a brand-new sending subdomain, start with smaller sends the first few days before going to the full list.
- **Two senders, on purpose.** `RESEND_FROM` (transactional, `rparryfinancial.com`) stays separate from `BROADCAST_FROM` (bulk, `news.rparryfinancial.com`). Don't point broadcasts at the transactional sender.

---

*Once Resend shows you the exact DNS records, paste them to Marvin/Claude and we'll confirm precisely what to enter where.*
