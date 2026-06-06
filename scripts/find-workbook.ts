/**
 * Find a workbook's drive ID + item ID using the EarnedHome Engine app's
 * APP-ONLY credentials (no Graph Explorer / delegated consent needed).
 *
 * Requires these in .env.local:  GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET
 * (the app must have admin-consented Files.ReadWrite.All — which it does).
 *
 * Point it at the file by user + path. Defaults match the pilot test file:
 *    GRAPH_WORKBOOK_USER=marvin@incryptable.com
 *    GRAPH_WORKBOOK_PATH=earnedhome/eh_graph_test.xlsx
 * (or pass them as args:  npm run graph:find marvin@incryptable.com earnedhome/eh_graph_test.xlsx)
 *
 * Prints the two values to paste into .env.local:
 *    GRAPH_WORKBOOK_DRIVE_ID, GRAPH_WORKBOOK_ITEM_ID
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
const REQUIRED = ["GRAPH_TENANT_ID", "GRAPH_CLIENT_ID", "GRAPH_CLIENT_SECRET"];

function env(n: string): string { return process.env[n] as string; }

const USER = process.argv[2] ?? process.env.GRAPH_WORKBOOK_USER ?? "marvin@incryptable.com";
const PATH = (process.argv[3] ?? process.env.GRAPH_WORKBOOK_PATH ?? "earnedhome/eh_graph_test.xlsx").replace(/^\/+/, "");

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

async function main(): Promise<void> {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length) {
    console.log("Missing env vars in .env.local:\n - " + missing.join("\n - "));
    console.log("\nFill GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET first, then re-run.");
    process.exit(1);
  }
  console.log(`\nLooking up:  user=${USER}  path=/${PATH}\n`);
  const t = await token();
  console.log("✓ got app-only token");

  const url = `${GRAPH}/users/${encodeURIComponent(USER)}/drive/root:/${PATH.split("/").map(encodeURIComponent).join("/")}`;
  const r = await fetch(url, { headers: { authorization: `Bearer ${t}` } });
  if (!r.ok) {
    const body = await r.text();
    console.error(`\n❌ Lookup failed (${r.status}). ${body}`);
    if (r.status === 404) {
      console.error("\n→ The file isn't at that path in the cloud yet. Check: it's finished syncing (green check),");
      console.error("  the folder/name are exactly right, and the user UPN is correct.");
      console.error("  Tip: list the OneDrive root with:  npm run graph:find -- --list");
    }
    process.exit(1);
  }
  const item = (await r.json()) as { id: string; name: string; parentReference?: { driveId?: string } };
  const driveId = item.parentReference?.driveId;
  console.log(`✓ found "${item.name}"\n`);
  console.log("Paste these into .env.local (and later into Netlify):\n");
  console.log(`GRAPH_WORKBOOK_DRIVE_ID=${driveId ?? "(missing parentReference.driveId)"}`);
  console.log(`GRAPH_WORKBOOK_ITEM_ID=${item.id}\n`);
}

// Optional: list the user's OneDrive root to find the right path.
async function list(): Promise<void> {
  const t = await token();
  const r = await fetch(`${GRAPH}/users/${encodeURIComponent(USER)}/drive/root/children?$select=name,folder,file`, {
    headers: { authorization: `Bearer ${t}` },
  });
  const body = (await r.json()) as { value?: Array<{ name: string; folder?: unknown }> };
  console.log(`\nTop-level items in ${USER}'s OneDrive:`);
  for (const i of body.value ?? []) console.log(`  ${i.folder ? "[dir] " : "      "}${i.name}`);
  console.log("");
}

(process.argv.includes("--list") ? list() : main()).catch((e) => {
  console.error("\n❌ FAILED:", (e as Error).message); process.exit(1);
});
