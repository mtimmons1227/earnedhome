# White-Label Architecture — EarnedHome

**Status: design reference (Phase 1A foundation built; scaling items are Phase II+).**
**Belongs to: SDLC Phase 3 (Design) — see [sdlc/03-design.md](sdlc/03-design.md); scaling items tracked in [sdlc/08-future-releases.md](sdlc/08-future-releases.md).**

How EarnedHome runs as a white-label product: each builder / loan officer sees *their* brand, on *their* domain, while everything runs on **one** shared platform that we operate.

---

## 1. The core decision — our infrastructure, not theirs

White-label means the product **looks** like the partner's (their domain, logo, colors) but runs on **our single Supabase + Netlify platform**. It does **not** mean a copy deployed on each builder's server.

- **Hosting:** Netlify (our account). Partner domains attach to our production deploy via DNS/SSL; the app and API routes are ours.
- **Database + Auth:** Supabase (our project). One Postgres, one auth pool, tenant isolation in software (Row-Level Security).
- **Pricing engine:** each loan officer's own Excel workbook in their M365, read live via Microsoft Graph.

We would only consider running on a partner's own infrastructure for a rare enterprise/on-prem contractual demand (Phase IV-V), and even then reluctantly — per-partner deployments would mean we own updates, patching, security, and support across N machines, which breaks the SaaS model.

## 2. The isolation spectrum (where we sit, and why)

| Model | Isolation | Onboarding | Ops cost | Use |
|---|---|---|---|---|
| **Shared DB + shared schema + RLS** *(current)* | Logical (per-row `tenant_id` + RLS) | Instant | Lowest | **Phase 1A → III** |
| Shared DB + schema-per-tenant | Stronger | Medium | Medium | If a client needs schema separation |
| DB-per-tenant (separate Supabase project each) | Strong | Slow | High | Enterprise data-separation demand |
| Separate deploy on partner infra | Physical | Manual | Highest | On-prem only, last resort |

**Decision: stay shared-multi-tenant with RLS through Phase III.** It's the standard SaaS approach, gives instant onboarding, and the foundation already exists (`tenants` table, `slugFromHost`, `app_users`, RLS policies). White-label is an *extension* of what's built, not a re-architecture.

## 3. What's already built (the foundation)

- **`tenants` table** with per-tenant `branding` (primary/accent/bg colors, initials, tag, logo), `lo_name`, `nmls`, `slug`, `status`.
- **Host → tenant resolution** (`src/lib/tenant.ts` `slugFromHost`): `acme.earnedhome.com` → tenant `acme`; `localhost` / root → default tenant. Middleware sets `x-tenant-slug`.
- **`app_users`** links a Supabase auth user to a tenant + role (`admin` / `lo`).
- **RLS** scopes leads/quotes/events/notes by tenant; anon buyers can insert but not cross-read.

## 4. Issues by area (and how we handle them)

### Login / Auth — the main white-label friction
1. **One global auth pool.** Supabase `auth.users` is single per project, so **emails are unique across all tenants**. Fine for a few distinct LO users per tenant (and lets one LO belong to multiple tenants via multiple `app_users` rows), but two tenants can't each own the *same* email as separate users.
2. **Branded auth emails are the hard limit.** Password-reset / invite / magic-link emails use Supabase's **global** templates — one set per project. We can't per-tenant-brand them on a single project. Mitigations: (a) keep auth emails generic ("EarnedHome"); (b) for buyer-facing branded mail, **generate the link ourselves and send via Resend** with per-tenant branding; (c) separate Supabase projects per tenant (heavy — enterprise only). For LO-only reset (Phase 1A) this barely matters.
3. **Redirect-URL allowlist + custom domains.** Every tenant domain must be in Supabase Auth → Redirect URLs and attached to Netlify (DNS/SSL). Manual at a handful of tenants; **scripted onboarding + wildcard patterns** at scale. Cookies are per-origin, which is *good* for white-label (a tenant's users sign in only on their own domain).
4. **SSO (future):** builders may want SAML SSO for their teams — Supabase supports it on paid tiers; Phase II+.

### Database
- **#1 risk: an RLS bug leaking cross-tenant data.** Mitigation: `tenant_id` on every table, default-deny policies, and an automated test that signs in as tenant A and asserts it cannot read tenant B (extend the existing anon-role RLS tests per tenant).
- **Blast radius:** one DB → a bad migration affects everyone → migrations go dev → QA → prod (already the process).
- **Scale:** add connection pooling (Supavisor) and per-tenant indexes as tenant count grows; watch noisy-neighbor load.
- **Data residency:** a partner contractually demanding their data in a separate store pushes toward DB-per-tenant (enterprise only).

### Branding & domains
- Branding already per-tenant in `tenants.branding`. Logo upload → Supabase Storage per tenant.
- **Subdomains** (`builder.earnedhome.com`) via wildcard DNS + SSL for fast onboarding; **custom domains** (`lender.builderhomes.com`) for premium white-label, each CNAME'd to Netlify.

### Pricing engine (per-tenant) — needs code work
- **Today `PRICING_ADAPTER` and `GRAPH_WORKBOOK_*` are global env vars — one workbook for the whole app.** The moment a second LO has their own RateStream, each tenant's **workbook drive/item id must live in the `tenants` row** and be read per request, not from one env var. This is the single biggest adapter change for going multi-LO.

### Onboarding automation
- Adding a builder today is manual (insert tenant, set branding, attach domain, create the LO's named ranges, add `app_users`). At scale, build a one-screen **"onboard a builder"** admin flow so it's repeatable and low-error.

### Compliance (RESPA) thread
- A builder's branded site routing buyers to a lender keeps us in **RESPA Section 8** territory (preferred-lender / thing-of-value rules). Clean per-tenant data separation supports the story; the "who is the lender for this tenant" mapping must be explicit and disclosed.

## 5. Phased checklist — what's needed at 2 tenants vs. 20

**At ~2 tenants (near term):**
- Move workbook drive/item id into the `tenants` row; adapter reads per-tenant (replaces global `GRAPH_WORKBOOK_*`).
- Add each tenant's domain to Supabase redirect URLs + Netlify; document the steps.
- Per-tenant RLS isolation test (A can't read B).
- Decide auth-email branding stance (generic vs. self-sent via Resend).

**At ~20 tenants (scale):**
- "Onboard a builder" admin flow (tenant + branding + domain + workbook + users in one place).
- Wildcard domain + redirect patterns; automated DNS/SSL.
- Connection pooling, indexes, monitoring per tenant.
- Per-tenant eligibility overlays (LO-level limits — see [specs/eligibility-edit-checks.md](specs/eligibility-edit-checks.md)).
- Billing per tenant (Stripe).
- SSO / branded auth emails for partners who require them.

## 6. Bottom line
Stay on our Supabase + Netlify, shared multi-tenant with RLS. The near-term white-label work is **per-tenant workbook ids, an onboarding flow, the redirect-allowlist / custom-domain process, and a decision on how branded the auth emails must be.** None of it is a re-architecture — the multi-tenant spine is already in place.
