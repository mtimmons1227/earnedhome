# Spec — Rate Workbook Tool (admin download → edit → upload/replace)
**Status: Built on `dev`. An admin-only screen to update the rate workbook with no risk of breaking the file linkage.**

## Problem
The daily rate update depends on editing the *exact* file the website reads. Manual SharePoint editing works but is fragile for a non-technical user (a stray "Save As," rename, or new copy silently breaks the site). We want a guarded screen where the only thing possible is the safe thing.

## Who can use it
**Admins only.** The tool can replace the live pricing engine, so it is restricted to `app_users.role = 'admin'` — not regular `lo`/`staff`. In the current model R Parry is the lender behind all white-label fronts and there is **one shared workbook**, so the sole admin (Richard McHargue) is the only person who manages rates. The page redirects non-admins, the API rejects them, and the "Update rates" button only renders for admins.

## What the admin can and can't control
| Action | Admin controls | The app controls (fixed) |
|---|---|---|
| **Download workbook** | only where the browser saves it (Downloads) | the source file + the filename |
| **Upload & Replace** | only *which local file* they pick | the destination, the filename, the replace-in-place |

The admin never sees a path, drive, or item ID. The app holds the target identity, so the file's **address never changes** — the website keeps reading the same item.

## How it works (Microsoft Graph)
- **Download:** `GET /drives/{driveId}/items/{itemId}/content` → streams the current `.xlsx` to the browser.
- **Replace in place:** `PUT /drives/{driveId}/items/{itemId}/content` → overwrites the **same item ID** (preserves the address, like SharePoint "Replace").
- Drive/item IDs come from the existing `GRAPH_WORKBOOK_DRIVE_ID` / `GRAPH_WORKBOOK_ITEM_ID` env vars — the same file the pricing engine reads. Uses the app's own credentials, so **the admin does not need personal access to the file.**

## Safeguards
1. **Admin-gated** — Supabase auth + `app_users.role = 'admin'` on both the page and the API route.
2. **Filename confirmation guard** — if the uploaded file isn't named like `RateStreamWorkBook…`, an extra "are you sure?" confirm appears (catches the wrong-file-picked mistake).
3. **Upload pre-checks** — must be a `.xlsx` with a valid zip signature (`PK…`) and a sane size, or it's rejected before anything is replaced.
4. **Post-replace verification** — after replacing, the app reads a known named range (`eh_out_ratesAsOf`); if it doesn't resolve, the UI warns to restore the previous version.
5. **Start-from-download rule** — the downloaded file already carries the named ranges + form controls, so editing and re-uploading *that* file keeps them intact.
6. **Rollback** — SharePoint version history keeps every prior version; any bad replace is one click to restore.

## Components
- `src/lib/workbook-file.ts` — Graph token + `downloadWorkbook()`, `replaceWorkbook(bytes)`, `looksLikeXlsx(buf)`, `verifyNamedRange(name)`.
- `src/lib/auth-admin.ts` — `requireWorkbookAdmin()` (admin-only 401/403 gate).
- `src/app/api/admin/workbook/download/route.ts` — `GET`, gated, streams the file.
- `src/app/api/admin/workbook/replace/route.ts` — `POST` multipart, gated, validates → replaces → verifies.
- `src/app/dashboard/workbook/page.tsx` — admin-gated server page.
- `src/app/dashboard/workbook/WorkbookSwap.tsx` — client UI: **Download** and **Upload & Replace** (with the filename guard, confirm, and status).

## Navigation
- Dashboard → **View EarnedHome** (buyer tool, new tab) and **Update rates** (admin only).
- Buyer page → a staff-only **"← Back to dashboard"** strip (hidden from buyers).
- Rate Workbook page → **← Back to Dashboard**.

## Prerequisites
- **Graph write permission** to the workbook (`PUT …/content`). The pricing engine already PATCHes named ranges, so the write scope is almost certainly already granted; confirmed once an Upload & Replace succeeds.
- **Netlify env vars** on the relevant deploy context (`GRAPH_TENANT_ID/CLIENT_ID/CLIENT_SECRET/WORKBOOK_DRIVE_ID/WORKBOOK_ITEM_ID`) so the tool works on QA/production.

## Test plan (on `dev` / QA)
1. Sign in as the admin; open `/dashboard/workbook`.
2. **Download** → confirm the file lands in Downloads with the correct name.
3. Edit the **Rate** tab in desktop Excel; **Upload & Replace** → expect "replaced and verified."
4. Confirm the buyer tool shows the new "rates as of" / numbers (allow for the 5-min cache).
5. Negative tests: a non-`.xlsx` and a random `.xlsx` without tags → expect rejection / verification warning; confirm rollback via SharePoint version history.
6. Auth test: a non-admin (`lo`) is redirected away and sees no "Update rates" button.

## Out of scope (later)
- Strict pre-validation by unzipping and checking `definedName` entries (needs a small zip lib like `fflate`).
- Per-tenant workbooks + tenant-scoped admin (today the gate is "any admin," safe because there is one shared workbook and one admin; harden to "master-tenant admin" when a second admin/tenant workbook is added).
- An audit log of who replaced when (could log to the `events` table).
