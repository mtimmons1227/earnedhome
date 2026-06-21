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
 * ASSUMPTION (Field_Mapping_v3 Q-A): the workbook exposes all four product output
 * blocks at once (eh_out_fixed30_*, eh_out_fha30_*, eh_out_fixed15_*, eh_out_fha15_*),
 * so one recalc yields every card. If Richard instead computes one product at a time,
 * switch readProducts() to four passes (set a product/term selector, recalc, read 7).
 */

const GRAPH = "https://graph.microsoft.com/v1.0";
const LOGIN = "https://login.microsoftonline.com";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}
function workbookBase(): string {
  return `${GRAPH}/drives/${env("GRAPH_WORKBOOK_DRIVE_ID")}/items/${env("GRAPH_WORKBOOK_ITEM_ID")}/workbook`;
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

// ---- Graph fetch with session header + 429/503 backoff ----
async function gfetch(url: string, init: RequestInit, session?: string): Promise<Response> {
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
async function setRange(name: string, value: string | number | boolean, session: string): Promise<void> {
  const res = await gfetch(`${workbookBase()}/names/${name}/range`, {
    method: "PATCH",
    body: JSON.stringify({ values: [[value]] }),
  }, session);
  if (!res.ok) throw new Error(`write ${name} failed: ${res.status}`);
}
async function recalc(session: string): Promise<void> {
  const res = await gfetch(`${workbookBase()}/application/calculate`, {
    method: "POST",
    body: JSON.stringify({ calculationType: "Full" }),
  }, session);
  if (!res.ok) throw new Error(`recalc failed: ${res.status}`);
}
async function getRange(name: string, session: string): Promise<unknown> {
  const res = await gfetch(`${workbookBase()}/names/${name}/range?$select=values`, { method: "GET" }, session);
  if (!res.ok) throw new Error(`read ${name} failed: ${res.status}`);
  const j = (await res.json()) as { values?: unknown[][] };
  return j.values?.[0]?.[0];
}
// Tolerant read: returns undefined (not an error) when a name doesn't exist yet,
// so optional outputs (e.g. per-product cashToClose, before their names are
// created in RateStream) never break the whole quote.
async function getRangeOpt(name: string, session: string): Promise<unknown> {
  const res = await gfetch(`${workbookBase()}/names/${name}/range?$select=values`, { method: "GET" }, session);
  if (!res.ok) return undefined;
  const j = (await res.json()) as { values?: unknown[][] };
  return j.values?.[0]?.[0];
}
// Reads the cell's DISPLAYED text (e.g. a date shows as "June 20, 2026" not the serial number).
async function getRangeText(name: string, session: string): Promise<string | undefined> {
  const res = await gfetch(`${workbookBase()}/names/${name}/range?$select=text`, { method: "GET" }, session);
  if (!res.ok) return undefined;
  const t = ((await res.json()) as { text?: string[][] }).text?.[0]?.[0];
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
    if (hit && Date.now() < hit.exp) return hit.q;

    const quote = await withLock<PricingQuote>(async () => {
      const session = await createSession();
      try {
        // Write the 7 inputs (eh_in_*). Plain Front cells: price, down %, seller credit.
        // Engine-sheet Form-Control linked cells: credit & occupancy as INDEX, veteran/
        // firstTime as TRUE/FALSE. Down Payment is computed in-sheet from Down %, so we
        // drive Down % only. Buydown is fixed (None) in 1A and not sent.
        await setRange("eh_in_homePrice", input.homePrice, session);
        // UI sends whole percent (10 = 10%); the workbook's Down% cell stores a decimal (0.10).
        await setRange("eh_in_downPct", input.downPct / 100, session);
        await setRange("eh_in_sellerCredit", input.sellerCredit, session);
        await setRange("eh_in_creditBand", CREDIT_INDEX[input.creditBand], session);
        await setRange("eh_in_occupancy", OCCUPANCY_INDEX[input.occupancy], session);
        await setRange("eh_in_veteran", input.veteran, session);
        await setRange("eh_in_firstTime", input.firstTime, session);
        await setRange("eh_in_vaPriorLoan", input.vaPriorLoan, session);
        await setRange("eh_in_vaDisability", input.vaDisability, session);
        await setRange("eh_in_vaFundingFee", input.vaFundingFee, session);
        await recalc(session);

        // Read all four product blocks (eh_out_<prefix>_*).
        const products: PricingProduct[] = [];
        for (const p of PRODUCTS) {
          products.push({
            product: p.name,
            // Heading text straight from the sheet (e.g. "Jumbo 30 Year Fixed"); fall back to the internal name.
            displayName: String((await getRangeOpt(`eh_out_${p.prefix}_name`, session)) ?? p.name),
            termYears: p.term,
            isFha: p.fha,
            isVa: p.va,
            // RateStream stores rate/APR as decimals (0.0625); the UI shows percent.
            rate: num(await getRange(`eh_out_${p.prefix}_rate`, session)) * 100,
            apr: num(await getRange(`eh_out_${p.prefix}_apr`, session)) * 100,
            principalAndInterest: Math.round(num(await getRange(`eh_out_${p.prefix}_pi`, session))),
            taxes: Math.round(num(await getRange(`eh_out_${p.prefix}_taxes`, session))),
            insurance: Math.round(num(await getRange(`eh_out_${p.prefix}_ins`, session))),
            mortgageInsurance: p.va ? 0 : Math.round(num(await getRange(`eh_out_${p.prefix}_mi`, session))),
            totalPayment: Math.round(num(await getRange(`eh_out_${p.prefix}_total`, session))),
            loanFees: Math.round(num(await getRangeOpt(`eh_out_${p.prefix}_loanFees`, session))),
            prepaids: Math.round(num(await getRangeOpt(`eh_out_${p.prefix}_prepaids`, session))),
            downPayment: Math.round(num(await getRangeOpt(`eh_out_${p.prefix}_downPayment`, session))),
            lessSeller: Math.round(num(await getRangeOpt(`eh_out_${p.prefix}_lessSeller`, session))),
            cashToClose: Math.round(num(await getRangeOpt(`eh_out_${p.prefix}_cashToClose`, session))),
          });
        }

        // Top-level cash-to-close = the 30-yr Fixed card's (each product also carries its own).
        // Tolerant: the new workbook has per-product cashToClose, not a single shared tag.
        const cashToClose = products[0]?.cashToClose ?? Math.round(num(await getRangeOpt("eh_out_cashToClose", session)));
        // Read the DISPLAYED text so a date cell shows "June 20, 2026", not its serial number.
        const ratesAsOf = (await getRangeText("eh_out_ratesAsOf", session)) ?? new Date().toISOString().slice(0, 10);

        return {
          engine: "graph",
          ratesAsOf,
          cashToClose,
          products,
          disclosures: [...RPARRY_DISCLOSURES],
        } satisfies PricingQuote;
      } finally {
        await closeSession(session);
      }
    });

    cache.set(cacheKey, { q: quote, exp: Date.now() + TTL_MS });
    return quote;
  },
};
