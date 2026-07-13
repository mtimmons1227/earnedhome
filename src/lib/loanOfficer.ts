import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { pickLO, preferAgentLO, type LORow, type ResolvedLO } from "@/lib/loSelect";

export type { ResolvedLO };

// Resolve which loan officer a buyer on this tenant should be routed to.
//
// Fetches the tenant's user rows (service-role — RLS on app_users is auth-scoped
// and this runs from the public/anon lead route), then applies the pure pickLO
// selection rule. Returns null only when the tenant has no eligible LO/admin — the
// caller then falls back to the tenant's lo_name string, so Phase 1A behavior is
// preserved. Read-only.
export async function getResolvedLO(tenantId: string): Promise<ResolvedLO | null> {
  try {
    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("app_users")
      .select("id, full_name, email, nmls, role, is_primary, active, created_at")
      .eq("tenant_id", tenantId);
    if (error) {
      console.error(`[loanOfficer] resolve failed for tenant=${tenantId}:`, error.message);
      return null;
    }
    return pickLO((data ?? []) as LORow[]);
  } catch (e) {
    console.error(`[loanOfficer] resolve error for tenant=${tenantId}:`, (e as Error).message);
    return null;
  }
}

// Resolve the LO for a lead, honoring agent → LO attribution: if the buyer came
// through an agent link and that agent is tied to an ACTIVE LO, route to that LO;
// otherwise fall back to the tenant's default (primary) LO. Service-role reads.
export async function getResolvedLOForLead(
  tenantId: string,
  agentId?: string | null,
): Promise<ResolvedLO | null> {
  const tenantDefault = await getResolvedLO(tenantId);
  if (!agentId) return tenantDefault;
  try {
    const admin = createSupabaseAdmin();
    const { data: agent } = await admin
      .from("agents")
      .select("lo_id")
      .eq("id", agentId)
      .maybeSingle();
    const loId = (agent as { lo_id?: string | null } | null)?.lo_id ?? null;
    if (!loId) return tenantDefault;
    const { data: lo } = await admin
      .from("app_users")
      .select("id, full_name, email, nmls, active")
      .eq("id", loId)
      .maybeSingle();
    const row = lo as
      | { id: string; full_name: string | null; email: string | null; nmls: string | null; active: boolean }
      | null;
    const agentLO =
      row && row.active
        ? { id: row.id, full_name: row.full_name ?? null, email: row.email ?? null, nmls: row.nmls ?? null }
        : null;
    return preferAgentLO(agentLO, tenantDefault);
  } catch (e) {
    console.error(`[loanOfficer] agent LO resolve error for agent=${agentId}:`, (e as Error).message);
    return tenantDefault;
  }
}
