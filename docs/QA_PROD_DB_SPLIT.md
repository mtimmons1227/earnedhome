# Runbook — Split QA and Production databases

**Goal:** give QA and Production their **own** Supabase databases, so test data (create/wipe freely) never touches real buyer data. Do this **before the first real buyer** goes through `home.rparryfinancial.com`.

## Why (the trigger)
Today **one** Supabase project (`azfesppisxniclnntrmc`) backs local, QA, and Prod. The recent "start fresh" wipe cleared **both** environments — fine now (no real buyers), but the moment a real, TCPA-consented buyer lands on Prod, a QA cleanup would delete a real customer's record. Splitting the DB is the last piece of environment isolation.

## What's separate vs. shared, after the split
| Layer | Before | After the split |
|---|---|---|
| **Code** | branches `dev` (QA) / `main` (Prod) | unchanged — already separate |
| **Env vars** | per Netlify context | unchanged — already separate |
| **Database** | **shared** (one project) | **separate** (two projects) ← this runbook |
| **Pricing engine (workbook via Graph)** | shared workbook | **still shared** — the *only* thing common to both (see note) |

### Note on the engine (the last shared thing)
After this split, the **RateStream workbook is the one resource both environments read.** That's mostly OK — you *want* QA to test against real rates. Two things to know:
- **Concurrency:** QA and Prod both write inputs into the same sheet to compute; the process lock serializes, but heavy simultaneous use could contend. Low risk at pilot volume.
- **The real fix is the native pricing engine** (`specs/native-pricing-engine.md`): once pricing is code with its own `RateData`, each environment runs independently and **nothing** is shared. Interim option if contention ever appears: give QA its own workbook copy (separate `GRAPH_WORKBOOK_*` on the QA/Branch context).

## Decision: which project is which
Keep the **current project as Production** (it holds the verified tenant identity, Richard's login, and the established config) and create a **new, clean project for QA**. This way Prod's env is unchanged; only QA/Branch/Local get repointed.

---

## Steps

### 1. Create the QA Supabase project
- Supabase → New project (e.g., **"EarnedHome-QA"**, same region `us-east-1`).
- Copy its **Project URL**, **anon/publishable key**, and **service_role key**.

### 2. Run all migrations on the QA project
Run `0001`–`0011` (in order) in the QA project's SQL editor — same files as `supabase/migrations/`. This builds the identical schema (tenants, app_users, quotes, leads, agents, events, RLS, `closed_at`, etc.).

### 3. Seed the tenant(s) + LO login on QA
- Use the onboarding clone script ([`TENANT_ONBOARDING.md`](TENANT_ONBOARDING.md)) to create the R Parry tenant row on QA (Block A). *(No `_template` yet on QA — either create it first, or paste the R Parry values directly.)*
- Create a **QA test login**: Supabase (QA) → Authentication → Users → Add user (a test email), then insert the `app_users` row linking it to the QA tenant (Block B). This is your QA dashboard login — separate from Richard's real Prod login.
- Set QA's `tenants.notify_email` to a **test inbox** (not Richard).

### 4. Point Netlify env vars per context
On Netlify → Environment variables, set these to **different values per deploy context**:

| Variable | Production context → | QA (Branch deploys) + Local → |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **current** project URL | **new QA** project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | current anon key | QA anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | current service_role | QA service_role |

Update **`.env.local`** to the QA project's URL + keys so local dev also uses QA. Leave Production's values on the current (Prod) project.

### 5. Redeploy both
- Retry the **`dev`** deploy (QA now points at the QA DB).
- Trigger a **Production** deploy (still the current DB — values unchanged, but redeploy to be safe).

### 6. Verify isolation
- Sign into the **QA** dashboard (test login) → create a test lead → it appears on QA only.
- Sign into **Prod** (`home.rparryfinancial.com/login`, Richard's account) → confirm QA's test lead is **not** there.
- Run the "start fresh" wipe **on QA only** → confirm Prod data is untouched. ✅ Isolation proven.

---

## After the split — the golden rule
- **Wipe/test freely on QA.** Never run destructive SQL on the Prod project once real buyers exist.
- **Migrations:** run new ones on **QA first**, verify, then Prod.
- **Onboarding a tenant:** run the clone script in **both** projects (or Prod only for a real tenant; QA for testing).
- `notify_email`, `LEAD_NOTIFY_OVERRIDE`, `RESEND_FROM` continue to work per the existing routing — but now the DB values are per-environment too.

## Rollback
If anything's off, repoint the Netlify Branch/Local vars back to the current project and redeploy — you're back to the shared setup instantly (no data lost, since Prod was never moved).
