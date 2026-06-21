/**
 * Creates the per-product Estimated-Cash-Needed named ranges in the LIVE
 * RateStream workbook via Microsoft Graph, so each product card shows its own
 * cash-to-close (not one shared value). Cells verified from RateStreamWorkBook.xlsx
 * Front sheet (label row "Estimated Cash Needed", value one row below).
 *
 * Persists to the file (no session). Names that already exist are skipped.
 * NOTE: eh_out_cashToClose (the original shared one = Front!E15) is left as-is for
 * the dashboard; eh_out_fixed30_cashToClose points at the same cell for uniformity.
 *
 * IMPORTANT: close RateStreamWorkBook.xlsx in Excel before running (AutoSave).
 *
 * Run:  npm run create:ctc-names
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

// Estimated Cash Needed value cell per card (Front sheet).
const NAMES: { name: string; ref: string }[] = [
  { name: "eh_out_fixed30_cashToClose", ref: "=Front!$E$15" },
  { name: "eh_out_fixed15_cashToClose", ref: "=Front!$I$15" },
  { name: "eh_out_fha30_cashToClose",   ref: "=Front!$E$29" },
  { name: "eh_out_fha15_cashToClose",   ref: "=Front!$I$29" },
  { name: "eh_out_va30_cashToClose",    ref: "=Front!$O$29" },
  { name: "eh_out_va15_cashToClose",    ref: "=Front!$S$29" },
];

async function main(): Promise<void> {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length) { console.log("Missing env vars in .env.local:\n - " + missing.join("\n - ")); process.exit(1); }
  console.log(`\nCreating per-product cash-to-close names — workbook ${env("GRAPH_WORKBOOK_ITEM_ID").slice(0, 12)}…\n`);
  const t = await token();
  let created = 0, skipped = 0, failed = 0;
  for (const { name, ref } of NAMES) {
    const r = await fetch(`${base()}/names/add`, {
      method: "POST",
      headers: { authorization: `Bearer ${t}`, "content-type": "application/json" },
      body: JSON.stringify({ name, reference: ref, comment: "EarnedHome per-product cash-to-close" }),
    });
    if (r.ok) { console.log(`+ created  ${name.padEnd(30)} ${ref}`); created++; continue; }
    const txt = await r.text();
    if (/already exists|same name|conflict/i.test(txt)) { console.log(`= exists   ${name.padEnd(30)} (skipped)`); skipped++; }
    else { console.log(`x FAILED   ${name.padEnd(30)} ${r.status}: ${txt.slice(0, 90)}`); failed++; }
  }
  console.log(`\nDone: ${created} created, ${skipped} already existed, ${failed} failed.` +
    (failed === 0 ? " Each card now has its own cash-to-close." : " Re-run after fixing the failures."));
}
main().catch((e) => { console.error("\nFAILED:", (e as Error).message); process.exit(1); });
