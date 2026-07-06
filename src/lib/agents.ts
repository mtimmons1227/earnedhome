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

// Resolve an ACTIVE agent by tenant + slug for the public /a/<slug> link
// (service role — RLS on agents is server-only). Returns null if not found or
// deactivated (a revoked seat's link stops resolving).
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
    .eq("active", true)
    .maybeSingle();
  return (data as AgentRow | null) ?? null;
}
