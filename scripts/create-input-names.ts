/**
 * Creates / re-creates the BASE input named ranges in the LIVE RateStream
 * workbook via Microsoft Graph, at the exact cells verified from the tagged
 * RateStreamWorkBook. Persists to the file (no session). Names that already
 * exist are skipped automatically — so this is safe to re-run as a backup /
 * recreation tool (e.g. after a workbook swap).
 *
 * These are the non-VA inputs the app writes each quote. VA inputs live in
 * create-va-names.ts; outputs in create-output-names.ts / create-cashtoclose-names.ts.
 *
 * Cell map (verified in RateStreamWorkBook_tagged.xlsx):
 *   eh_in_homePrice     Front!B6     (plain cell, dollars)
 *   eh_in_downPct       Front!B8     (plain cell, decimal e.g. 0.10)
 *   eh_in_sellerCredit  Front!B24    (plain cell, dollars)
 *   eh_in_creditBand    Engine!H22   (Form-Control linked cell, index 1-9)
 *   eh_in_occupancy     Engine!F16   (Form-Control linked cell, index 1=Primary,2=2nd,3=Investment)
 *   eh_in_propertyType  Engine!F21   (Form-Control linked cell, index 1=Single Family,2=2-4 Unit,3=Condo,4=Manufactured)
 *   eh_in_veteran       Engine!S57   (Form-Control linked cell, TRUE/FALSE)
 *   eh_in_firstTime     Engine!M14   (Form-Control linked cell, TRUE/FALSE)
 *
 * IMPORTANT: close RateStreamWorkBook.xlsx in Excel before running, so the open
 * copy doesn't overwrite the changes (AutoSave).
 *
 * Run:  npm run create:input-names
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
const REQUIRED = ["GRAPH_TENANT_ID", "GRAPH_CLIENT_ID", "GRAPH_CLIENT_SECRET", "GRAPH_WORKBOOK_DRIVE_ID", "GRAPH_WORKBOOK_ITEM_ID"];
function env(n: string): string { return process.env[n] as string; }
function base(): string { return `${GRAPH}/drives/${env("GRAPH_WORKBOOK_DRIVE_ID")}/items/${env("GRAPH_WORKBOOK_ITEM_ID")}/workbook`; }
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

const NAMES: { name: string; ref: string; comment: string }[] = [
  { name: "eh_in_homePrice",    ref: "=Front!$B$6",   comment: "EarnedHome input — home price ($)" },
  { name: "eh_in_downPct",      ref: "=Front!$B$8",   comment: "EarnedHome input — down payment % (decimal, 0.10 = 10%)" },
  { name: "eh_in_sellerCredit", ref: "=Front!$B$24",  comment: "EarnedHome input — seller credit ($)" },
  { name: "eh_in_creditBand",   ref: "=Engine!$H$22", comment: "EarnedHome input — credit band index 1-9" },
  { name: "eh_in_occupancy",    ref: "=Engine!$F$16", comment: "EarnedHome input — occupancy index 1=Primary,2=2nd,3=Investment" },
  { name: "eh_in_propertyType", ref: "=Engine!$F$21", comment: "EarnedHome input — property type index 1=Single Family,2=2-4 Unit,3=Condo,4=Manufactured" },
  { name: "eh_in_veteran",      ref: "=Engine!$S$57", comment: "EarnedHome input — veteran TRUE/FALSE" },
  { name: "eh_in_firstTime",    ref: "=Engine!$M$14", comment: "EarnedHome input — first-time buyer TRUE/FALSE" },
];

async function main(): Promise<void> {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length) { console.log("Missing env vars in .env.local:\n - " + missing.join("\n - ")); process.exit(1); }
  console.log(`\nCreating base input named ranges — workbook ${env("GRAPH_WORKBOOK_ITEM_ID").slice(0, 12)}…\n`);
  const t = await token();
  let created = 0, skipped = 0, failed = 0;
  for (const { name, ref, comment } of NAMES) {
    const r = await fetch(`${base()}/names/add`, {
      method: "POST",
      headers: { authorization: `Bearer ${t}`, "content-type": "application/json" },
      body: JSON.stringify({ name, reference: ref, comment }),
    });
    if (r.ok) { console.log(`+ created  ${name.padEnd(20)} ${ref}`); created++; continue; }
    const txt = await r.text();
    if (/already exists|same name|conflict/i.test(txt)) { console.log(`= exists   ${name.padEnd(20)} (skipped)`); skipped++; }
    else { console.log(`x FAILED   ${name.padEnd(20)} ${r.status}: ${txt.slice(0, 90)}`); failed++; }
  }
  console.log(`\nDone: ${created} created, ${skipped} already existed, ${failed} failed.` +
    (failed === 0 ? " All base input names are in place." : " Re-run after fixing the failures."));
}
main().catch((e) => { console.error("\nFAILED:", (e as Error).message); process.exit(1); });
