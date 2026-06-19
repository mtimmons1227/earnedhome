/**
 * Creates the VA named ranges in the LIVE RateStream workbook via Microsoft
 * Graph, at the exact cells verified from RateStreamWorkBook.xlsx. Persists to
 * the file (no session). Any names that already exist are skipped automatically.
 *
 * VA has no mortgage-insurance row (the funding fee is handled inside the
 * engine), so there is no eh_out_va*_mi name — the GUI shows "—" for MI.
 *
 * IMPORTANT: close RateStreamWorkBook.xlsx in Excel before running, so the open
 * copy doesn't overwrite the changes (AutoSave).
 *
 * Run:  npm run create:va-names
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

// Exact cells, read & verified from RateStreamWorkBook.xlsx.
// Outputs: Front sheet. VA 30-yr block in cols P/Q, VA 15-yr block in cols T/U.
// Inputs: Engine sheet Form-Control linked cells (TRUE/FALSE), rows 58-60.
const NAMES: { name: string; ref: string; comment: string }[] = [
  // VA 30-year outputs
  { name: "eh_out_va30_rate",  ref: "=Front!$P$19", comment: "EarnedHome VA output" },
  { name: "eh_out_va30_apr",   ref: "=Front!$Q$19", comment: "EarnedHome VA output" },
  { name: "eh_out_va30_pi",    ref: "=Front!$P$21", comment: "EarnedHome VA output" },
  { name: "eh_out_va30_taxes", ref: "=Front!$P$22", comment: "EarnedHome VA output" },
  { name: "eh_out_va30_ins",   ref: "=Front!$P$23", comment: "EarnedHome VA output" },
  { name: "eh_out_va30_total", ref: "=Front!$P$26", comment: "EarnedHome VA output" },
  // VA 15-year outputs
  { name: "eh_out_va15_rate",  ref: "=Front!$T$19", comment: "EarnedHome VA output" },
  { name: "eh_out_va15_apr",   ref: "=Front!$U$19", comment: "EarnedHome VA output" },
  { name: "eh_out_va15_pi",    ref: "=Front!$T$21", comment: "EarnedHome VA output" },
  { name: "eh_out_va15_taxes", ref: "=Front!$T$22", comment: "EarnedHome VA output" },
  { name: "eh_out_va15_ins",   ref: "=Front!$T$23", comment: "EarnedHome VA output" },
  { name: "eh_out_va15_total", ref: "=Front!$T$26", comment: "EarnedHome VA output" },
  // VA inputs (Form-Control linked cells, TRUE/FALSE)
  { name: "eh_in_vaPriorLoan",  ref: "=Engine!$S$58", comment: "EarnedHome VA input — Previous VA loan" },
  { name: "eh_in_vaDisability", ref: "=Engine!$S$59", comment: "EarnedHome VA input — Receiving disability" },
  { name: "eh_in_vaFundingFee", ref: "=Engine!$S$60", comment: "EarnedHome VA input — Finance funding fee" },
];

async function main(): Promise<void> {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length) { console.log("Missing env vars in .env.local:\n - " + missing.join("\n - ")); process.exit(1); }
  console.log(`\nCreating VA named ranges — workbook ${env("GRAPH_WORKBOOK_ITEM_ID").slice(0, 12)}…\n`);
  const t = await token();
  let created = 0, skipped = 0, failed = 0;
  for (const { name, ref, comment } of NAMES) {
    const r = await fetch(`${base()}/names/add`, {
      method: "POST",
      headers: { authorization: `Bearer ${t}`, "content-type": "application/json" },
      body: JSON.stringify({ name, reference: ref, comment }),
    });
    if (r.ok) { console.log(`+ created  ${name.padEnd(22)} ${ref}`); created++; continue; }
    const txt = await r.text();
    if (/already exists|same name|conflict/i.test(txt)) { console.log(`= exists   ${name.padEnd(22)} (skipped)`); skipped++; }
    else { console.log(`x FAILED   ${name.padEnd(22)} ${r.status}: ${txt.slice(0, 90)}`); failed++; }
  }
  console.log(`\nDone: ${created} created, ${skipped} already existed, ${failed} failed.` +
    (failed === 0 ? " All VA names are now in place." : " Re-run after fixing the failures."));
}
main().catch((e) => { console.error("\nFAILED:", (e as Error).message); process.exit(1); });
