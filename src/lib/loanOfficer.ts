import { createSupabaseAdmin } from "@/lib/supabase/admin";

export interface ResolvedLO {
  id: string;
  full_name: string | null;
  email: string | null;
  nmls: string | null;
}

// Resolve which loan officer a buyer on this tenant should be routed to.
//
// Phase II "default" strategy: the primary active LO; falls back to the oldest
// active LO/admin when no primary is flagged (covers single-LO / broker-and-LO
// shops like R Parry, where the one admin IS the loan officer). Returns null only
// when the tenant has no LO/admin records at all — the caller then falls back to
// the tenant's lo_name display string, so Phase 1A behavior is preserved.
//
// Uses the service-role client because RLS on app_users is auth-scoped and this
// runs from the public (anon) lead route. Read-only.
export async function getResolvedLO(tenantId: string): Promise<ResolvedLO | null> {
  try {
    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("app_users")
      .select("id, full_name, email, nmls, role, is_primary, created_at")
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .in("role", ["lo", "admin"])
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1);
    if (error) {
      console.error(`[loanOfficer] resolve failed for tenant=${tenantId}:`, error.message);
      return null;
    }
    const row = data?.[0];
    if (!row) return null;
    return {
      id: row.id,
      full_name: row.full_name ?? null,
      email: row.email ?? null,
      nmls: row.nmls ?? null,
    };
  } catch (e) {
    console.error(`[loanOfficer] resolve error for tenant=${tenantId}:`, (e as Error).message);
    return null;
  }
}
