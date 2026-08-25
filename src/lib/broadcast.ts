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
          portal_link: `${origin}/agent/${a.status_token}`,
          buyer_link: `${origin}/a/${a.slug}`,
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
export function audienceTokens(audience: "agents" | "contacts"): string[] {
  return audience === "agents"
    ? ["first_name", "firm", "portal_link", "buyer_link"]
    : ["first_name", "last_name"];
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
