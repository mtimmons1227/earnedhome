# EarnedHome — Architecture Notes (multi-tenancy + pricing engine)

_Source of truth for two things people keep asking about: how tenants work (and how to add a builder), and where R Parry's pricing workbook must live. Last updated June 6, 2026._

> **⚠ Current-state note (June 21, 2026):** §1 (multi-tenancy) is still accurate. §2 (pricing-engine hosting) is **partly superseded** — the engine is now **connected and live on QA**. Differences from §2 below: there is currently **one shared workbook** (not separate test/prod copies); `PRICING_ADAPTER` is set **per Netlify context** (`graph` on QA, `stub` on Production); the field map is now **v4** (91 named ranges), not v3; and the "prerequisites before connect" are **done**. For the authoritative as-built setup see **[`INFRASTRUCTURE.md`](INFRASTRUCTURE.md)**.

---

## 1. Multi-tenancy model

EarnedHome is multi-tenant from day one. Every business row carries a `tenant_id` and is isolated by Postgres row-level security (RLS).

### The granularity decision (important)

- **A `tenant` = one builder, agent, or LO company.** It owns the co-branding (logo, colors, tag), the subdomain (`acme.earnedhome.com`), the routed loan officer, and the billing relationship.
- **A `community` = a child of a tenant** (`communities.tenant_id`). One builder has many communities. Communities are the **per-community billing meter** (value-based pricing), and later the grouping for listings (Image 2).
- **Rule: ONE tenant per builder, MANY communities under it.** Do **not** create a tenant per community — that would fragment branding/subdomains and billing.
  - Edge case: if a single company runs two genuinely separate brands, each brand becomes its own tenant.
  - An agent or LO company (e.g. BlueKey Realty) is also just a tenant.

### Data model (migration `0001_init_multitenant.sql`)

```
tenants     id, slug (subdomain), name, type(master|builder|agent|lo_company),
            status, branding(jsonb), lo_name, nmls, custom_domain
communities id, tenant_id ->, name, location, active        (billing meter)
app_users   id(=auth.users), tenant_id ->, role(admin|lo|staff), full_name, email, nmls
quotes      id, tenant_id ->, inputs(jsonb), outputs(jsonb), rates_as_of
leads       id, tenant_id ->, community_id, quote_id, contact, consent_tcpa,
            consent_text, consent_at, source, routed_to, status, idempotency_key
events      id, tenant_id ->, type, payload(jsonb)           (metering)
```

### How isolation is enforced (RLS, migrations 0001–0003)

- Public/buyer (anon role): can READ active tenants + communities (to render the branded page) and INSERT quotes/leads/events for an active tenant. A lead INSERT additionally requires `consent_tcpa = true` (TCPA enforced at the database, not just the UI). Anon has **no SELECT** on quotes/leads — one tenant can never read another's leads.
- Authenticated LO/admin: helper `private.is_tenant_member(tenant_id)` scopes all dashboard reads/updates to the user's own tenant. Verified by test as the anon role: reads active tenants, returns 0 other-tenant leads, blocks non-consented inserts.
- Tenant resolution: `src/lib/tenant.ts` maps the request host → tenant slug (`acme.earnedhome.com` → `acme`), with a localhost/preview fallback to the `earnedhome` default tenant. Set in middleware.

### Onboarding a NEW builder — runbook (data op, NO deploy)

Provisioning a builder is inserting rows. The wildcard subdomain resolves the new slug automatically; nothing is rebuilt or redeployed.

```sql
-- 1) Create the builder tenant (slug = subdomain).
insert into public.tenants (slug, name, type, branding, lo_name, nmls)
values (
  'acme', 'Acme Homes', 'builder',
  '{"primary":"#0B6B53","accent":"#13A077","bg":"#F1F8F5","initials":"AH","tag":"New homes, made simple"}'::jsonb,
  'Acme preferred lender', '927662'
);

-- 2) Add the builder's communities (the billing meters).
insert into public.communities (tenant_id, name, location)
select id, 'Sunset Ridge', 'Frisco, TX' from public.tenants where slug = 'acme';

-- 3) Create the loan officer's login (auth user via Supabase dashboard or Admin API),
--    then link it to the tenant:
insert into public.app_users (id, tenant_id, role, full_name, email)
select '<auth-user-uuid>', id, 'lo', 'Jane Officer', 'jane@acme.com'
from public.tenants where slug = 'acme';
```

Result: `acme.earnedhome.com` is immediately live, co-branded, capturing leads scoped to Acme; Jane sees only Acme's leads on the dashboard. (Custom domain optional, added later per tenant.)

> Future nicety: wrap steps 1–3 in an admin "Add builder" screen or a `provision_tenant()` SQL function. Until then, run the SQL above. This is the only repeatable step needed per builder.

---

## 2. Pricing engine hosting (where R Parry's workbook must live)

The app reads/writes Richard's workbook via the **Microsoft Graph Excel API**, by **named range** (`eh_in_*` / `eh_out_*`) — never by cell address. See `src/lib/pricing/` (the `PricingAdapter` contract) and the field map in `06 Pathfinder 1A/EarnedHome_Pricing_Engine_Field_Mapping_v3.xlsx`.

### Hard requirement

Graph Excel only drives workbooks stored in **Microsoft 365 (work/school): SharePoint document library or OneDrive for Business**, accessed by an **Entra (Azure AD) app** with application permissions. It will NOT work against a local file, a personal/consumer OneDrive, Google Drive, or Dropbox.

- Host the workbook in a **company-controlled** SharePoint library / service-account OneDrive — **not** Richard's personal account (implementation-plan red flag: a moved/edited personal file breaks production).
- Register an Entra app, app-only auth: `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET` (server-side only).
- Reference the file by `GRAPH_WORKBOOK_DRIVE_ID` + `GRAPH_WORKBOOK_ITEM_ID`.
- App flow: open workbook session → PATCH `eh_in_*` named ranges → recalc → GET `eh_out_*` → close. Cache by input hash; serialize writes with a lock (single shared workbook is the throughput bottleneck).

### Environment matrix

| Environment | `PRICING_ADAPTER` | Workbook it points at |
|---|---|---|
| Local dev / UI work | `stub` | none — illustrative math (current default) |
| Staging / integration test | `graph` | a **TEST copy** of the workbook in company SharePoint |
| Production | `graph` | the **live** workbook in company SharePoint (Richard's daily-updated rate sheet) |

Keep test and production as **separate workbook copies** (separate `GRAPH_WORKBOOK_ITEM_ID`) so test traffic never touches the live rate sheet. There is no local-Excel path; even local engine testing calls the cloud-hosted TEST workbook via Graph.

### Prerequisites before 1A.2 can connect (owners)

1. Company **Microsoft 365 Business** subscription (so there's a tenant + SharePoint + service account). — Marvin/company
2. Workbook moved to that SharePoint, named ranges created. — Richard (see Field_Mapping_v3)
3. Entra app registered + `GRAPH_*` env set in Netlify (prod) and staging. — Marvin
4. Resolve the open questions in Field_Mapping_v3 (esp. the 4-products-one-worksheet decision). — Richard
