import type {
  PricingAdapter, PricingInput, PricingProduct, PricingQuote, ProductName,
  CreditBand, Occupancy,
} from "./types";
import { RPARRY_DISCLOSURES } from "./disclosures";

/**
 * Phase 1A.2 — Microsoft Graph (Excel) pricing adapter.
 *
 * Drives Richard's workbook (hosted in company M365 SharePoint/OneDrive) by the
 * eh_in_* / eh_out_* NAMED RANGES from Field_Mapping_v3 — never by cell address.
 * Activated by PRICING_ADAPTER=graph + the GRAPH_* env vars; otherwise the app
 * uses the stub. See docs/PRICING_ENGINE.md.
 *
 * PERFORMANCE: all named-range writes and reads are sent through the Graph
 * JSON-batch endpoint (/$batch, up to 20 sub-requests per HTTP call). One quote
 * is ~6 round-trips (session + one write+recalc batch + a few read batches +
 * close) instead of ~90 sequential calls. No workbook layout change required.
 */

const GRAPH = "https://graph.microsoft.com/v1.0";
const LOGIN = "https://login.microsoftonline.com";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}
// Full URL (for session create/close); path-only (for $batch sub-requests).
function workbookBase(): string {
  return `${GRAPH}${wbPath()}`;
}
function wbPath(): string {
  return `/drives/${env("GRAPH_WORKBOOK_DRIVE_ID")}/items/${env("GRAPH_WORKBOOK_ITEM_ID")}/workbook`;
}

