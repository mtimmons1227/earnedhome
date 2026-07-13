import { createSupabaseAdmin } from "@/lib/supabase/admin";

// URL-safe slug from an agent's name (used in /a/<slug>). Uniqueness within a
// tenant is enforced when the agent is created.
export function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s || "agent";
}

export interface AgentRow {
  id: string;
  tenant_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  slug: string;
  active: boolean;
}

// Resolve an agent by tenant + slug for the public /a/<slug> link (service role
// — RLS on agents is server-only). Returns the agent REGARDLESS of active state
// (the `active` flag is included) so the page can tell a revoked seat apart from
// an unknown slug. Returns null only when no agent has that slug.
export async function getAgentBySlug(
  tenantId: string,
  slug: string,
): Promise<AgentRow | null> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("agents")
    .select("id, tenant_id, name, email, phone, slug, active")
    .eq("tenant_id", tenantId)
    .eq("slug", slug)
    .maybeSingle();
  return (data as AgentRow | null) ?? null;
}

// Whether the agent's owning loan officer is still active. Turning an LO off is a
// full deactivation: their agents' buyer links + status portals are revoked too.
// Returns true when the agent has no owning LO on record (nothing to gate on).
export async function isAgentOwnerActive(agentId: string): Promise<boolean> {
  const admin = createSupabaseAdmin();
  const { data: a } = await admin.from("agents").select("lo_id").eq("id", agentId).maybeSingle();
  const loId = (a as { lo_id?: string | null } | null)?.lo_id ?? null;
  if (!loId) return true;
  const { data: lo } = await admin.from("app_users").select("active").eq("id", loId).maybeSingle();
  return (lo as { active?: boolean } | null)?.active !== false;
}
