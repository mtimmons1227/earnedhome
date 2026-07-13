# Production vs. Test Database — Strategy & Go‑Live Cutover

**Status:** Recommendation for Richard's review
**Owner:** Marvin · **Product:** EarnedHome
**Decision:** Split into separate **Production** and **Test** databases before go‑live.

---

## 1. Where we are today

Local development, QA (`test` branch → `test--earnedhome.netlify.app`), and Production
(`main` → `home.rparryfinancial.com`) all point at **one** Supabase project
(`azfesppisxniclnntrmc`). This has been fine during build‑out because there is no real
data yet — but it means test activity and real activity would share the same tables.

The clearest symptom: during testing we routinely run "clear the database." The day a
real buyer connects, that same command would delete a **real** borrower's record. That
is the core reason a shared database can't continue into production.

## 2. The two options

### Option A — One shared database (current)

**Pros**
- Simplest possible setup: one schema, one migration history, one set of secrets.
- Free (single project).
- QA is literally production data, so a production bug reproduces exactly.
- Fastest iteration — no data promotion step.

**Cons**
- **Test data pollutes real data** — fake leads/agents and "clear everything" hit the
  same tables real borrowers live in.
- **Real people get hit by test actions** — a test that sends an email or runs a
  destructive migration executes against live borrower rows.
- **Compliance red flag** — for a mortgage business, dev/test touching production
  borrower PII (names, emails, phones, financial scenarios) is exactly what an audit dings.
- **No safe place** to rehearse a risky migration or bulk change before customers feel it.

### Option B — Separate Production and Test databases (recommended)

**Pros**
- **Full isolation** — QA can create, delete, send test emails, and run scary migrations
  with zero risk to real data or real people.
- **Compliance‑clean** — real borrower PII lives only in Production; Test uses synthetic data.
- **Safe migration rehearsal** — apply + verify on Test, then Production.
- **Small, understood blast radius** — a QA mistake can't reach a customer.

**Cons**
- **Two environments to keep in sync** — every migration must be applied to both
  (discipline, or a small CI step, prevents schema drift).
- **Two sets of keys** in Netlify — already scoped per deploy context, so low effort.
- **Test needs seed data** — it has no real leads; we already hand‑create test data.
- **Slightly more ops/cost** — a second project. Free tier covers Test; Production should
  move to a paid plan at go‑live anyway (for backups / point‑in‑time recovery).

## 3. Recommendation

**Split into Production and Test before go‑live**, before any real buyer or PII touches the
system. For a lender handling borrower data, the isolation and compliance benefits clearly
outweigh the small sync overhead, and the shared model's failure mode — a test action
harming a real customer — is unacceptable once live.

