/**
 * Input-mapping test. Writes a value to each of the 7 eh_in_* named ranges and
 * reads it back — confirming every input name resolves to a real cell and accepts
 * a write. Runs in a session with persistChanges:false, so it does NOT change or
 * save the actual workbook. Outputs (eh_out_*) are not needed for this test.
 *
 * Run:  npm run test:inputs
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

const INPUTS: { name: string; value: number | boolean }[] = [
  { name: "eh_in_homePrice", value: 500000 },
  { name: "eh_in_downPct", value: 0.2 },
  { name: "eh_in_sellerCredit", value: 0 },
  { name: "eh_in_creditBand", value: 7 },   // index for 740-759
  { name: "eh_in_occupancy", value: 1 },     // 1 = Primary
  { name: "eh_in_veteran", value: false },
  { name: "eh_in_firstTime", value: false },
];

async function main(): Promise<void> {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length) { console.log("Missing env vars in .env.local:\n - " + missing.join("\n - ")); process.exit(1); }
  console.log(`\nInput-mapping test — workbook item ${env("GRAPH_WORKBOOK_ITEM_ID").slice(0, 12)}…\n`);
  const t = await token();
  const sRes = await gf(t, `${base()}/createSession`, { method: "POST", body: JSON.stringify({ persistChanges: false }) });
  if (!sRes.ok) throw new Error(`createSession ${sRes.status}: ${await sRes.text()}`);
  const session = ((await sRes.json()) as { id: string }).id;

  let pass = 0, fail = 0;
  try {
    for (const { name, value } of INPUTS) {
      const w = await gf(t, `${base()}/names/${name}/range`, { method: "PATCH", body: JSON.stringify({ values: [[value]] }) }, session);
      if (!w.ok) { console.log(`x  ${name.padEnd(20)} — WRITE FAILED (${w.status}); name not found or not writable`); fail++; continue; }
      const r = await gf(t, `${base()}/names/${name}/range?$select=values`, { method: "GET" }, session);
      const back = ((await r.json()) as { values?: (number | boolean)[][] }).values?.[0]?.[0];
      console.log(`ok ${name.padEnd(20)} wrote ${String(value).padEnd(7)} read ${back}`);
      pass++;
    }
    await gf(t, `${base()}/application/calculate`, { method: "POST", body: JSON.stringify({ calculationType: "Full" }) }, session);
    console.log(`\n${fail === 0 ? "PASS" : "INCOMPLETE"} — inputs: ${pass} ok, ${fail} failed.` +
      (fail === 0 ? " All 7 input named ranges resolve and accept writes." : " Fix the failed name(s) in Name Manager."));
  } finally {
    await gf(t, `${base()}/closeSession`, { method: "POST" }, session).catch(() => {});
  }
}
main().catch((e) => { console.error("\nFAILED:", (e as Error).message); process.exit(1); });
