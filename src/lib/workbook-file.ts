/**
 * Workbook file operations via Microsoft Graph — download the whole .xlsx and
 * replace it IN PLACE (same drive item, so the file's address never changes).
 *
 * Powers the loan-officer "Workbook Swap" tool (src/app/dashboard/workbook).
 * Uses the same GRAPH_* env vars + drive/item IDs as the pricing engine, so it
 * always operates on the exact file the website reads.
 */

const GRAPH = "https://graph.microsoft.com/v1.0";
const LOGIN = "https://login.microsoftonline.com";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}
function itemBase(): string {
  return `${GRAPH}/drives/${env("GRAPH_WORKBOOK_DRIVE_ID")}/items/${env("GRAPH_WORKBOOK_ITEM_ID")}`;
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

/** Download the current workbook bytes + its real filename (for the browser save). */
export async function downloadWorkbook(): Promise<{ bytes: ArrayBuffer; filename: string }> {
  const token = await getToken();
  let filename = "RateStreamWorkBook.xlsx";
  try {
    const meta = await fetch(`${itemBase()}?$select=name`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (meta.ok) {
      const name = ((await meta.json()) as { name?: string }).name;
      if (name) filename = name;
    }
  } catch {
    /* fall back to the default name */
  }
  const res = await fetch(`${itemBase()}/content`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Workbook download failed: ${res.status}`);
  return { bytes: await res.arrayBuffer(), filename };
}

/** The web URL that opens the live workbook in Excel (web/desktop) for in-place editing. */
export async function getWorkbookWebUrl(): Promise<string | null> {
  try {
    const token = await getToken();
    const res = await fetch(`${itemBase()}?$select=webUrl`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { webUrl?: string };
    return j.webUrl ?? null;
  } catch {
    return null;
  }
}

/** Replace the workbook content IN PLACE — same item id, so the address is preserved. */
export async function replaceWorkbook(bytes: Buffer): Promise<void> {
  const token = await getToken();
  const res = await fetch(`${itemBase()}/content`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
    body: new Uint8Array(bytes),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Workbook replace failed: ${res.status} ${detail}`.trim());
  }
}

/** Cheap sanity check: a real .xlsx is a ZIP, so it starts with the bytes "PK". */
export function looksLikeXlsx(buf: Buffer): boolean {
  return buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b; // "PK"
}

/**
 * Post-replace verification: open a throwaway session and confirm a known named
 * range still resolves. If this returns false, the uploaded file is missing its
 * tags and the previous version should be restored (SharePoint version history).
 */
export async function verifyNamedRange(name = "eh_out_ratesAsOf"): Promise<boolean> {
  const token = await getToken();
  let session: string | null = null;
  try {
    const sres = await fetch(`${itemBase()}/workbook/createSession`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ persistChanges: false }),
    });
    if (!sres.ok) return false;
    session = ((await sres.json()) as { id: string }).id;
    const r = await fetch(`${itemBase()}/workbook/names/${name}/range?$select=address`, {
      headers: { authorization: `Bearer ${token}`, "workbook-session-id": session },
    });
    return r.ok;
  } catch {
    return false;
  } finally {
    if (session) {
      await fetch(`${itemBase()}/workbook/closeSession`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "workbook-session-id": session },
      }).catch(() => {});
    }
  }
}
