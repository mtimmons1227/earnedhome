# Runbook — Microsoft Tenant Migration (Incryptable → EarnedHome M365)

**Goal:** move the pricing workbook + the Graph app off the **prototype** Microsoft account (Incryptable) onto a dedicated **EarnedHome Microsoft 365** tenant, for a clean company footprint at go-live.

## Is this done once?
- **Yes — the setup is one-time:** create the EarnedHome M365 tenant, register the Graph app, move R Parry's workbook, swap the `GRAPH_*` env vars. Do it once at go-live.
- **Two small recurring things after:** (1) when you onboard a **new LO**, drop their workbook into the same EarnedHome drive and record its `drive_id`/`item_id` on their tenant row; (2) **rotate the app's client secret** before it expires (secrets expire — set a calendar reminder, typically 12–24 months).

## Background — what "the Graph app" is
An **app registration in Microsoft Entra ID** = a *machine login* for your software. It has a **Client ID** (username), **Client Secret** (password), a **Tenant ID** (which Microsoft directory it belongs to), and **app-only permission** (`Files.ReadWrite.All`) to read/write files. Your code (`graph.ts`) uses it to drive the workbook. These are the `GRAPH_*` env vars.

---

## One-time steps

### 1. Create the EarnedHome Microsoft 365 tenant
- Sign up for **M365 Business Basic/Standard** under EarnedHome (needs SharePoint/OneDrive). You become **Global Admin**.
- (Optional) add a custom domain (e.g., `earnedhome.com`) to the tenant.

### 2. Register the Graph app
- **Entra admin → App registrations → New registration.** Name it e.g. `EarnedHome-Pricing`. Single tenant.
- Note the **Application (client) ID** and **Directory (tenant) ID**.

### 3. Grant API permissions
- **API permissions → Add → Microsoft Graph → Application permissions → `Files.ReadWrite.All`** (add `Sites.ReadWrite.All` if the workbook lives in SharePoint).
- Click **Grant admin consent** (you can, as Global Admin). This is what lets the app work with **no user logged in**.

### 4. Create a client secret
- **Certificates & secrets → New client secret** → copy the **Value** immediately (shown once). Note the **expiry date** → calendar reminder to rotate.

### 5. Place the workbook in EarnedHome's drive
- Create a folder structure in EarnedHome's **SharePoint/OneDrive** (e.g., `/Ratesheets/RParry/`).
- **Copy** R Parry's RateStream workbook there. (Keep the Incryptable copy until verified.)
- Get the new **Drive ID + Item ID** (via Graph Explorer, or the repo's `scripts/find-workbook.ts` / `find-sharepoint-file.ts` pointed at the new tenant).

### 6. Swap the 5 `GRAPH_*` env vars
Netlify (all contexts) **and** `.env.local`:
| Variable | New value |
|---|---|
| `GRAPH_CLIENT_ID` | new app's Client ID |
| `GRAPH_CLIENT_SECRET` | new secret value |
| `GRAPH_TENANT_ID` | EarnedHome Directory (tenant) ID |
| `GRAPH_WORKBOOK_DRIVE_ID` | workbook's new Drive ID |
| `GRAPH_WORKBOOK_ITEM_ID` | workbook's new Item ID |

### 7. Redeploy + verify to the penny
- Redeploy (env changes take effect on rebuild).
- Run `npm run test:tags` / a live quote → confirm pricing resolves and numbers match the old setup **exactly**.

### 8. Decommission the prototype
- Once verified, remove the Incryptable app registration / secret and archive the old workbook copy.

---

## What does NOT change
- **The code** — `graph.ts` reads env vars; no edits, just new values.
- **Supabase** (app database) — unrelated to the Microsoft move.
- **Tenant rows / branding / dashboard** — unrelated.

## How this relates to the native engine (plain-English)
**Today the spreadsheet *is* the calculator.** Every time a buyer runs numbers, the app reaches over the internet into R Parry's Excel file, types the numbers in, hits recalc, and reads the answer back — like borrowing a calculator that sits on someone else's desk, for *every single question.* That's why the Microsoft account matters so much right now: the app reaches into it on every quote.

**Once the native engine is built, the app does the math itself in code.** It no longer borrows the spreadsheet per quote. Instead, **once a day** it peeks at the spreadsheet just to copy down that day's rates (like reading today's prices off a menu each morning), then does all the math on its own — instantly. So the spreadsheet becomes a *"rate sheet we read each morning"* instead of *"the calculator we borrow for every question."* → The Microsoft account still holds the daily rate sheet, but it matters **far less** and there's no per-quote dependency on it.

**Bottom line:** still move to the EarnedHome M365 at go-live (clean company ownership/billing/access — running production out of a personal Incryptable account isn't right for a real business), but know the runtime reliance on it shrinks a lot once the native engine lands.

## Rollback
Keep the Incryptable app + workbook copy until EarnedHome is verified. If anything fails, revert the 5 `GRAPH_*` vars to the Incryptable values and redeploy — instantly back to the working prototype setup.
