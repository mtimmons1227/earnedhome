import { NextResponse } from "next/server";
import { requireTenantAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// PATCH — edit an LO: name / email / nmls / active / is_primary. Admin-only.
// Setting is_primary=true first clears the flag on the tenant's other LOs so
// there is exactly one primary. Scoped to the caller's tenant.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireTenantAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (gate.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  let body: { fullName?: string; email?: string; nmls?: string | null; active?: boolean; isPrimary?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  // Confirm the target LO is in the caller's tenant before mutating.
  const { data: target } = await admin
    .from("app_users")
    .select("id, tenant_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!target || target.tenant_id !== gate.tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.fullName === "string") patch.full_name = body.fullName.trim();
  if (typeof body.email === "string") patch.email = body.email.trim().toLowerCase();
  if (body.nmls !== undefined) patch.nmls = (body.nmls ?? "")?.toString().trim() || null;
  if (typeof body.active === "boolean") patch.active = body.active;
  if (typeof body.isPrimary === "boolean") patch.is_primary = body.isPrimary;

  // Enforce one primary per tenant.
  if (body.isPrimary === true) {
    await admin.from("app_users").update({ is_primary: false }).eq("tenant_id", gate.tenantId);
  }

  const { data, error } = await admin
    .from("app_users")
    .update(patch)
    .eq("id", params.id)
    .select("id, full_name, email, nmls, role, is_primary, active, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lo: data });
}
