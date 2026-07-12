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

  let body: { fullName?: string; email?: string; nmls?: string | null; phone?: string | null; active?: boolean; isPrimary?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  // Confirm the target LO is in the caller's tenant before mutating.
  const { data: target } = await admin
    .from("app_users")
    .select("id, tenant_id, email, role, active")
    .eq("id", params.id)
    .maybeSingle();
  if (!target || target.tenant_id !== gate.tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Lockout guard: turning off a user now blocks their dashboard access, so never
  // let the tenant turn off its LAST active admin (no one could get back in).
  if (body.active === false && target.role === "admin" && target.active) {
    const { count } = await admin
      .from("app_users")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", gate.tenantId)
      .eq("role", "admin")
      .eq("active", true);
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "You can't turn off the last active broker admin." },
        { status: 409 },
      );
    }
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.fullName === "string") patch.full_name = body.fullName.trim();
  const newEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined;
  if (newEmail !== undefined) patch.email = newEmail;
  if (body.nmls !== undefined) patch.nmls = (body.nmls ?? "")?.toString().trim() || null;
  if (body.phone !== undefined) patch.phone = (body.phone ?? "")?.toString().trim() || null;
  if (typeof body.active === "boolean") patch.active = body.active;
  if (typeof body.isPrimary === "boolean") patch.is_primary = body.isPrimary;

  // Keep the auth login email in sync with the record. Without this the record
  // shows the new address but the sign-in link (a recovery link keyed on the
  // auth email) targets the OLD address — Supabase returns "user not found" and
  // no email is ever sent.
  if (newEmail !== undefined && newEmail !== target.email) {
    const { error: authErr } = await admin.auth.admin.updateUserById(params.id, {
      email: newEmail,
      email_confirm: true,
    });
    if (authErr) {
      return NextResponse.json(
        { error: `Could not update the login email: ${authErr.message}` },
        { status: 500 },
      );
    }
  }

  // Enforce one primary per tenant.
  if (body.isPrimary === true) {
    await admin.from("app_users").update({ is_primary: false }).eq("tenant_id", gate.tenantId);
  }

  const { data, error } = await admin
    .from("app_users")
    .update(patch)
    .eq("id", params.id)
    .select("id, full_name, email, nmls, phone, role, is_primary, active, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lo: data });
}
