import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Gate for admin-only endpoints (the workbook swap tool — it can replace the
 * live pricing engine, so it's restricted to `admin`, not regular `lo` users).
 * Returns ok:true with the user when the signed-in account is an `admin`;
 * otherwise an ok:false result with the right HTTP status.
 */
export async function requireWorkbookAdmin(): Promise<
  | { ok: true; userId: string; role: string }
  | { ok: false; status: 401 | 403; error: string }
> {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "Not signed in" };

  const { data: appUser } = await supabase
    .from("app_users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!appUser || appUser.role !== "admin") {
    return { ok: false, status: 403, error: "Not authorized" };
  }
  return { ok: true, userId: user.id, role: appUser.role };
}

/**
 * Gate for tenant-operator endpoints (managing the LO's own agents/settings).
 * Allows `admin` or `lo` and returns the caller's `tenantId` so writes can be
 * scoped to their tenant. `staff` and anon are rejected.
 */
export async function requireTenantAdmin(): Promise<
  | { ok: true; userId: string; role: string; tenantId: string }
  | { ok: false; status: 401 | 403; error: string }
> {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "Not signed in" };

  const { data: appUser } = await supabase
    .from("app_users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!appUser || (appUser.role !== "admin" && appUser.role !== "lo")) {
    return { ok: false, status: 403, error: "Not authorized" };
  }
  return { ok: true, userId: user.id, role: appUser.role, tenantId: appUser.tenant_id };
}
