# EarnedHome — Infrastructure & Architecture (current state)
**The actual, as-built setup: environments, database, pricing engine, and configuration. Updated June 21, 2026.**

> This is the EarnedHome-specific, current-state reference. For the *reusable* blueprint see [`ENVIRONMENT_ARCHITECTURE.md`](ENVIRONMENT_ARCHITECTURE.md); for the deploy recipe see [`HOW_TO_DEPLOY.md`](HOW_TO_DEPLOY.md); for the lifecycle see [`sdlc/`](sdlc/README.md); for what's **planned but not yet built** (AI/LLM, readiness generator, lead-handoff automation), see [`ROADMAP_PHASE_2_3.md`](ROADMAP_PHASE_2_3.md).

---

## 1. Environments at a glance

| Environment | Branch | URL | Pricing engine | Database |
|---|---|---|---|---|
| **Local** | working copy | `localhost:3000` | `graph` (real workbook) via `.env.local` | shared Supabase (prod project) |
| **QA / Staging** | `dev` | `dev--earnedhome.netlify.app` | **`graph`** (real workbook) | **shared Supabase (same as prod)** |
| **Production** | `main` | `earnedhome.netlify.app` | **`stub`** (demo math) until go-live | shared Supabase |

**Key facts right now:**
- **Production runs the demo (`stub`) engine** — it is *not* yet live on real pricing. Going live = merge `dev → main` **and** set `PRICING_ADAPTER=graph` on the Production context.
- **QA runs the live (`graph`) engine** — it reads the real workbook, for end-to-end testing.
- **QA and Production share ONE Supabase database** (see §3).

```
┌───────────────┐   git push dev   ┌──────────────────────┐   merge dev→main   ┌─────────────────────────┐
│ LOCAL          │ ───────────────▶│ QA  (dev branch)      │ ─────────────────▶│ PRODUCTION (main)        │
│ localhost:3000 │                 │ dev--earnedhome…app   │                   │ earnedhome.netlify.app   │
│ engine: graph  │                 │ engine: graph (live)  │                   │ engine: stub (demo)      │
└───────────────┘                 └──────────────────────┘                   └─────────────────────────┘
        │                                   │                                        │
        └───────────────┬───────────────────┴────────────────────┬───────────────────┘
                        ▼                                         ▼
              ONE Supabase database                    ONE workbook file (OneDrive/SharePoint)
              (leads, quotes, events, notes)           (rates → payments), read via Microsoft Graph
```

---

## 2. Stack

| Layer | Technology |
|---|---|
| Framework / UI | Next.js 14 (App Router) + React + TypeScript |
| Hosting / CI-CD | Netlify (auto-deploy from GitHub: `main`→prod, `dev`→QA, PR→preview) |
| Database / Auth | Supabase (Postgres + Auth + Row-Level Security), multi-tenant |
| Pricing engine | The loan officer's Excel workbook in M365 OneDrive/SharePoint, read/written via the Microsoft Graph API |
| Source control | GitHub `mtimmons1227/earnedhome` (private) |

---

## 3. Database — QA vs Production

**There is ONE Supabase project** (`EarnedHome`, ref `azfesppisxniclnntrmc`), and **both QA and Production use it.** This is a deliberate interim choice ("Option B").

- **Why shared:** the Supabase free plan allows 2 active projects, and the org already has 2 active (EarnedHome + CrewCore). A dedicated QA database would require pausing a project or upgrading to Pro — deferred until launch.
- **What this means:** code/UI is isolated by branch, but **data is not**. Test leads/notes/status changes made on QA land in the same tables Production reads. A login created in this project works on **both** QA and Production.
- **How we keep it clean (interim):** when testing on QA, use a recognizable marker (name `QA TEST` / email `qatest@earnedhome.test`), then run the cleanup query to delete test rows:
  ```sql
  DELETE FROM events
  WHERE type = 'lead_note'
    AND (payload->>'leadId') IN (SELECT id::text FROM leads
      WHERE full_name ILIKE '%qa test%' OR email ILIKE '%qatest%');
  DELETE FROM leads WHERE full_name ILIKE '%qa test%' OR email ILIKE '%qatest%';
  ```
- **Planned (at launch):** create a separate **EarnedHome-QA** Supabase project and point the QA branch-deploy's `NEXT_PUBLIC_SUPABASE_URL` / `…PUBLISHABLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY` at it (scoped to Branch deploys). Then QA gets its own database and full isolation.

**Schema (multi-tenant, RLS):** `tenants`, `app_users` (roles: admin/lo/staff), `communities`, `quotes`, `leads`, `events`. RLS scopes reads/writes to the signed-in user's tenant. Leads are **tenant-shared** (every user in a tenant sees the same inbox), not per-LO.

**Per-tenant identity (migration `0005_tenant_identity.sql`):** `tenants` carries the static compliance/identity fields rendered in the buyer disclosure — `lo_name` (display), `nmls` (originator), plus `legal_name`, `company_nmls`, `originator_name`. These are set once at onboarding (R Parry confirmed; `acme`/`bluekey` demos left null). Frequently-changing eligibility/overlay fields are a Phase II admin-dashboard concern; the legal disclosure prose stays locked in code.

---

## 4. Pricing engine — two independent switches

