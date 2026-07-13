# Spec — Per-Tenant Pricing (workbook-per-tenant)

## Goal
Let each tenant serve pricing from **its own** RateStream workbook, so onboarding an LO is "clone the workbook + point the tenant row at it" — no code or env changes. Today all tenants read one shared workbook via env vars.

## Current state
- `getPricingAdapter()` returns the `graph` or `stub` adapter based on `PRICING_ADAPTER` (env).
- `graph.ts` builds the workbook path from **env vars**: `wbPath() = /drives/${GRAPH_WORKBOOK_DRIVE_ID}/items/${GRAPH_WORKBOOK_ITEM_ID}/workbook`.
- Auth (`GRAPH_CLIENT_ID/SECRET/TENANT_ID`) is one Azure app-only credential set, shared and correct as-is.
- Net: **one workbook for everyone.**

## Design

### 1. Schema — two columns on `tenants`
```sql
alter table public.tenants
  add column if not exists graph_drive_id text,
  add column if not exists graph_item_id  text;
```
Nullable. `null` ⇒ fall back to the env-var workbook (so R Parry keeps working untouched). These are **locations, not secrets** — fine to store in the DB.

### 2. Resolve the workbook at the call site
The quote API route already knows `tenantId`. It resolves the workbook coordinates and passes them into the adapter:
- Look up the tenant's `graph_drive_id` / `graph_item_id`.
- If both present → use them. Else → fall back to `GRAPH_WORKBOOK_DRIVE_ID` / `GRAPH_WORKBOOK_ITEM_ID`.

Define a small type:
```ts
export interface WorkbookRef { driveId: string; itemId: string; }
```

### 3. Adapter takes the workbook as a parameter (not env)
Change the `PricingAdapter.quote` signature to accept an optional `WorkbookRef`:
```ts
quote(input: PricingInput, workbook?: WorkbookRef): Promise<PricingQuote>
```
- In `graph.ts`, thread `workbook` through the internal helpers that currently call `wbPath()` (session create/close + every `$batch` sub-request path). When `workbook` is absent, fall back to the env vars (unchanged behavior).
- `stub.ts` ignores the param.
- The token/auth path is unchanged (shared Azure app).

### 4. Wire the route
In the quote route: resolve `WorkbookRef` from the tenant (helper `getTenantWorkbook(tenantId)` → columns, else env), then `adapter.quote(input, workbookRef)`.

## Hosting & Graph access (decision)
One Azure app-only credential must be able to read **every** LO's workbook. Two ways:
- **(Recommended) EarnedHome hosts all workbook copies** in its own M365 SharePoint/OneDrive. One app, one M365 tenant, many files — no cross-tenant auth. Each LO "owns" their rates conceptually; the file lives in EarnedHome's drive. Simplest and matches the multi-tenant SaaS model.
- (Alternative) Each LO hosts their own file and grants the app access — cross-tenant Graph consent, materially more complex. Avoid unless an LO contractually requires it.

**Assumption for this spec:** option 1. Each LO's cloned workbook lives in EarnedHome's M365 drive; onboarding records that file's `driveId`/`itemId` on the tenant.

## Workbook structure discipline
Keep the **engine** (formulas, `EH_OUT`, named ranges) and the **rate-input area** on cleanly separated tabs, so an engine upgrade can be re-applied to each LO's copy without disturbing their entered rates. This is an operational rule, not code, but it's what makes workbook-per-tenant maintainable.

## Backward compatibility
Fully additive. R Parry's tenant leaves the two columns `null` → env fallback → identical behavior. Nothing breaks on deploy; the feature is dormant until a tenant's columns are populated.

## Onboarding impact
Adds one line to the run script's Step C:
1. Clone the master engine workbook → new file in EarnedHome's drive.
2. LO loads their rates.
3. `update tenants set graph_drive_id='…', graph_item_id='…' where slug='…';`

## Rollout
1. Migration (2 columns).
2. Adapter signature + threading + env fallback.
3. `getTenantWorkbook()` helper + quote route wiring.
4. Typecheck → QA. R Parry unaffected (null cols).
5. Onboard a 2nd test tenant with its own workbook to validate isolation.

## Testing
- R Parry (null cols) → unchanged rates (regression).
- Test tenant with its own workbook → its rates, not R Parry's.
- Missing/invalid tenant IDs → clean error, no crash.
- Confirm no workbook IDs are ever exposed to the browser (server-only).

## Out of scope
Per-tenant disclosures (separate spec), a rates-entry UI (LOs edit Excel directly for now), and the super-admin tenant page (separate).
