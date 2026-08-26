import { createSupabaseAdmin } from "@/lib/supabase/admin";

// Daily Broadcast core: manage the imported Contacts list, resolve an audience
// (BuyerBridge agents OR the imported contacts) into per-recipient merge values,
// render {token|fallback} personalization, and honor the unsubscribe suppression
// list. All service-role — callers are admin-gated API routes.

export interface ContactRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  fields: Record<string, unknown>;
  status: string;
  created_at?: string;
}

// A single recipient of a broadcast, with the merge values available to the body.
export interface AudienceRecipient {
  email: string;
  firstName: string | null;
  values: Record<string, string>; // available {tokens}
}

// ---- Contacts (the imported, non-BuyerBridge list) ----

export async function listContacts(tenantId: string, search?: string): Promise<ContactRow[]> {
  const admin = createSupabaseAdmin();
  let q = admin.from("contacts").select("id, email, first_name, last_name, fields, status, created_at")
    .eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(1000);
  if (search && search.trim()) {
    const s = `%${search.trim()}%`;
    q = q.or(`email.ilike.${s},first_name.ilike.${s},last_name.ilike.${s}`);
  }
  const { data } = await q;
  return (data as ContactRow[] | null) ?? [];
}

export async function countActiveContacts(tenantId: string): Promise<number> {
  const admin = createSupabaseAdmin();
  const { count } = await admin.from("contacts").select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId).eq("status", "active");
  return count ?? 0;
}

export async function addContact(tenantId: string, c: { email: string; first_name?: string | null; last_name?: string | null; fields?: Record<string, unknown> }): Promise<{ ok: boolean; error?: string }> {
  const email = (c.email ?? "").trim().toLowerCase();
  if (!email || !/.+@.+\..+/.test(email)) return { ok: false, error: "A valid email is required" };
  const admin = createSupabaseAdmin();
  const { error } = await admin.from("contacts").upsert({
    tenant_id: tenantId, email,
    first_name: c.first_name?.trim() || null,
    last_name: c.last_name?.trim() || null,
    fields: c.fields ?? {},
    source: "manual",
  }, { onConflict: "tenant_id,email" });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteContact(tenantId: string, id: string): Promise<boolean> {
  const admin = createSupabaseAdmin();
  const { error } = await admin.from("contacts").delete().eq("tenant_id", tenantId).eq("id", id);
  return !error;
}

// Bulk import rows from a spreadsheet. Known columns map to first/last name; every
// other column is stored in `fields` so it becomes an available merge token.
// De-duplicates on (tenant, email): re-importing updates the existing contact.
export async function importContacts(
  tenantId: string,
  rows: Record<string, string>[],
  source: string,
): Promise<{ imported: number; skipped: number }> {
  const admin = createSupabaseAdmin();
  const pick = (r: Record<string, string>, keys: string[]) => {
    for (const k of Object.keys(r)) if (keys.includes(k.trim().toLowerCase())) return r[k];
    return undefined;
  };
  const payload: Record<string, unknown>[] = [];
  let skipped = 0;
  for (const r of rows) {
    const email = (pick(r, ["email", "e-mail", "email address"]) ?? "").trim().toLowerCase();
    if (!email || !/.+@.+\..+/.test(email)) { skipped++; continue; }
    const first = pick(r, ["first_name", "fname", "first", "first name"]) ?? "";
    const last = pick(r, ["last_name", "lname", "last", "last name"]) ?? "";
    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) {
      const key = k.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      if (["email", "e_mail", "email_address", "first_name", "fname", "first", "last_name", "lname", "last"].includes(key)) continue;
      if (key && v != null && String(v).trim() !== "") fields[key] = String(v).trim();
    }
    payload.push({ tenant_id: tenantId, email, first_name: first || null, last_name: last || null, fields, source });
  }
  if (payload.length) {
    // upsert in chunks to stay within request limits
    for (let i = 0; i < payload.length; i += 500) {
      await admin.from("contacts").upsert(payload.slice(i, i + 500), { onConflict: "tenant_id,email" });
    }
  }
  return { imported: payload.length, skipped };
}

// ---- Suppression ----

