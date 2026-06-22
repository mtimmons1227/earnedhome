# EarnedHome — Pricing Engine: storage, Graph connection, and scaling

_How the app talks to Richard's pricing workbook today (Phase 1A via Microsoft Graph), and the permanent plan for hundreds of builders / thousands of agents. Last updated June 6, 2026._

> **⚠ Current-state note (June 21, 2026):** the adapter pattern (§0) and the scale plan (§6–7) remain the strategy. But some Phase-1A specifics below are **superseded**: (1) the "**never show more than 2 products**" rule (§0a) — the live tool now shows **all 6 products** (30/15 Fixed, FHA, VA + their Jumbo variants), read in one pass via per-product named ranges; (2) the **`EH_Outputs` single-block** read (§5a) was **not** the approach built — the adapter reads per-product `eh_out_<prefix>_*` ranges per the **v4 map** (91 ranges); (3) there is currently **one shared workbook**, not separate prod/TEST copies. As-built reference: **[`INFRASTRUCTURE.md`](INFRASTRUCTURE.md)**.

---

## 0. The key design decision (read this first)

The app **never** calls Excel or Graph directly. It calls one interface — `PricingAdapter` (`src/lib/pricing/types.ts`) — with a fixed contract of `eh_in_*` inputs and `eh_out_*` outputs:

```
stub   (now)        illustrative math, instant, local
graph  (Phase 1A)   drives Richard's live workbook via Microsoft Graph
code   (at scale)   Richard's math ported to a stateless service
```

Swapping engines is a config flip (`PRICING_ADAPTER`) + a new adapter file. **The front end, the API, the database, and the buyer/LO experience never change.** This is the whole point: the Graph-workbook approach is a *temporary bridge* for the pilot, and the migration to a scalable engine is built in, not a re-platform.

---

## 0a. Latency is a first-class design constraint (Phase 1A goes live on Graph)

**Phase 1A launches in production on the `graph` adapter** — real buyers, driving Richard's real workbook. That is the intended pilot. It is appropriate for pilot volume (3 builders / ~100 customers) but it is also the **slower** of the engine options: every product = token → workbook session → write inputs → recalc → read outputs, and concurrent buyers are **serialized** by a lock on the single workbook. So latency must be designed against at every step, not treated as an afterthought.

**Hard rules to keep round-trips down (decided with Marvin, June 6):**
- **Never compute or show more than 2 products at a time.** Default view = **30-yr Fixed + 30-yr FHA** (`X8=1`; `C109=1` and `C109=3`) → **2 recalcs**. The 15-yr pair is computed **only if the buyer toggles to it** (`X8=2`) → 2 more recalcs, on demand. Four-at-once is forbidden.
- **Cache aggressively**, keyed on `(inputs + product + rate_version)`. Toggling 30↔15 after the first compute must be instant (cache hit, no Graph call).
- **Pin the rate version** captured on the first quote and reuse it for any later 15-yr pass, so a mid-session rate tick can't show two different "rates as of."
- **Read outputs in one shot** from a dedicated output/contract tab (one range GET), not 20+ individual named-range reads.
- **One recalc beats four:** if/when Richard builds an all-products-at-once layout, prefer it — but the 2-products-max display rule still stands for the buyer view.
- Treat the per-quote **round-trip budget** as a tracked number. If it creeps up under real load (Graph `429`s, lock waits), that is the signal to begin the `code` engine migration — not to add more workbook calls.

**Bottom line:** ship 1A on Graph, but every engine decision is made to minimize Graph round-trips, and the `code`-engine swap (zero front-end change) stays ready for when volume outgrows a single workbook.

---

## 1. Phase 1A — store the workbook (Microsoft 365)

Graph's Excel API only drives workbooks in **Microsoft 365 (work/school)** — SharePoint or OneDrive for Business. Not a local file, not personal/consumer OneDrive, not Google Drive.

