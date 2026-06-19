/**
 * Creates the remaining eh_out_* named ranges in the LIVE RateStream workbook
 * via Microsoft Graph, at the exact cells (verified from the workbook). It
 * persists to the file (no session). The 14 names you already created are
 * skipped automatically.
 *
 * IMPORTANT: close RateStreamWorkBook.xlsx in Excel before running, so the
 * open copy doesn't overwrite the changes (AutoSave).
 *
 * Run:  npm run create:names
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

// Exact cells, read & verified from RateStreamWorkBook.xlsx (Front sheet).
const NAMES: { name: string; ref: string }[] = [
  { name: "eh_out_fixed15_mi", ref: "=Front!$J$10" },
  { name: "eh_out_fha30_rate", ref: "=Front!$F$19" },
  { name: "eh_out_fha30_apr",  ref: "=Front!$G$19" },
  { name: "eh_out_fha30_pi",   ref: "=Front!$F$21" },
  { name: "eh_out_fha30_taxes",ref: "=Front!$F$22" },
  { name: "eh_out_fha30_ins",  ref: "=Front!$F$23" },
  { name: "eh_out_fha30_mi",   ref: "=Front!$F$24" },
  { name: "eh_out_fha30_total",ref: "=Front!$F$26" },
  { name: "eh_out_fha15_rate", ref: "=Front!$J$19" },
  { name: "eh_out_fha15_apr",  ref: "=Front!$K$19" },
  { name: "eh_out_fha15_pi",   ref: "=Front!$J$21" },
  { name: "eh_out_fha15_taxes",ref: "=Front!$J$22" },
  { name: "eh_out_fha15_ins",  ref: "=Front!$J$23" },
  { name: "eh_out_fha15_mi",   ref: "=Front!$J$24" },
  { name: "eh_out_fha15_total",ref: "=Front!$J$26" },
  { name: "eh_out_ratesAsOf",  ref: "=Front!$B$4"  },
];

async function main(): Promise<void> {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length) { console.log("Missing env vars in .env.local:\n - " + missing.join("\n - ")); process.exit(1); }
  console.log(`\nCreating output named ranges — workbook ${env("GRAPH_WORKBOOK_ITEM_ID").slice(0, 12)}…\n`);
  const t = await token();
  let created = 0, skipped = 0, failed = 0;
  for (const { name, ref } of NAMES) {
    const r = await fetch(`${base()}/names/add`, {
      method: "POST",
      headers: { authorization: `Bearer ${t}`, "content-type": "application/json" },
      body: JSON.stringify({ name, reference: ref, comment: "EarnedHome output" }),
    });
    if (r.ok) { console.log(`+ created  ${name.padEnd(22)} ${ref}`); created++; continue; }
    const txt = await r.text();
    if (/already exists|same name|conflict/i.test(txt)) { console.log(`= exists   ${name.padEnd(22)} (skipped)`); skipped++; }
    else { console.log(`x FAILED   ${name.padEnd(22)} ${r.status}: ${txt.slice(0, 90)}`); failed++; }
  }
  console.log(`\nDone: ${created} created, ${skipped} already existed, ${failed} failed.` +
    (failed === 0 ? " All output names are now in place." : " Re-run after fixing the failures."));
}
main().catch((e) => { console.error("\nFAILED:", (e as Error).message); process.exit(1); });
