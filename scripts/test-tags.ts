/**
 * Connection check: reads, through the app's CONFIGURED workbook ID, a few tags
 * that exist ONLY in the new tagged file (eh_out_fixed30_name, _loanFees, and
 * eh_in_compassAgent). Plus eh_out_fixed30_rate as a sanity read.
 *
 *   - If the NEW tags return values → the app is reading your new tagged file.
 *   - If they return "NOT FOUND" → the app is still reading the old/untagged file.
 *
 * Read-only (no writes). Run:  npm run test:tags
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
function env(n: string): string { return process.env[n] as string; }
function base(): string {
  return `${GRAPH}/drives/${env("GRAPH_WORKBOOK_DRIVE_ID")}/items/${env("GRAPH_WORKBOOK_ITEM_ID")}/workbook`;
}
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
async function read(t: string, name: string): Promise<string> {
  const r = await fetch(`${base()}/names/${name}/range?$select=values`, { headers: { authorization: `Bearer ${t}` } });
  if (r.status === 404) return "NOT FOUND (tag missing)";
  if (!r.ok) return `error ${r.status}`;
  const v = ((await r.json()) as { values?: unknown[][] }).values?.[0]?.[0];
  return String(v);
}

async function main(): Promise<void> {
  console.log(`\nReading through configured workbook ${env("GRAPH_WORKBOOK_ITEM_ID").slice(0,12)}…\n`);
  const t = await token();
  const NEW = ["eh_out_fixed30_name","eh_out_fixed30_loanFees","eh_in_compassAgent"];
  const OLD = ["eh_out_fixed30_rate"];
  console.log("Existing tag (sanity):");
  for (const n of OLD) console.log(`   ${n.padEnd(26)} ${await read(t,n)}`);
  console.log("\nNEW tags (only in the tagged file):");
  let missing = 0;
  for (const n of NEW) { const v = await read(t,n); if (v.startsWith("NOT FOUND")) missing++; console.log(`   ${n.padEnd(26)} ${v}`); }
  console.log(missing === 0
    ? "\n✓ CONNECTED TO THE NEW TAGGED FILE — repoint is effectively done. No further repoint needed."
    : "\n✗ The configured file is the OLD/untagged one — the app needs repointing to the new file.");
}
main().catch((e) => { console.error("\nFAILED:", (e as Error).message); process.exit(1); });