export async function getSuppressed(tenantId: string): Promise<Set<string>> {
  const admin = createSupabaseAdmin();
  const { data } = await admin.from("email_unsubscribes").select("email").eq("tenant_id", tenantId);
  const set = new Set<string>();
  for (const r of (data as { email: string }[] | null) ?? []) set.add(r.email.toLowerCase());
  return set;
}

// ---- Audience resolution ----

// Resolve an audience into recipients + their merge values, excluding suppressed
// emails. "agents" pulls active BuyerBridge agents and generates each one's personal
// links; "contacts" pulls the imported list with their stored fields.
export async function resolveAudience(
  tenantId: string, audience: "agents" | "contacts", origin: string,
): Promise<AudienceRecipient[]> {
  const admin = createSupabaseAdmin();
  const suppressed = await getSuppressed(tenantId);
  const out: AudienceRecipient[] = [];

  if (audience === "agents") {
    const { data } = await admin.from("agents")
      .select("name, email, firm, slug, status_token, active")
      .eq("tenant_id", tenantId).eq("active", true);
    for (const a of (data as { name: string; email: string | null; firm: string | null; slug: string; status_token: string }[] | null) ?? []) {
      if (!a.email || suppressed.has(a.email.toLowerCase())) continue;
      const first = (a.name ?? "").trim().split(/\s+/)[0] ?? "";
      out.push({
        email: a.email, firstName: first || null,
        values: {
          first_name: first,
          firm: a.firm ?? "",
          // Canonical names + short aliases that match the legacy Word mail-merge
          // fields (FNAME / Link / Portal) so Richard's existing letter drops in.
          portal_link: `${origin}/agent/${a.status_token}`,
          buyer_link: `${origin}/a/${a.slug}`,
          portal: `${origin}/agent/${a.status_token}`,
          link: `${origin}/a/${a.slug}`,
        },
      });
    }
  } else {
    const { data } = await admin.from("contacts")
      .select("email, first_name, last_name, fields")
      .eq("tenant_id", tenantId).eq("status", "active");
    for (const c of (data as { email: string; first_name: string | null; last_name: string | null; fields: Record<string, unknown> }[] | null) ?? []) {
      if (!c.email || suppressed.has(c.email.toLowerCase())) continue;
      const values: Record<string, string> = { first_name: c.first_name ?? "", last_name: c.last_name ?? "" };
      for (const [k, v] of Object.entries(c.fields ?? {})) values[k] = v == null ? "" : String(v);
      out.push({ email: c.email, firstName: c.first_name, values });
    }
  }
  return out;
}

// The tokens available for each audience, for the composer's "Insert field" menu.
// (For contacts, the page merges in any custom fields via discoverContactFields.)
export function audienceTokens(audience: "agents" | "contacts"): string[] {
  return audience === "agents"
    ? ["first_name", "firm", "link", "portal"]
    : ["first_name", "last_name"];
}

// The distinct custom merge fields present across a tenant's active contacts, so
// the composer can offer them as insertable {tokens} (e.g. city, loan_type).
export async function discoverContactFields(tenantId: string): Promise<string[]> {
  const admin = createSupabaseAdmin();
  const { data } = await admin.from("contacts").select("fields")
    .eq("tenant_id", tenantId).eq("status", "active").limit(2000);
  const keys = new Set<string>();
  for (const r of (data as { fields: Record<string, unknown> }[] | null) ?? [])
    for (const k of Object.keys(r.fields ?? {})) keys.add(k);
  return [...keys].sort();
}

// ---- Merge rendering ----

// Replace {token} and {token|fallback} with the recipient's value (or the fallback
// / empty string when missing). Unknown tokens render as their fallback/empty.
export function renderMerge(template: string, values: Record<string, string>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)(?:\|([^}]*))?\}/g, (_m, key: string, fallback?: string) => {
    const v = values[key];
    if (v == null || v === "") return fallback != null ? fallback : "";
    return v;
  });
}

// ---- Unsubscribe ----

// Process an unsubscribe click: add the recipient's email to the suppression list
// and flag the matching contact. Idempotent. Returns the email (for the confirm page).
export async function unsubscribeByToken(token: string): Promise<{ ok: boolean; email?: string }> {
  const admin = createSupabaseAdmin();
  const { data: rec } = await admin.from("broadcast_recipients")
    .select("email, tenant_id").eq("unsub_token", token).maybeSingle();
  const r = rec as { email: string; tenant_id: string } | null;
  if (!r) return { ok: false };
  await admin.from("email_unsubscribes").upsert(
    { tenant_id: r.tenant_id, email: r.email.toLowerCase(), reason: "user_unsubscribe" },
    { onConflict: "tenant_id,email" },
  );
  await admin.from("contacts").update({ status: "unsubscribed" })
    .eq("tenant_id", r.tenant_id).ilike("email", r.email);
  return { ok: true, email: r.email };
}

