# EarnedHome — Phase 1A (Pathfinder)

Mobile-first buyer tool: 9 inputs → 30/15-yr Fixed & FHA payments, cash-to-close,
and (next) a 60-day get-ready plan — powered by R Parry's pricing engine. Builders
and agents co-brand it on per-tenant subdomains; leads route to a loan officer.

## Stack
- **Next.js 14** (App Router, React, TypeScript) — one codebase, handheld → full web, SSR for listing-page SEO.
- **Supabase** (Postgres + Auth + Storage) — multi-tenant via `tenant_id` + row-level security.
- **Microsoft Graph** (Phase 1A.2) — drives R Parry's live Excel workbook server-side behind the Pricing interface.
- Host on **Vercel/Netlify** with a wildcard subdomain (`*.earnedhome.com`).

## Project layout
    src/
      app/                  buyer page, layout, API routes (/api/quote, /api/lead)
      components/           BrandHeader, PathfinderTool (ported prototype UI)
      lib/
        pricing/            PricingAdapter contract + stub + Graph stub (1A.2)
        supabase/           server (RLS) + admin (service-role) clients
        tenant.ts           host → tenant resolution + branding
      middleware.ts         resolves tenant slug from request host
    supabase/migrations/    versioned DDL (multi-tenant schema + RLS + seeds)

## Multi-tenancy
Every business row carries `tenant_id`; RLS isolates tenants. The tenant is
resolved from the request host (`acme.earnedhome.com` → `acme`), with a
localhost/preview fallback to the `earnedhome` default. Three demo tenants
(earnedhome, acme, bluekey) are seeded to match the prototype.

## The pricing engine (the contract)
The app only ever calls `PricingAdapter` (`src/lib/pricing/types.ts`), whose
fields mirror the workbook's named ranges (`eh_in_*` / `eh_out_*`). Today it's
backed by `stubAdapter` (illustrative math ported from the prototype). In Phase
1A.2 `graphAdapter` drives the live workbook with **zero front-end change** —
flip `PRICING_ADAPTER=graph`. The stub numbers are **not** real loan pricing.

## Getting started
    npm install
    cp .env.example .env.local   # fill in values (see below)
    npm run dev                  # http://localhost:3000  (default tenant)

Test other tenants locally by setting the Host header, e.g.:
    curl -H "Host: acme.earnedhome.com" http://localhost:3000

## Environment
| Var | Purpose |
|-----|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe key (RLS-enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; trusted writes (optional in dev) |
| `NEXT_PUBLIC_ROOT_DOMAIN` | Base domain for subdomain routing (`earnedhome.com`) |
| `PRICING_ADAPTER` | `stub` (default) or `graph` (1A.2) |
| `GRAPH_*` | Entra app + workbook ids (1A.2) |

## Status (WBS)
- **1A.0 Foundation** — repo, Supabase project, multi-tenant schema + RLS, tenant resolution: **done here**.
- **1A.1 Buyer tool** — 9-input form, cards, cash-to-close, disclosures, lead capture + TCPA: **ported**.
- **1A.2 Engine connect** — blocked on workbook move to controlled SharePoint, the named-range cell map (Richard), and Entra app registration.

## Compliance notes
TCPA consent is captured with exact text + timestamp and is **required** to store
or route a lead. Reg Z disclosures render with every quote. **RESPA Section 8** is
the legal gate before charging customers — structure fees with counsel first.
