import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { pickLO, type LORow, type ResolvedLO } from "@/lib/loSelect";

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