// ---- Sending (Stage 2) ----
//
// DORMANT BY DESIGN. Broadcasts send only when BROADCAST_FROM is set — a sender on
// a DEDICATED `news.` subdomain, deliberately separate from RESEND_FROM (the
// transactional sender) so a marketing complaint never damages the deliverability
// of the app's important transactional email (buyer estimates, LO alerts). Because
// RESEND_FROM is already live in production, we gate on BROADCAST_FROM specifically:
// until Richard sets up the news. subdomain + that env var, NOTHING here sends.

export function broadcastFrom(): string | null {
  return process.env.BROADCAST_FROM || null;
}

// Whether the bulk-send path is live (needs both the Resend key and a news. sender).
export function sendingEnabled(): boolean {
  return !!(process.env.RESEND_API_KEY && broadcastFrom());
}

export interface BroadcastFooterInfo { company: string; address: string; }

function bcEscapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

// Escape HTML, then turn any http(s) URL into a clickable link. This is what makes
// {link}/{portal} render as real buttons/links (like «Link»/«Portal» in the Word doc).
function escapeAndLink(s: string): string {
  return bcEscapeHtml(s).replace(/(https?:\/\/[^\s<]+)/g,
    (u) => `<a href="${u}" style="color:#1F3864;font-weight:600;">${u}</a>`);
}

// Compose the plain-text body (with {tokens} + blank-line paragraphs) into HTML,
// merged for one recipient, wrapped with the CAN-SPAM footer.
export function renderBroadcastHtml(bodyTemplate: string, values: Record<string, string>, footerHtml: string): string {
  const merged = renderMerge(bodyTemplate, values);
  const paras = merged.split(/\n{2,}/).map((block) =>
    `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1f2937;">${escapeAndLink(block).replace(/\n/g, "<br/>")}</p>`,
  ).join("");
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:8px;">${paras}${footerHtml}</div>`;
}

// CAN-SPAM footer: physical mailing address + one-click unsubscribe (required on
// every bulk email).
function complianceFooter(o: { company: string; address: string; unsubUrl: string }): string {
  return `
  <div style="margin-top:28px;padding-top:14px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;line-height:1.6;">
    <p style="margin:0 0 4px;">${bcEscapeHtml(o.company)} · ${bcEscapeHtml(o.address)}</p>
    <p style="margin:0;">You're receiving this because you're a contact of ${bcEscapeHtml(o.company)}.
      <a href="${bcEscapeHtml(o.unsubUrl)}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>.</p>
  </div>`;
}

async function resendBatch(from: string, items: { to: string; subject: string; html: string }[]): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY not set" };
  try {
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify(items.map((i) => ({ from, to: i.to, subject: i.subject, html: i.html }))),
    });
    if (!res.ok) return { ok: false, error: `resend ${res.status}: ${(await res.text()).slice(0, 160)}` };
    return { ok: true };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

function sampleValues(audience: "agents" | "contacts", origin: string): Record<string, string> {
  return audience === "agents"
    ? { first_name: "Alex", firm: "Keller Williams", link: `${origin}/a/sample`, portal: `${origin}/agent/sample` }
    : { first_name: "Alex", last_name: "Sample", city: "Austin" };
}

// Send ONE test email of the composed broadcast to a single address (the admin),
// using the first real recipient's merge values (or a sample if the list is empty).
// Dormant unless sending is enabled.
export async function sendBroadcastTest(opts: {
  tenantId: string; audience: "agents" | "contacts"; subject: string; body: string;
  to: string; origin: string; footer: BroadcastFooterInfo;
}): Promise<{ ok: boolean; error?: string }> {
  const from = broadcastFrom();
  if (!from) return { ok: false, error: "Sending isn't enabled yet — set BROADCAST_FROM (your news. subdomain sender) first." };
  if (!opts.to) return { ok: false, error: "No address to send the test to." };
  const recips = await resolveAudience(opts.tenantId, opts.audience, opts.origin);
  const values = recips[0]?.values ?? sampleValues(opts.audience, opts.origin);
  const footerHtml = complianceFooter({ company: opts.footer.company, address: opts.footer.address, unsubUrl: `${opts.origin}/unsubscribe/test` });
  const html = renderBroadcastHtml(opts.body, values, footerHtml);
  const subject = `[TEST] ${renderMerge(opts.subject, values)}`;
  return resendBatch(from, [{ to: opts.to, subject, html }]);
}