// ---- app-only token (client credentials), cached until ~1 min before expiry ----
let tokenCache: { token: string; exp: number } | null = null;
async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.exp - 60_000) return tokenCache.token;
  const body = new URLSearchParams({
    client_id: env("GRAPH_CLIENT_ID"),
    client_secret: env("GRAPH_CLIENT_SECRET"),
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(`${LOGIN}/${env("GRAPH_TENANT_ID")}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Graph token request failed: ${res.status}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

// Count of Graph round-trips (workbook calls), for latency telemetry. Reads are
// serialized by withLock, so a per-quote delta of this counter is accurate.
let callCounter = 0;

// ---- Graph fetch with session header + 429/503 backoff ----
async function gfetch(url: string, init: RequestInit, session?: string): Promise<Response> {
  callCounter++;
  const token = await getToken();
  const headers: Record<string, string> = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (session) headers["workbook-session-id"] = session;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { ...init, headers });
    if (res.status !== 429 && res.status !== 503) return res;
    const wait = Number(res.headers.get("retry-after") ?? attempt + 1) * 1000;
    await new Promise((r) => setTimeout(r, wait));
  }
  return fetch(url, { ...init, headers });
}

async function createSession(): Promise<string> {
  const res = await gfetch(`${workbookBase()}/createSession`, {
    method: "POST",
    body: JSON.stringify({ persistChanges: false }),
  });
  if (!res.ok) throw new Error(`createSession failed: ${res.status}`);
  return ((await res.json()) as { id: string }).id;
}
async function closeSession(session: string): Promise<void> {
  try {
    await gfetch(`${workbookBase()}/closeSession`, { method: "POST" }, session);
  } catch {
    /* best-effort */
  }
}

// ---- Graph JSON batching ----------------------------------------------------
interface Sub {
  id: string;
  method: "GET" | "POST" | "PATCH";
  url: string;            // path relative to /v1.0 (e.g. /drives/.../workbook/...)
  body?: unknown;
  dependsOn?: string[];
}
interface SubResponse { status: number; body?: unknown }

// Sends sub-requests in chunks of 20 (Graph's per-batch limit), carrying the
// workbook session on each. Returns a map of sub-request id -> response.
async function runBatch(subs: Sub[], session: string): Promise<Map<string, SubResponse>> {
  const out = new Map<string, SubResponse>();
  for (let i = 0; i < subs.length; i += 20) {
    const chunk = subs.slice(i, i + 20);
    const res = await gfetch(`${GRAPH}/$batch`, {
      method: "POST",
      body: JSON.stringify({
        requests: chunk.map((s) => ({
          id: s.id,
          method: s.method,
          url: s.url,
          headers: { "content-type": "application/json", "workbook-session-id": session },
          ...(s.body !== undefined ? { body: s.body } : {}),
          ...(s.dependsOn ? { dependsOn: s.dependsOn } : {}),
        })),
      }),
    });
    if (!res.ok) throw new Error(`$batch failed: ${res.status}`);
    const j = (await res.json()) as { responses?: { id: string; status: number; body?: unknown }[] };
    for (const r of j.responses ?? []) out.set(r.id, { status: r.status, body: r.body });
  }
  return out;
}

// Pull a single value / displayed-text out of a batched range response.
// A missing optional named range comes back as a >=400 sub-status → undefined,
// so optional outputs never break the whole quote (tolerant by design).
function valOf(m: Map<string, SubResponse>, id: string): unknown {
  const r = m.get(id);
  if (!r || r.status >= 400) return undefined;
  return (r.body as { values?: unknown[][] })?.values?.[0]?.[0];
}
function textOf(m: Map<string, SubResponse>, id: string): string | undefined {
  const r = m.get(id);
  if (!r || r.status >= 400) return undefined;
  const t = (r.body as { text?: string[][] })?.text?.[0]?.[0];
  return t ? String(t).trim() : undefined;
}
const num = (v: unknown): number =>
  typeof v === "number" ? v : Number(String(v ?? "").replace(/[^0-9.\-]/g, "")) || 0;

// ---- serialize access to the single shared workbook (concurrency lock) ----
let lockChain: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lockChain.then(fn, fn);
  lockChain = run.then(() => undefined, () => undefined);
  return run;
}

// ---- short input-hash cache (TTL) — replace with Redis keyed on inputs+rateVersion at scale ----
const cache = new Map<string, { q: PricingQuote; exp: number }>();
const TTL_MS = 5 * 60 * 1000;

const PRODUCTS: { name: ProductName; term: 15 | 30; fha: boolean; va: boolean; prefix: string }[] = [
  { name: "30-yr Fixed", term: 30, fha: false, va: false, prefix: "fixed30" },
  { name: "30-yr FHA", term: 30, fha: true, va: false, prefix: "fha30" },
  { name: "15-yr Fixed", term: 15, fha: false, va: false, prefix: "fixed15" },
  { name: "15-yr FHA", term: 15, fha: true, va: false, prefix: "fha15" },
  { name: "30-yr VA", term: 30, fha: false, va: true, prefix: "va30" },
  { name: "15-yr VA", term: 15, fha: false, va: true, prefix: "va15" },
];

// RateStream drives credit & occupancy by INDEX via Form-Control linked cells on the
// Engine sheet (eh_in_creditBand=Engine!H22, eh_in_occupancy=Engine!F16).
const CREDIT_INDEX: Record<CreditBand, number> = {
  "620–639": 1, "640–659": 2, "660–679": 3, "680–699": 4,
  "700–719": 5, "720–739": 6, "740–759": 7, "760–779": 8, "780+": 9,
};
const OCCUPANCY_INDEX: Record<Occupancy, number> = {
  "Primary": 1, "Second Home": 2, "Investment": 3,
};

export const graphAdapter: PricingAdapter = {
  name: "graph",
  async quote(input: PricingInput): Promise<PricingQuote> {
    const cacheKey = JSON.stringify(input);
    const hit = cache.get(cacheKey);
    if (hit && Date.now() < hit.exp) {
      return { ...hit.q, meta: { tookMs: 0, graphCalls: 0, cached: true } };
    }

    const built = await withLock(async () => {
      const t0 = Date.now();
      const callsBefore = callCounter;
      const session = await createSession();
      try {
        // --- 1) Write the 10 inputs + recalc, as one serially-chained batch. ---
        // Plain Front cells: price, down %, seller credit. Engine-sheet Form-Control
        // linked cells: credit & occupancy as INDEX; veteran/firstTime/VA flags as
        // TRUE/FALSE. Down Payment is computed in-sheet from Down %. Buydown fixed (None).
        const writes: Sub[] = [];
        const w = (name: string, value: string | number | boolean) => {
          const id = `w${writes.length}`;
          const sub: Sub = {
            id, method: "PATCH",
            url: `${wbPath()}/names/${name}/range`,
            body: { values: [[value]] },
          };
          if (writes.length) sub.dependsOn = [`w${writes.length - 1}`];
          writes.push(sub);
        };
        w("eh_in_homePrice", input.homePrice);
        // UI sends whole percent (10 = 10%); the workbook's Down% cell stores a decimal (0.10).
        w("eh_in_downPct", input.downPct / 100);
        w("eh_in_sellerCredit", input.sellerCredit);
        w("eh_in_creditBand", CREDIT_INDEX[input.creditBand]);
        w("eh_in_occupancy", OCCUPANCY_INDEX[input.occupancy]);
        w("eh_in_veteran", input.veteran);
        w("eh_in_firstTime", input.firstTime);
        w("eh_in_vaPriorLoan", input.vaPriorLoan);
        w("eh_in_vaDisability", input.vaDisability);
        w("eh_in_vaFundingFee", input.vaFundingFee);
        writes.push({
          id: `w${writes.length}`, method: "POST",
          url: `${wbPath()}/application/calculate`,
          body: { calculationType: "Full" },
          dependsOn: [`w${writes.length - 1}`],
        });
        await runBatch(writes, session);

        // --- 2) Read every product block (eh_out_<prefix>_*) in batches of 20. ---
        const reads: Sub[] = [];
        const rd = (id: string, name: string, select: "values" | "text" = "values") =>
          reads.push({ id, method: "GET", url: `${wbPath()}/names/${name}/range?$select=${select}` });
        for (const p of PRODUCTS) {
          rd(`${p.prefix}_name`, `eh_out_${p.prefix}_name`);
          rd(`${p.prefix}_rate`, `eh_out_${p.prefix}_rate`);
          rd(`${p.prefix}_apr`, `eh_out_${p.prefix}_apr`);
          rd(`${p.prefix}_pi`, `eh_out_${p.prefix}_pi`);
          rd(`${p.prefix}_taxes`, `eh_out_${p.prefix}_taxes`);
          rd(`${p.prefix}_ins`, `eh_out_${p.prefix}_ins`);
          if (!p.va) rd(`${p.prefix}_mi`, `eh_out_${p.prefix}_mi`);
          rd(`${p.prefix}_total`, `eh_out_${p.prefix}_total`);
          rd(`${p.prefix}_loanFees`, `eh_out_${p.prefix}_loanFees`);
          rd(`${p.prefix}_prepaids`, `eh_out_${p.prefix}_prepaids`);
          rd(`${p.prefix}_downPayment`, `eh_out_${p.prefix}_downPayment`);
          rd(`${p.prefix}_lessSeller`, `eh_out_${p.prefix}_lessSeller`);
          rd(`${p.prefix}_cashToClose`, `eh_out_${p.prefix}_cashToClose`);
        }
        rd("top_cashToClose", "eh_out_cashToClose");
        rd("ratesAsOf", "eh_out_ratesAsOf", "text"); // displayed text, e.g. "June 20, 2026"
        const m = await runBatch(reads, session);

        const products: PricingProduct[] = PRODUCTS.map((p) => ({
          product: p.name,
          // Heading text straight from the sheet (e.g. "Jumbo 30 Year Fixed"); fall back to the internal name.
          displayName: String(valOf(m, `${p.prefix}_name`) ?? p.name),
          termYears: p.term,
          isFha: p.fha,
          isVa: p.va,
          // RateStream stores rate/APR as decimals (0.0625); the UI shows percent.
          rate: num(valOf(m, `${p.prefix}_rate`)) * 100,
          apr: num(valOf(m, `${p.prefix}_apr`)) * 100,
          principalAndInterest: Math.round(num(valOf(m, `${p.prefix}_pi`))),
          taxes: Math.round(num(valOf(m, `${p.prefix}_taxes`))),
          insurance: Math.round(num(valOf(m, `${p.prefix}_ins`))),
          mortgageInsurance: p.va ? 0 : Math.round(num(valOf(m, `${p.prefix}_mi`))),
          totalPayment: Math.round(num(valOf(m, `${p.prefix}_total`))),
          loanFees: Math.round(num(valOf(m, `${p.prefix}_loanFees`))),
          prepaids: Math.round(num(valOf(m, `${p.prefix}_prepaids`))),
          downPayment: Math.round(num(valOf(m, `${p.prefix}_downPayment`))),
          lessSeller: Math.round(num(valOf(m, `${p.prefix}_lessSeller`))),
          cashToClose: Math.round(num(valOf(m, `${p.prefix}_cashToClose`))),
        }));

        // Top-level cash-to-close = the 30-yr Fixed card's (each product also carries its own).
        const cashToClose = products[0]?.cashToClose ?? Math.round(num(valOf(m, "top_cashToClose")));
        const ratesAsOf = textOf(m, "ratesAsOf") ?? new Date().toISOString().slice(0, 10);

        const quote: PricingQuote = {
          engine: "graph",
          ratesAsOf,
          cashToClose,
          products,
          disclosures: [...RPARRY_DISCLOSURES],
        };
        const tookMs = Date.now() - t0;
        const graphCalls = callCounter - callsBefore;
        console.log(`[pricing] graph quote ${tookMs}ms, ${graphCalls} graph round-trips`);
        return { quote, tookMs, graphCalls };
      } finally {
        await closeSession(session);
      }
    });

    cache.set(cacheKey, { q: built.quote, exp: Date.now() + TTL_MS });
    return { ...built.quote, meta: { tookMs: built.tookMs, graphCalls: built.graphCalls, cached: false } };
  },
};