Keep sharing for day‑to‑day development right up until go‑live (there's no real data yet),
then perform the split as the **first step of going live**, so Production starts clean and
isolated on day one. This matters even more later: as a multi‑tenant SaaS with several
broker tenants in Production, Production must be walled off from test.

The app is already built for this: env vars are per Netlify deploy context, and migrations
live in `supabase/migrations`.

## 4. Target setup after the split

| Environment | Git branch | Site | Database |
|---|---|---|---|
| **Production** | `main` | home.rparryfinancial.com | **New Supabase project** (paid, backups on) |
| **QA / Test** | `test` | test--earnedhome.netlify.app | Current project (`azfesppisxniclnntrmc`) |
| **Local dev** | `rel` / local | localhost | Current project (Test) — or a local Supabase |

So: **stand up a brand‑new project for Production**, and demote the current project to
**Test/Dev**. (This keeps all our existing test data where it already is.)

## 4b. Two different kinds of separation (don't confuse them)

- **Environment separation — Test vs Production (two databases).** Keeps *fake test data*
  away from *real customer data*. That's what this document is about.
- **Tenant separation — many brokers inside the ONE Production database.** All broker
  tenants share the single Production database; each tenant's rows are stamped with a
  `tenant_id`, and Row‑Level Security (RLS) ensures a signed‑in user only sees their own
  tenant's data. One shared "building," locked rooms per tenant.

This is the standard SaaS model (pooled multi‑tenancy): one Production database, cheap to
run/migrate/back up, with per‑tenant isolation enforced in the data layer. If a large
enterprise broker ever requires physical isolation or data residency, that one tenant can
be given a dedicated project as a premium tier — without changing the pooled model for
everyone else.

## 5. Go‑live cutover steps

1. **Create a new Supabase project** — name it clearly, e.g. `earnedhome-prod`. Choose a
   paid tier so **daily backups / point‑in‑time recovery** are on.
2. **Apply all migrations** `0006`–`0018` (the `supabase/migrations` folder) to the new
   project, in order, so the schema matches exactly.
3. **Seed Production** with only the real data: the R Parry tenant + branding, and the real
   loan officers (Richard, etc.) — no test leads/agents.
4. **Set Netlify env vars on the Production context** to the new project's values:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   Leave the **Branch‑deploy / Deploy‑preview / Local** contexts pointing at the current
   (Test) project.
5. **Verify** on a Production deploy: sign in as Richard, run one estimate end‑to‑end,
   confirm the lead lands in the **new** database and emails send from the verified domain.
6. **Lock it in** — from now on, real borrower data exists only in Production.

## 6. How we operate afterward

- **Migrations**: write once in `supabase/migrations`. Apply to **Test first**, verify,
  then **Production**. (A tiny CI step can automate "apply to both" later.)
- **Secrets**: the service‑role key is per project — never mix Production keys into Test or
  local. Keep them only in Netlify's context‑scoped env and `.env.local`.
- **Backups**: Production on a plan with PITR; Test can stay on the free tier.
- **Test data**: seed/reset Test freely — it never affects customers.
- **Reproducing a Production bug**: if needed, copy a **sanitized** subset into Test rather
  than pointing tools at Production.

## 7. Note on Supabase "branching"

Supabase offers preview databases per git branch (ephemeral). That's useful for PR previews
but adds cost/complexity and isn't a stable place for QA. For a persistent Prod + QA split,
**two plain projects** is simpler and clearer — that's what this doc recommends.

## 8. Decision

- [ ] Approve splitting into Production + Test at go‑live (Option B).
- [ ] Approve moving Production to a paid Supabase tier (for backups/PITR).
- [ ] Confirm who applies migrations to Production (and the "Test first, then Prod" rule).

---

## 9. Vocabulary (so the rest of this reads clearly)

- **Organization** = the *account / billing bucket*. The Supabase plan (Free or Pro) is set
  **on the organization**, and one bill covers everything inside it.
- **Project = Database.** In Supabase these are the same thing. Each project card is one
  database with its own URL, its own login system, and its own keys.
- **App** = *our software* (the Next.js code on Netlify). The app is **not** stored in
  Supabase — it just *points at* a database by holding that database's URL + keys in its
  settings. The app is the tenant; the database is the apartment it rents.

Hierarchy: **Organization** (where you pay) → contains **Projects/Databases** → each is
**pointed at by an App** via keys.

## 10. Billing rules and the multi‑org layout

**A plan lives on the organization, not the project.** The moment an org is Pro, *every*
database in it is Pro and incurs compute (first database's compute is covered by the $25
base; each additional running database ≈ +$10/mo). **You cannot have one free and one paid
database in the same org.**

**To mix free and paid, use separate organizations** (all under the same Supabase login;
switch with the org dropdown, top‑left). Free = 2 active projects per org; extras pause
after ~1 week idle.

### Planned org structure

| Organization | Plan | Holds | Free‑tier note |
|---|---|---|---|
| **PRD** (rename of `marv_timmons@yahoo.com's Org`) | **Pro** | Live Production databases (EarnedHome, later Compliance, CrewCore) | First DB's compute in the $25; each extra live DB ≈ +$10/mo |
| **QA 1** | Free | 2 test databases | Auto‑pause when idle (fine for test) |
| **QA 2** | Free | 2 more test databases | Two free orgs = 4 free test DBs total |

This works. It's a valid, common way to keep Production backed‑up/always‑on while test
databases stay $0.

## 11. The promotion model (important — don't relocate databases)

**QA and Production are two separate, permanent databases that both live forever.** You do
**not** promote by moving a QA database into the PRD org — QA must stay QA so there's always
a sandbox. When an app (e.g., Compliance) goes live:

1. Stand up a **fresh Production database inside the PRD org**.
2. Apply all migrations to it (schema only).
3. Seed it with **real** data.
4. Point the live app's Netlify **Production** context at it.
5. The QA database stays in QA 1 for the next round of testing.

(Supabase does have a "transfer project to another org" button — a billing/ownership move —
but we won't use it to promote, because it would leave us with no sandbox.)

### Pointing an app at a database

Each database exposes three values: **Project URL**, **publishable (anon) key**,
**service‑role key**. The app knows nothing about orgs — only these three values, set in
**Netlify environment variables per deploy context**:

- **Production** context → Prod database's URL + keys
- **Branch / Preview** context → QA database's URL + keys

Switching an environment to a different database = paste that database's three values into
the right Netlify context and redeploy. **Which org the database lives in is irrelevant to
the app.**

### Propagating a QA change to Production (across orgs)

Two independent tracks; crossing org boundaries adds **zero** difficulty:

- **Schema changes** travel as **migration files** in the repo. Run the migration against
  QA, verify, then run the *same* migration against Prod. A migration is just SQL run against
  whichever database you target — the org it sits in doesn't matter.
- **Code changes** travel through **git → Netlify** (`rel` → `test` → `main`). Merging to
  `main` redeploys Production, already pointed at the Prod database.

So "modify QA, then push to Prod" = merge the code branch **and** run the migration against
Prod.

**Data never propagates.** Only *schema* (migrations) and *code* (git) move from QA to Prod.
Fake QA rows are never copied to Production; real data is created fresh in Prod by real
users. That separation is the entire point of the split.

## 12. Alternatives considered (and why we stay on Supabase)

Evaluated whether a different database could be cheaper/more generous **without major code
changes**. Conclusion: **stay on Supabase.**

- **Why switching is costly:** the app uses Supabase for *auth* (logins, email sign‑in
  links, one‑time‑password verification, admin user API) and *RLS*, not just table storage.
  Replacing Supabase means rewriting all of that.
- **Neon** — more generous free tier on paper (100 projects, scale‑to‑zero), but **Postgres
  only, no built‑in auth/RLS**. Moving would require bolting on a separate auth system
  (Clerk/Auth0/Auth.js) and rewriting every login path — exactly the major change we're
  avoiding. Not worth ~$25/mo.
- **Firebase** — different (NoSQL) data model; near‑total rewrite. No.
- **Self‑hosting Supabase** — the only zero‑code‑change alternative (same software on a
  rented VPS, ~$12–25/mo). But we become the DBA: our own backups, security updates, uptime,
  ~1–2 hrs/mo maintenance. For borrower PII, self‑managed backups/uptime are a liability.
  Industry rule of thumb: self‑hosting only pays off once the cloud bill exceeds ~$200–300/mo
  — we're far below that.
- **Decision:** Supabase managed Production (~$25/mo, backups + uptime + zero maintenance
  included) is the cheapest option once our own time and compliance risk are counted. The
  real savings lever is **timing** — stay free while building, turn on paid Production only
  the week we actually go live.
