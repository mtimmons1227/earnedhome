# Runbook — Connect the live pricing engine (Microsoft Graph)

_Step-by-step to flip EarnedHome from the stub to Richard's real workbook. Follow top to bottom. ~1 focused afternoon once the prerequisites are met. Last updated June 6, 2026._

> The app code is already done (`src/lib/pricing/graph.ts`). This runbook only supplies it with a workbook + six values. Nothing here touches app code.

---

## Prerequisites (must be true before you start)

- [ ] A **company Microsoft 365 Business** subscription exists (any plan with SharePoint/OneDrive — e.g. Business Basic). You are an **admin** of it.
- [ ] Richard's workbook has the **`eh_in_*` / `eh_out_*` named ranges** created (per `Field_Mapping_v3`) and the four-products question is answered.
- [ ] You can sign in to **portal.azure.com** (or **entra.microsoft.com**) as that tenant's admin.

If either of the first two isn't done, stop — those are the real blockers (M365 + Richard).

---

## Step 1 — Put the workbook in M365 (company-controlled)

1. Sign in to **office.com** with the company account.
2. Open **SharePoint**, create a site named e.g. **"EarnedHome Engine"** (or use a service-account OneDrive).
3. Upload **two** copies into its Documents library:
   - `RParry_Pricing_Engine.xlsx` (production — the live, daily-updated one)
   - `RParry_Pricing_Engine_TEST.xlsx` (a copy for staging/testing)
4. Do **not** keep the only copy in Richard's personal OneDrive.

---

## Step 2 — Register the Entra (Azure AD) app  → gives 3 values

1. Go to **portal.azure.com** → search **"Microsoft Entra ID"** → open it.
2. Left menu → **App registrations** → **+ New registration**.
   - Name: `EarnedHome Engine`
   - Supported account types: **"Accounts in this organizational directory only (Single tenant)"**
   - Redirect URI: leave blank → **Register**.
3. On the app's **Overview** page, copy two values:
   - **Application (client) ID** → this is `GRAPH_CLIENT_ID`
   - **Directory (tenant) ID** → this is `GRAPH_TENANT_ID`