This trips people up, so it's worth stating plainly. There are two separate settings:

1. **`GRAPH_WORKBOOK_DRIVE_ID` / `GRAPH_WORKBOOK_ITEM_ID`** = *which* file. There is **one** workbook (the real RateStream file in OneDrive/SharePoint). Same file for every environment. The pricing engine only **reads** it; the only writes are admin uploads via the workbook tool (versioned, rollback-able).
2. **`PRICING_ADAPTER`** = *whether the buyer page opens that file* (`graph`) or **shows demo math** (`stub`). This is set **per Netlify deploy context**: `graph` on Branch deploys (QA), `stub` on Production.

So "pointing to the workbook" (`GRAPH_WORKBOOK_*`) and "using it for buyer pricing" (`PRICING_ADAPTER=graph`) are different things. The results footer shows **"Live engine"** (graph) or **"Demo / stub engine"** (stub).

**The adapter pattern:** the app only calls a `PricingAdapter` interface (`src/lib/pricing/types.ts`) with two implementations — `stub` (demo) and `graph` (live workbook). Swapping them is a single env var, zero UI change.

**Graph read modes (`GRAPH_OUTPUT_MODE`):** the `graph` adapter batches all calls (`/$batch`). In `cells` mode (default) it reads each output named range; in `grid` mode it reads one contiguous block — the **`EH_Out` tab**, a reference grid gathering every `eh_out_*` output into `eh_out_grid` (`B2:N7`), read in a single call (~3 Graph round-trips, ~1s). The `EH_Out` tab decouples the app from the engine's layout: Richard can rearrange Front/Engine freely as long as the reference cells resolve. Spec: [`specs/eh-out-tab-spec.md`](specs/eh-out-tab-spec.md).

---

## 5. The Rate Workbook tool (admin-only)

A guarded screen at `/dashboard/workbook` (admins only) to update the rate file with no risk of breaking the website's link to it:
- **Download** the workbook → edit the **Rate** tab in Excel → **Upload & Replace** (replace-in-place via Graph `PUT …/content`, so the file's address/item-ID never changes).
- Safeguards: admin gate, filename guard, `.xlsx`/zip/size checks, post-replace named-range verification, SharePoint version-history rollback.
- Uses the app's own Graph credentials, so the admin needs no personal access to the file.
- Spec: [`specs/workbook-swap-tool.md`](specs/workbook-swap-tool.md).

---

## 6. Environment variables (what's set where)

Stored in Netlify (host) and `.env.local` (local) — **never committed**.

| Variable | Purpose | Netlify scope |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `…PUBLISHABLE_KEY` | Supabase connection | all contexts (same value) |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only trusted writes | (set as needed) |
| `NEXT_PUBLIC_ROOT_DOMAIN` | subdomain/tenant routing | all contexts |
| `PRICING_ADAPTER` | `stub` (demo) or `graph` (live) | **per-context: `graph` on Branch deploys, `stub` on Production** |
| `GRAPH_TENANT_ID` / `GRAPH_CLIENT_ID` / `GRAPH_CLIENT_SECRET` | Microsoft Graph app credentials | all contexts (inert where unused) |
| `GRAPH_WORKBOOK_DRIVE_ID` / `GRAPH_WORKBOOK_ITEM_ID` | which workbook file | all contexts |
| `GRAPH_OUTPUT_MODE` | `cells` (default — one read per output) or `grid` (single read of `EH_Out!eh_out_grid`, ~3 Graph calls, ~1s) | **per-context: set `grid` where the `EH_Out` tab is verified live; unset elsewhere** |
| `NEXT_PUBLIC_ENABLE_PASSWORD_RESET` | shows the LO "Forgot password?" flow when `true` | **off (unset) until Resend SMTP is configured — see go-live gate** |

---

## 7. Auth & roles

- **Admins** (full dashboard + workbook tool), both on the `earnedhome` tenant: **Marvin Timmons** (`marvin@incryptable.com`), **Richard McHargue** (`richard@rparryfinancial.com`).
- **Roles:** `admin` (manages rates/workbook), `lo` (works leads), `staff`. The workbook tool is **admin-only**.
- White-label partner tenants (`acme`, `bluekey`) exist but have no users yet; when onboarded, their people get `lo`/`staff`, never admin (R Parry's shared workbook powers all fronts).

---

## 8. Operations

- **Daily rate update:** an admin uses the workbook tool (or edits the file directly) — Download → edit Rate tab → Upload & Replace. The site picks up new rates within the 5-min cache (or instantly on a changed buyer input).
- **Rollback:** Netlify deploy history (app) + SharePoint version history (workbook).
- **Go-live checklist:** merge `dev → main`; set `PRICING_ADAPTER=graph` on Production; (recommended) stand up the separate QA Supabase project; partner RESPA review of disclosure/educational copy.

---
*Related: [`ENVIRONMENT_ARCHITECTURE.md`](ENVIRONMENT_ARCHITECTURE.md) · [`HOW_TO_DEPLOY.md`](HOW_TO_DEPLOY.md) · [`CONTRIBUTING.md`](../CONTRIBUTING.md) · [`sdlc/03-design.md`](sdlc/03-design.md) · [`specs/`](specs/).*