// Create a broadcast + its per-recipient rows, then send to the whole audience in
// batches (Resend batch endpoint, ≤100 per call). Dormant unless sending is enabled.
export async function createAndSendBroadcast(opts: {
  tenantId: string; createdBy: string; audience: "agents" | "contacts";
  subject: string; body: string; origin: string; footer: BroadcastFooterInfo;
}): Promise<{ ok: boolean; error?: string; sent?: number; total?: number; broadcastId?: string }> {
  const from = broadcastFrom();
  if (!from) return { ok: false, error: "Sending isn't enabled yet — set BROADCAST_FROM (your news. subdomain sender) first." };
  const admin = createSupabaseAdmin();
  const recips = await resolveAudience(opts.tenantId, opts.audience, opts.origin);
  if (!recips.length) return { ok: false, error: "No active recipients in this audience (after removing unsubscribes)." };

  const { data: bRow, error: bErr } = await admin.from("broadcasts").insert({
    tenant_id: opts.tenantId, created_by: opts.createdBy, audience: opts.audience,
    subject: opts.subject, body_html: opts.body, status: "sending", total: recips.length,
  }).select("id").single();
  if (bErr || !bRow) return { ok: false, error: bErr?.message ?? "Could not create the broadcast." };
  const broadcastId = (bRow as { id: string }).id;

  // Pre-create recipient rows; each row's default generates its unsubscribe token.
  // Store emails lower-cased so status updates (matched by `.in`) line up regardless
  // of the source casing (agent emails aren't normalized on entry).
  const { data: inserted } = await admin.from("broadcast_recipients")
    .insert(recips.map((r) => ({ broadcast_id: broadcastId, tenant_id: opts.tenantId, email: r.email.toLowerCase(), first_name: r.firstName, status: "queued" })))
    .select("email, unsub_token");
  const tokenByEmail = new Map<string, string>();
  for (const r of (inserted as { email: string; unsub_token: string }[] | null) ?? [])
    tokenByEmail.set(r.email.toLowerCase(), r.unsub_token);

  // Build every personalized message, then send in chunks of 100.
  const messages = recips.map((r) => {
    const token = tokenByEmail.get(r.email.toLowerCase()) ?? "";
    const footerHtml = complianceFooter({ company: opts.footer.company, address: opts.footer.address, unsubUrl: `${opts.origin}/unsubscribe/${token}` });
    return { email: r.email, to: r.email, subject: renderMerge(opts.subject, r.values), html: renderBroadcastHtml(opts.body, r.values, footerHtml) };
  });

  let sent = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const res = await resendBatch(from, chunk);
    const emails = chunk.map((c) => c.email.toLowerCase());
    await admin.from("broadcast_recipients")
      .update({ status: res.ok ? "sent" : "failed", error: res.ok ? null : (res.error ?? "send failed"), sent_at: new Date().toISOString() })
      .eq("broadcast_id", broadcastId).in("email", emails);
    if (res.ok) sent += chunk.length;
  }

  await admin.from("broadcasts")
    .update({ status: sent > 0 ? "sent" : "failed", sent_count: sent, sent_at: new Date().toISOString() })
    .eq("id", broadcastId);
  return { ok: true, sent, total: recips.length, broadcastId };
}

// Past broadcasts for the tenant (for the composer's history panel).
export interface BroadcastSummary {
  id: string; audience: string; subject: string; status: string;
  total: number; sent_count: number; created_at: string; sent_at: string | null;
}
export async function listBroadcasts(tenantId: string): Promise<BroadcastSummary[]> {
  const admin = createSupabaseAdmin();
  const { data } = await admin.from("broadcasts")
    .select("id, audience, subject, status, total, sent_count, created_at, sent_at")
    .eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50);
  return (data as BroadcastSummary[] | null) ?? [];
}
