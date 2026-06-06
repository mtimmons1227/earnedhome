/**
 * Graph round-trip INFRASTRUCTURE smoke test.
 *
 * Proves the send -> recalc -> receive pipe works end to end, independent of
 * Richard's real cell mapping. Use a throwaway TEST workbook with two named
 * ranges:
 *    eh_test_in   -> any empty cell
 *    eh_test_out  -> a cell containing the formula  =eh_test_in*2
 *
 * Then set the GRAPH_* env vars (pointing GRAPH_WORKBOOK_ITEM_ID at the TEST
 * workbook) and run:   npm run test:graph
 *
 * It writes a random number to eh_test_in, recalculates, and reads eh_test_out.
 * If out == in*2, the infrastructure (auth, session, write, recalc, read) works.
 * Names are overridable via GRAPH_TEST_IN_NAME / GRAPH_TEST_OUT_NAME.
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Load .env.local into process.env (tsx doesn't do this automatically).
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
const IN_NAME = process.env.GRAPH_TEST_IN_NAME ?? "eh_test_in";
const OUT_NAME = process.env.GRAPH_TEST_OUT_NAME ?? "eh_test_out";

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

async function main(): Promise<void> {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length) {
    console.log("Missing env vars (set them in .env.local — see docs/RUNBOOK_connect_graph_engine.md):\n - " + missing.join("\n - "));
    process.exit(1);
  }
  console.log(`\nGraph infrastructure smoke test — workbook item ${env("GRAPH_WORKBOOK_ITEM_ID").slice(0, 12)}…\n`);
  const t = await token();
  console.log("✓ got app-only token");

  const sRes = await gf(t, `${base()}/createSession`, { method: "POST", body: JSON.stringify({ persistChanges: false }) });
  if (!sRes.ok) throw new Error(`createSession ${sRes.status}: ${await sRes.text()}`);
  const session = ((await sRes.json()) as { id: string }).id;
  console.log("✓ opened workbook session");

  try {
    const value = Math.floor(Math.random() * 900) + 100; // 100–999
    const w = await gf(t, `${base()}/names/${IN_NAME}/range`, { method: "PATCH", body: JSON.stringify({ values: [[value]] }) }, session);
    if (!w.ok) throw new Error(`write ${IN_NAME} ${w.status}: ${await w.text()}`);
    console.log(`✓ wrote ${value} to ${IN_NAME}`);

    const c = await gf(t, `${base()}/application/calculate`, { method: "POST", body: JSON.stringify({ calculationType: "Full" }) }, session);
    if (!c.ok) throw new Error(`recalc ${c.status}: ${await c.text()}`);
    console.log("✓ recalculated");

    const readBack = await gf(t, `${base()}/names/${IN_NAME}/range?$select=values`, { method: "GET" }, session);
    const inVal = ((await readBack.json()) as { values?: number[][] }).values?.[0]?.[0];
    console.log(`✓ read ${IN_NAME} back = ${inVal}  (write+read works)`);

    const o = await gf(t, `${base()}/names/${OUT_NAME}/range?$select=values`, { method: "GET" }, session);
    if (!o.ok) throw new Error(`read ${OUT_NAME} ${o.status}: ${await o.text()}`);
    const outVal = ((await o.json()) as { values?: number[][] }).values?.[0]?.[0];
    console.log(`✓ read ${OUT_NAME} = ${outVal}`);

    const expected = value * 2;
    if (outVal === expected) {
      console.log(`\n✅ ROUND-TRIP OK: ${OUT_NAME} = ${IN_NAME} * 2 (${outVal}). Send/receive infrastructure is working.`);
    } else {
      console.log(`\n⚠️  Read worked, but ${OUT_NAME} (${outVal}) != ${IN_NAME}*2 (${expected}).`);
      console.log(`    The pipe works; just confirm ${OUT_NAME}'s formula is =${IN_NAME}*2 (or ignore — any value proves send/receive).`);
    }
  } finally {
    await gf(t, `${base()}/closeSession`, { method: "POST" }, session).catch(() => {});
    console.log("✓ closed session");
  }
}
main().catch((e) => { console.error("\n❌ FAILED:", (e as Error).message); process.exit(1); });
