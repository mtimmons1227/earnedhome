# Spec — Multi-Loan-Officer Routing (Phase 2)
**Status: Proposed (not built). Phase 1A ships one loan officer per white-label.**

## Problem
A white-label tenant may have **more than one loan officer**. The buyer tool needs to (a) **display** the right LO's name/NMLS and (b) **route** the captured lead to the right LO. Today the design assumes exactly one LO per tenant.

## Current state (Phase 1A)
- The buyer UI shows **`tenants.lo_name`** — a single denormalized display string per white-label. (`page.tsx` → `PathfinderTool` `loName`.)
- **`app_users`** (role `lo`) already stores real LO records (`full_name`, `email`, `nmls`, `tenant_id`) and is **multi-LO capable**, but the buyer page does not read from it.
- **`leads.routed_to`** is **free text** (the name string), not a reference to an LO record — so routing/reporting can't reliably tie a lead to a person.

## Goals
- Support **N loan officers per tenant**.
- Deterministically **select** which LO a given buyer sees and is routed to.
- **Link** each lead to a specific LO record (not a string).
- Pull the **NMLS** for display/disclosures from the selected LO (not hardcoded).

## Non-goals (Phase 2)
- LO self-service scheduling / calendars.
- Lead reassignment UI (could be a later phase).
- Compensation/splits logic.

## Proposed design

### 1. Source of truth
Promote **`app_users` (role `lo`)** to the source of truth for LO identity. Keep `tenants.lo_name` only as an **optional fallback** display string for tenants that haven't added LO records yet.

### 2. Selection strategy (pick per tenant)
Add a `lo_routing` setting on the tenant (enum), so each white-label chooses how LOs are assigned:

| Strategy | How it picks | Good for |
|---|---|---|
| `default` | one LO flagged primary | a tenant with a single main LO |
| `community` | the LO linked to the buyer's selected community/region | builders with multiple subdivisions |
| `round_robin` | next LO in rotation, evenly distributed | teams sharing inbound leads |
| `buyer_choice` | buyer selects from a list | when the buyer should choose |

**Recommended rollout:** start with `default`, then add `community` (the `communities` table already exists), then `round_robin`.

### 3. Schema changes
- `app_users`: add `is_primary boolean default false`, `active boolean default true`.
- `tenants`: add `lo_routing` (enum, default `default`).
- `communities`: add `lo_id` (FK → `app_users.id`, nullable) for the `community` strategy.
- `leads`: add `assigned_lo_id` (FK → `app_users.id`, nullable). Keep `routed_to` as a denormalized display copy.

### 4. Resolution flow (at request time)
```
tenant (from host)
  → read tenant.lo_routing
  → resolve the LO:
       default      → the app_users row where is_primary = true
       community    → communities.lo_id for the chosen community
       round_robin  → next active LO in rotation
       buyer_choice → the LO the buyer picked
  → fall back to tenants.lo_name string if no LO record resolves
  → pass { lo_full_name, lo_nmls } to the buyer UI
On lead submit:
  → set leads.assigned_lo_id = resolved LO id
  → set leads.routed_to = resolved LO full_name (display copy)
```

### 5. Display & disclosures
- Show the **resolved LO's** `full_name` and `nmls` on the card, the modal, and the educational panel.
- Disclosures should read the **NMLS from the resolved LO / tenant**, not a hardcoded company string (today `disclosures.ts` hardcodes R Parry's NMLS — make it tenant/LO-driven for true white-label).

## Phasing
- **2a — Default LO:** read from `app_users` primary; link lead → `assigned_lo_id`. (Small, high value.)
- **2b — Community routing:** add `communities.lo_id` + resolution.
- **2c — Round-robin / buyer-choice:** rotation logic or a picker.

## Acceptance criteria
- A tenant with 2+ LOs displays the correct LO per the chosen strategy.
- Every new lead has a non-null `assigned_lo_id` pointing at the routed LO.
- Disclosures show the routed LO's NMLS.
- Tenants with no LO records still work via the `tenants.lo_name` fallback (no regression).

## Open questions
- Should the buyer ever **see** that multiple LOs exist, or always just one (the resolved one)? (Default: just one.)
- For `round_robin`, is distribution per-tenant or per-community?
- Do we need **lead reassignment** in Phase 2, or defer?

## Data hygiene to resolve first (independent of build)
- `tenants.lo_name` currently holds **placeholder** values (`"Acme Homes preferred lender"`, `"BlueKey loan officer"`, `"R Parry Financial"`). Set these to the real intended display values.
- Decide whether the buyer should see the **company** ("R Parry Financial") or the **person** ("Richard McHargue"). EarnedHome currently shows the company.
- `nmls 927662` is seeded on all three tenants (it's Richard's personal NMLS). Real white-labels need their own correct NMLS.
- Richard's `app_users.nmls` is null but should be `927662`.