1. In the **company** M365 tenant (a service account, e.g. `engine@earnedhome.com` — never Richard's personal account), create a SharePoint site, e.g. **"EarnedHome Engine."**
2. Upload the workbook (with the `eh_in_*` / `eh_out_*` named ranges already created) to its document library, e.g. `/Engine/RParry_Pricing_Engine.xlsx`.
3. Upload a second **TEST copy** (`RParry_Pricing_Engine_TEST.xlsx`) so staging never touches the live rate sheet.
4. Add version history / change-control so a bad daily edit can be rolled back.

## 2. Phase 1A — register the Entra (Azure AD) app

1. Entra admin center → **App registrations → New registration** ("EarnedHome Engine"). Record the **Directory (tenant) ID** and **Application (client) ID**.
2. **Certificates & secrets → New client secret** → copy the value (store server-side only).
3. **API permissions → Microsoft Graph → Application permissions** → `Files.ReadWrite.All` (or tighter: `Sites.Selected`, then grant the app access to just the Engine site). → **Grant admin consent.**

## 3. Phase 1A — find the drive ID + item ID (one time)

Using Graph Explorer or a script (app token):
- Site id: `GET /sites/{host}:/sites/EarnedHomeEngine`
- Drive id: `GET /sites/{site-id}/drives` → the doc library's `id`
- Item id: `GET /drives/{drive-id}/root:/Engine/RParry_Pricing_Engine.xlsx`

## 4. Phase 1A — server env vars

```
PRICING_ADAPTER=graph
GRAPH_TENANT_ID=...
GRAPH_CLIENT_ID=...
GRAPH_CLIENT_SECRET=...        # secret — server only, never NEXT_PUBLIC_
GRAPH_WORKBOOK_DRIVE_ID=...
GRAPH_WORKBOOK_ITEM_ID=...
```

## 5. Phase 1A — connection flow (what `graphAdapter` does per quote)

1. Acquire an **app-only token** (client-credentials, scope `https://graph.microsoft.com/.default`); cache until expiry.
2. **Open a workbook session:** `POST /drives/{drive}/items/{item}/workbook/createSession` `{ "persistChanges": false }` → use the returned id in the `workbook-session-id` header.
3. **Write inputs:** for each, `PATCH /workbook/names/{eh_in_x}/range` `{ "values": [[value]] }`.
4. **Recalc:** `POST /workbook/application/calculate` `{ "calculationType": "Full" }`.
5. **Read outputs:** preferably one call to the output contract tab — `GET /workbook/names/eh_out_block/range` → `values` (see §5a). (Fallback: a per-field `GET /workbook/names/{eh_out_x}/range`, but that's 14+ round-trips per product.)
6. Map to `PricingQuote`, close the session.

Wrapped with: **input-hash cache** (identical inputs → cached quote, invalidated on the daily rate update), a **per-workbook lock/queue** (serialize writes — see below), **429 retry/backoff**, and timeout/no-qualify handling. If 4 products run per quote, that's 4 passes (see Field_Mapping_v3 Q-A).

---

## 5a. Output contract tab — read all outputs in ONE Graph call (latency)

**Why:** step 5 above, done naïvely, is one `GET /workbook/names/{eh_out_x}/range` **per field** — 14+ network round-trips per product. Instead, collect every output on a **single dedicated tab** and read the whole block in **one** call. Fewer round-trips = lower latency and far less Graph throttling. It also **decouples the app from Richard's layout**: if he rearranges his worksheet, he fixes the references on this tab only — the app, the API, and the named ranges never change. This tab becomes the literal contract and, later, the exact spec for the `code`-engine rewrite.

**How Richard builds it (one-time, ~15 min):**
1. Add a worksheet named **`EH_Outputs`**.
2. In a **contiguous block**, put one row per output field, each cell a **reference** to the engine cell — never retyped numbers. For the current-scenario layout:
   ```
        A (label)                 B (value)
   1    rate                      ='RParry Pricing Worksheet'!H21
   2    apr                       ='RParry Pricing Worksheet'!N21
   3    principalAndInterest      ='RParry Pricing Worksheet'!M23
   4    mortgageInsurance         ='RParry Pricing Worksheet'!M24
   5    taxes                     ='RParry Pricing Worksheet'!M25
   6    insurance                 ='RParry Pricing Worksheet'!M26
   7    totalPayment              ='RParry Pricing Worksheet'!K28
   8    cashToClose               ='RParry Pricing Worksheet'!P35
   9    ratesAsOf                 ='RParry Pricing Worksheet'!Z4
   ```
3. Select the **value column block** (`B1:B9`) and name it **`eh_out_block`** (Name Box → type it → Enter). That single named range is what the app reads.
4. (Optional) also name each value cell `eh_out_rate`, `eh_out_apr`, … if you prefer per-field names too; the block read is what matters for speed.

**How the app reads it:** one call —
```
GET /workbook/names/eh_out_block/range?$select=values
```
returns the whole column of values in a single response; the adapter maps them by row order to `PricingQuote`.

**Per-product model (with the "show max 2" rule).** Because the engine computes **one product at a time** (toggle `C109` + `X8`), `EH_Outputs` reflects whichever product is currently selected. So each product pass = set switches → recalc → **one** `eh_out_block` read. With the latency rule that's: pass 1 (30-yr Fixed) → read; pass 2 (30-yr FHA) → read; 15-yr only on demand. Two small reads instead of ~28 named-range GETs.

> If Richard instead builds **four product columns** on `EH_Outputs` (each column referencing a fully-replicated calc), the app can read all four products in a single pass — 1 recalc, 1 read. More setup for him; best latency. Either way the app still **shows** only 2 at a time per the §0a rule.

**Caveats:** the tab recalculates automatically (same workbook). Guard against `#N/A` propagation — if the engine goes out-of-grid, those cells error, so the adapter must detect a non-numeric value in the block and treat the product as "not available" rather than displaying an error.

---

## 6. Why this does NOT scale — and the capacity ceiling

The Graph-workbook approach is correct for the **pilot** (R Parry + a few builders, low concurrency). It will **not** serve hundreds of builders and thousands of agents with good latency. The hard limits:

- **One shared workbook is single-threaded.** Two buyers can't write `eh_in_homePrice` at the same time without clobbering each other's calc. So every quote must take a **lock and run one at a time.**
- **Each quote is slow.** Open session + PATCH inputs + full recalc + GET outputs = several network round-trips to Microsoft ≈ **1–5 seconds**, ×4 if computing four products. Serialized, that caps real throughput at roughly **tens of quotes per minute** — fine for a pilot, nowhere near thousands of concurrent users.
- **Graph throttling.** Microsoft enforces per-app/per-tenant request limits; high volume returns **429s**.
- **Single point of failure.** One locked/edited/corrupted workbook stalls everyone.

This was called out as the **#1 engine risk** in the implementation plan from the start. The mitigations (cache + lock) buy headroom for the pilot; they do not change the ceiling.

---

## 7. The permanent solution (scale to 100s of builders / 1000s of agents)

**Port Richard's math into a stateless code pricing service**, behind the *same* `PricingAdapter` interface.

- **Stateless + pure:** given inputs, compute outputs in-process in **milliseconds**, no shared resource, no lock. Every serverless/edge instance computes independently → **horizontal scale to effectively unlimited concurrency.**
- **Rates stay Richard's job.** He keeps maintaining the workbook (LLPAs, FHA/VA/Jumbo grids, rate ladder, fee stack). A **rate sync job** extracts those tables into a database (Postgres/Redis). The code engine reads the synced numbers — so the source of truth is still his Excel, but buyers are served by fast code, not by hitting the workbook live.

#### Intraday rate updates (rates reprice more than once a day)

"Daily" is just a floor — mortgage rates reprice during the day, so the sync is **event-driven, not time-based**:
- **Trigger on change:** a Microsoft Graph change-notification (webhook) on the workbook fires the moment Richard saves; or a lightweight poll (every few minutes) checks a "rates-as-of" cell and re-syncs only when it changed; plus a manual **"Publish rates"** action for Richard after a reprice.
- **Versioned store:** each sync writes a new **rate version** (timestamped) into the rate data store.
- **Cache keyed on `inputs + rate_version`:** publishing a new version instantly invalidates every old cached quote — no stale numbers, no manual cache clearing.
- **Audit:** every quote and lead is stamped with `rates_as_of`, so there's always a record of exactly which rate sheet a buyer saw (compliance).

Note: in the **Graph pilot** this is moot — the `graph` adapter reads the live workbook on every quote, so reprices are always reflected immediately (the pilot trades scale for always-fresh). The sync/versioning above applies to the **code engine** phase, where serving is decoupled from Excel.
- **Correctness guarantee:** the calc-validation harness (WBS #26) runs the code engine against known-good workbook outputs so the port matches Richard's numbers to the penny before it goes live.

### Latency / throughput strategy at scale

- **Compute:** code engine in-process (or at the edge) → ms-level, no lock, scales with traffic.
- **Cache:** input-hash cache (Redis) keyed on `inputs + rate_version` so repeat/near-identical quotes are instant; invalidated automatically whenever a new rate version publishes (each reprice).
- **Data:** per-tenant rate/LLPA tables in Postgres (indexed) or Redis; daily refresh job.
- **App tier:** stateless serverless functions scale horizontally; SSR + CDN caching for listing pages; Supabase connection pooling (pgBouncer) and read replicas for dashboard reads as agent count grows.
- **Multi-tenant isolation** (RLS + `tenant_id`) already supports this volume — adding builders/agents is data, not infrastructure (see ARCHITECTURE.md).

### Migration path (no re-platform, zero front-end change)

```
Phase 1A  : PRICING_ADAPTER=stub   ──►  =graph (live workbook, pilot volume)
Phase 1B/2: PRICING_ADAPTER=code   ──►  ported engine + daily rate sync (scale)
```

Because everything sits behind `PricingAdapter`, going from the pilot engine to the scale engine is implementing one new adapter file and flipping an env var. The graph adapter is the bridge that lets you launch revenue now without waiting on the code port.
