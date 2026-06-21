/**
 * Finds the EarnedHome SharePoint file's drive ID + item ID for the app to use,
 * AND tests whether the app's Graph registration can reach the site.
 *
 *   - Prints the IDs → the app HAS access; paste them into .env.local.
 *   - "ACCESS DENIED (403)" → the app's Azure AD reg needs a one-time grant to
 *     the EarnedHome site (Sites.Selected).
 *
 * Run:  npm run find:sp
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnv(): void {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const GRAPH = "https://graph.microsoft.com/v1.0";
const LOGIN = "https://login.microsoftonline.com";
const HOST = "incryptable.sharepoint.com";
const SITE_PATH = "/sites/EarnedHome";
const FILE = "RateStreamWorkBook.xlsx";
function env(n: string): string { return process.env[n] as string; }

async function token(): Promise<string> {
  const body = new URLSearchParams({
    client_id: env("GRAPH_CLIENT_ID"), client_secret: env("GRAPH_CLIENT_SECRET"),
    scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials",
  });
  const r = await fetch(`${LOGIN}/${env("GRAPH_TENANT_ID")}/oauth2/v2.0/token`, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body,
  });
  if (!r.ok) throw new Error(`token ${r.status}: ${await r.text()}`);
  return ((await r.json()) as { access_token: string }).access_token;
}
async function g(t: string, url: string): Promise<Response> {
  return fetch(`${GRAPH}${url}`, { headers: { authorization: `Bearer ${t}` } });
}

async function main(): Promise<void> {
  const t = await token();
  console.log(`\nLooking up site ${HOST}${SITE_PATH} …`);
  const sRes = await g(t, `/sites/${HOST}:${SITE_PATH}`);
  if (sRes.status === 403) { console.log("\n✗ ACCESS DENIED (403). The app's registration can't reach this site.\n  → Grant it access to the EarnedHome site (Sites.Selected), then re-run."); process.exit(1); }
  if (!sRes.ok) { console.log(`✗ site lookup failed: ${sRes.status}: ${(await sRes.text()).slice(0,200)}`); process.exit(1); }
  const site = (await sRes.json()) as { id: string; webUrl: string };
  console.log(`✓ site: ${site.webUrl}`);

  const dRes = await g(t, `/sites/${site.id}/drive`);
  if (!dRes.ok) { console.log(`✗ drive lookup failed: ${dRes.status}`); process.exit(1); }
  const drive = (await dRes.json()) as { id: string };

  const fRes = await g(t, `/sites/${site.id}/drive/root:/${encodeURIComponent(FILE)}`);
  if (fRes.status === 404) { console.log(`✗ ${FILE} not found in the library root.`); process.exit(1); }
  if (!fRes.ok) { console.log(`✗ file lookup failed: ${fRes.status}`); process.exit(1); }
  const file = (await fRes.json()) as { id: string; name: string; lastModifiedDateTime: string };
  console.log(`✓ file: ${file.name} (modified ${file.lastModifiedDateTime})\n`);

  console.log("Paste these two lines into .env.local (replace the existing two):\n");
  console.log(`GRAPH_WORKBOOK_DRIVE_ID=${drive.id}`);
  console.log(`GRAPH_WORKBOOK_ITEM_ID=${file.id}`);
  console.log("\n✓ The app CAN reach the SharePoint site. Update .env.local, then run: npm run test:tags");
}
main().catch((e) => { console.error("\nFAILED:", (e as Error).message); process.exit(1); });