4. Left menu → **Certificates & secrets** → **Client secrets** → **+ New client secret**.
   - Description: `earnedhome`, Expires: **24 months** (set a reminder — see Step 7 note).
   - Click **Add**, then **immediately copy the "Value"** (it's shown only once) → this is `GRAPH_CLIENT_SECRET`.
5. Left menu → **API permissions** → **+ Add a permission** → **Microsoft Graph** → **Application permissions**.
   - Search **`Files.ReadWrite.All`**, check it → **Add permissions**.
   - Back on the API permissions screen, click **"Grant admin consent for [your org]"** → **Yes**. You should see green "Granted" check marks.

> Tighter alternative (optional, advanced): use `Sites.Selected` instead and grant the app access to only the Engine site. Skip unless your security team requires it.

---

## Step 3 — Find the workbook's drive ID + item ID  → gives 2 values

Use **Graph Explorer**: https://developer.microsoft.com/en-us/graph/graph-explorer — sign in with the company account, then run these GET requests (paste in the URL bar, click **Run query**). Copy the `id` from each response.

**If the workbook is in a SharePoint site "EarnedHome Engine":**
1. `GET https://graph.microsoft.com/v1.0/sites/{yourtenant}.sharepoint.com:/sites/EarnedHomeEngine`
   → copy the site **`id`** (a long string).
2. `GET https://graph.microsoft.com/v1.0/sites/{site-id}/drives`
   → find the **Documents** library, copy its **`id`** → `GRAPH_WORKBOOK_DRIVE_ID`.
3. `GET https://graph.microsoft.com/v1.0/drives/{drive-id}/root:/RParry_Pricing_Engine.xlsx`
   → copy the file **`id`** → `GRAPH_WORKBOOK_ITEM_ID`. (If it's in a subfolder: `root:/Folder/RParry_Pricing_Engine.xlsx`.)

**If the workbook is in a service-account OneDrive (user = engine@yourco.com):**
1. `GET https://graph.microsoft.com/v1.0/users/engine@yourco.com/drive` → **`id`** → `GRAPH_WORKBOOK_DRIVE_ID`.
2. `GET https://graph.microsoft.com/v1.0/users/engine@yourco.com/drive/root:/RParry_Pricing_Engine.xlsx` → **`id`** → `GRAPH_WORKBOOK_ITEM_ID`.

(For the **TEST** workbook, repeat step 3's last query against the TEST filename to get its item id — you'll use that one in staging.)

---

## Step 3.5 — Infrastructure smoke test (do this BEFORE the full mapping)

This proves the send → recalc → receive pipe works with *any* value, independent of Richard's real cell mapping. Catch wiring problems early.

1. In the TEST workbook, add two named ranges (Name Box → type name → Enter):
   - `eh_test_in` → any empty cell.
   - `eh_test_out` → a cell containing the formula `=eh_test_in*2`.
2. In your local `.env.local`, set the six `GRAPH_*` values (with `GRAPH_WORKBOOK_ITEM_ID` = the TEST workbook).
3. Run:
   ```
   npm run test:graph
   ```
   It writes a random number to `eh_test_in`, recalculates, and reads `eh_test_out`. Expected:
   ```
   ✓ got app-only token
   ✓ opened workbook session
   ✓ wrote 437 to eh_test_in
   ✓ recalculated
   ✓ read eh_test_in back = 437   (write+read works)
   ✓ read eh_test_out = 874
   ✅ ROUND-TRIP OK ...
   ```
   If that passes, the infrastructure is correct — you and Richard then map the real `eh_in_*`/`eh_out_*` names to his cells (Field_Mapping_v3) with confidence. If it fails, see Troubleshooting — fix the pipe before mapping.

## Step 4 — Put the six values in Netlify (start with TEST)

1. **app.netlify.com** → project **earnedhome** → **Project configuration → Environment variables**.
2. Add these (scope: **All scopes**). Point `GRAPH_WORKBOOK_ITEM_ID` at the **TEST** file's id for now:

   | Key | Value |
   |---|---|
   | `GRAPH_TENANT_ID` | (from Step 2.3) |
   | `GRAPH_CLIENT_ID` | (from Step 2.3) |
   | `GRAPH_CLIENT_SECRET` | (from Step 2.4) |
   | `GRAPH_WORKBOOK_DRIVE_ID` | (from Step 3) |
   | `GRAPH_WORKBOOK_ITEM_ID` | (TEST file id from Step 3) |
   | `PRICING_ADAPTER` | `graph` |

   ⚠️ `GRAPH_CLIENT_SECRET` is a **secret** — never prefix it with `NEXT_PUBLIC_`, never put it in client code or the repo. Netlify env is the right place.
3. **Deploys → Trigger deploy → Clear cache and deploy site.** Wait for "Published."

---

## Step 5 — Validate (the accuracy gate)

1. Make sure Richard has filled the golden numbers in `scripts/engine-golden.json` from his workbook.
2. Run the harness against the real engine (locally, pointed at the TEST workbook):
   ```
   # set the 6 GRAPH_* vars + PRICING_ADAPTER=graph in your local .env.local, then:
   npm run validate:engine
   ```
3. Every figure must match within $1. Fix any mismatch (usually a named range pointing at the wrong cell) before going further.

---

## Step 6 — Smoke test on the live (staging) site

1. Open the buyer tool (`earnedhome.netlify.app`), run a quote.
2. The footer should now read **"Live engine"** instead of **"Demo / stub engine"** — that's the built-in indicator that it's reading the workbook.
3. Spot-check a couple of numbers against the workbook.

---

## Step 7 — Go to production

1. In Netlify, change **`GRAPH_WORKBOOK_ITEM_ID`** to the **production** workbook's id (from Step 3).
2. **Clear cache and deploy.** Done — buyers now get Richard's real pricing.

> **Secret rotation reminder:** the client secret from Step 2.4 expires (you set 24 months). Put a calendar reminder ~1 month before — when it expires the engine stops and you'll see token errors. To rotate: create a new secret, update `GRAPH_CLIENT_SECRET` in Netlify, redeploy.

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `Graph token request failed: 401` | Wrong `GRAPH_CLIENT_SECRET`/`CLIENT_ID`/`TENANT_ID`, or secret expired. Recheck Step 2. |
| `createSession failed: 403` | Admin consent not granted, or missing `Files.ReadWrite.All`. Redo Step 2.5. |
| `... failed: 404` | Wrong `GRAPH_WORKBOOK_DRIVE_ID`/`ITEM_ID`, or file moved/renamed. Re-run Step 3. |
| `write eh_in_x failed: 400` or `read eh_out_x failed` | That named range doesn't exist or is misspelled in the workbook. Have Richard check Name Manager against `Field_Mapping_v3`. |
| Numbers off vs workbook | A named range points at the wrong cell — fix in the workbook, re-run the harness (Step 5). |
| Occasional slowness / `429` | Graph throttling — expected at higher volume; the adapter retries. This is the signal to plan the code-engine migration (see PRICING_ENGINE.md). |

When all of this is green and the harness passes, mark WBS items #4, #20, #21–#27 complete.
