/**
 * End-to-end proof for ONE product (30-yr Fixed). Writes a sample buyer's 7
 * inputs, recalculates, and reads back the 7 eh_out_fixed30_* values from
 * RateStream. If real numbers come back, the full input -> engine -> output
 * pipeline is proven; naming the other 3 products is then just repetition.
 *
 * Needs these named in RateStream: the 7 eh_in_* (already done) and the 7
 * eh_out_fixed30_* on the 30 Year Fixed card. Session-only (persistChanges:false)
 * — does NOT change or save the workbook.
 *
 * Run:  npm run test:fixed30
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
async function gf(t: string, url: string, init: RequestInit, s?: string): Promise<Response> {
  const headers: Record<string, string> = { authorization: `Bearer ${t}`, "content-type": "application/json", ...((init.headers as Record<string, string>) ?? {}) };
  if (s) headers["workbook-session-id"] = s;
  return fetch(url, { ...init, headers });
}
async function read(t: string, name: string, s: string): Promise<{ ok: boolean; val: unknown; status: number }> {
  const r = await gf(t, `${base()}/names/${name}/range?$select=values`, { method: "GET" }, s);
  if (!r.ok) return { ok: false, val: undefined, status: r.status };
  return { ok: true, val: ((await r.json()) as { values?: unknown[][] }).values?.[0]?.[0], status: 200 };
}

const INPUTS: { name: string; value: number | boolean }[] = [
  { name: "eh_in_homePrice", value: 500000 },
  { name: "eh_in_downPct", value: 0.2 },
  { name: "eh_in_sellerCredit", value: 0 },
  { name: "eh_in_creditBand", value: 7 },   // 7 = 740-759
  { name: "eh_in_occupancy", value: 1 },     // 1 = Primary
  { name: "eh_in_veteran", value: false },
  { name: "eh_in_firstTime", value: false },
];
const OUT = ["rate", "apr", "pi", "taxes", "ins", "mi", "total"].map((f) => `eh_out_fixed30_${f}`);

async function main(): Promise<void> {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length) { console.log("Missing env vars in .env.local:\n - " + missing.join("\n - ")); process.exit(1); }
  console.log(`\n30-yr Fixed end-to-end test — workbook ${env("GRAPH_WORKBOOK_ITEM_ID").slice(0, 12)}…`);
  console.log("Inputs: $500,000 home · 20% down · 740-759 · Primary · no seller credit\n");
  const t = await token();
  const sRes = await gf(t, `${base()}/createSession`, { method: "POST", body: JSON.stringify({ persistChanges: false }) });
  if (!sRes.ok) throw new Error(`createSession ${sRes.status}: ${await sRes.text()}`);
  const session = ((await sRes.json()) as { id: string }).id;

  try {
    for (const { name, value } of INPUTS) {
      const w = await gf(t, `${base()}/names/${name}/range`, { method: "PATCH", body: JSON.stringify({ values: [[value]] }) }, session);
      if (!w.ok) throw new Error(`write ${name} failed (${w.status}) — input name missing?`);
    }
    await gf(t, `${base()}/application/calculate`, { method: "POST", body: JSON.stringify({ calculationType: "Full" }) }, session);
    console.log("✓ wrote 7 inputs + recalculated\n--- 30 Year Fixed (read back from RateStream) ---");

    let missingOut = 0;
    for (const name of OUT) {
      const r = await read(t, name, session);
      if (!r.ok) { console.log(`x  ${name.padEnd(22)} NOT FOUND (${r.status}) — not named yet`); missingOut++; }
      else console.log(`   ${name.padEnd(22)} ${r.val}`);
    }
    console.log(missingOut === 0
      ? "\nPASS — pulled all 7 values for the 30-yr Fixed. Pipeline proven; name the other 3 products the same way."
      : `\n${missingOut} of 7 output names missing — name those cells on the 30 Year Fixed card and re-run.`);
  } finally {
    await gf(t, `${base()}/closeSession`, { method: "POST" }, session).catch(() => {});
  }
}
main().catch((e) => { console.error("\nFAILED:", (e as Error).message); process.exit(1); });
