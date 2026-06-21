/**
 * VA diagnostic — answers "the workbook shows VA values in Excel; why doesn't
 * the app pull them?" It reads the VA cells through Microsoft Graph in TWO passes:
 *
 *   PASS 1 (no write, no recalc): reads the LAST-SAVED values straight from the
 *           file. These should match what you see in Excel right now.
 *   PASS 2 (write VA inputs + full recalc, like the app does): reads again. If the
 *           values drop to 0/blank here, the cause is the EXTERNAL workbook links —
 *           Graph can't open the linked rate file in the cloud, so a recalc can't
 *           refresh those cells. (Excel on your PC can, which is why you see numbers.)
 *
 * Session-only (persistChanges:false) — does NOT change or save the workbook.
 *
 * Run:  npm run test:va
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

// VA-only scenario: $400k home, $0 down (VA allows 100%), 740-759, Primary, Veteran.
const INPUTS: { name: string; value: number | boolean }[] = [
  { name: "eh_in_homePrice", value: 400000 },
  { name: "eh_in_downPct", value: 0 },
  { name: "eh_in_sellerCredit", value: 0 },
  { name: "eh_in_creditBand", value: 7 },   // 7 = 740-759
  { name: "eh_in_occupancy", value: 1 },     // 1 = Primary
  { name: "eh_in_veteran", value: true },
  { name: "eh_in_firstTime", value: true },
  { name: "eh_in_vaPriorLoan", value: false },
  { name: "eh_in_vaDisability", value: false },
  { name: "eh_in_vaFundingFee", value: true },
];
const OUT = ["va30", "va15"].flatMap((p) => ["rate", "apr", "pi", "taxes", "ins", "total"].map((f) => `eh_out_${p}_${f}`));

async function readAll(t: string, s: string, label: string): Promise<void> {
  console.log(`\n--- ${label} ---`);
  let missing = 0;
  for (const name of OUT) {
    const r = await read(t, name, s);
    if (!r.ok) { console.log(`x  ${name.padEnd(20)} NOT FOUND (${r.status})`); missing++; }
    else console.log(`   ${name.padEnd(20)} ${r.val}`);
  }
  if (missing) console.log(`(${missing} names missing — run "npm run create:va-names" first)`);
}

async function main(): Promise<void> {
  const miss = REQUIRED.filter((k) => !process.env[k]);
  if (miss.length) { console.log("Missing env vars in .env.local:\n - " + miss.join("\n - ")); process.exit(1); }
  console.log(`\nVA diagnostic — workbook ${env("GRAPH_WORKBOOK_ITEM_ID").slice(0, 12)}…`);
  const t = await token();
  const sRes = await gf(t, `${base()}/createSession`, { method: "POST", body: JSON.stringify({ persistChanges: false }) });
  if (!sRes.ok) throw new Error(`createSession ${sRes.status}: ${await sRes.text()}`);
  const session = ((await sRes.json()) as { id: string }).id;

  try {
    // PASS 1 — saved values, no recalc. Should match Excel.
    await readAll(t, session, "PASS 1: last-saved values (no write, no recalc)");

    // PASS 2 — write VA scenario + full recalc, exactly like the app.
    for (const { name, value } of INPUTS) {
      const w = await gf(t, `${base()}/names/${name}/range`, { method: "PATCH", body: JSON.stringify({ values: [[value]] }) }, session);
      if (!w.ok) console.log(`! write ${name} failed (${w.status})`);
    }
    await gf(t, `${base()}/application/calculate`, { method: "POST", body: JSON.stringify({ calculationType: "Full" }) }, session);
    await readAll(t, session, "PASS 2: after writing VA inputs + full recalc (what the app sees)");

    console.log("\nHow to read this:");
    console.log(" • PASS 1 has numbers, PASS 2 goes to 0/blank  → external links are the cause (RateStream must be self-contained).");
    console.log(" • Both passes have numbers                     → wiring is fine; the GUI issue is elsewhere (not pushed / Netlify on stub).");
    console.log(" • PASS 1 also 0/blank                          → the saved snapshot itself has no VA values for this scenario.");
  } finally {
    await gf(t, `${base()}/closeSession`, { method: "POST" }, session).catch(() => {});
  }
}
main().catch((e) => { console.error("\nFAILED:", (e as Error).message); process.exit(1); });
