import { NextResponse } from "next/server";
import { requireTenantAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// PATCH — update an agent (name / email / phone / active). Setting active:false
// is the "revoke seat" action — the agent's /a/<slug> link stops resolving.
// Scoped to the caller's tenant so no one can touch another tenant's agents.
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const gate = await requireTenantAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  let body: { name?: string; email?: string | null; phone?: string | null; active?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (body.email !== undefined) patch.email = body.email?.toString().trim() || null;
  if (body.phone !== undefined) patch.phone = body.phone?.toString().trim() || null;
  if (typeof body.active === "boolean") patch.active = body.active;

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("agents")
    .update(patch)
    .eq("id", params.id)
    .eq("tenant_id", gate.tenantId)
    .select("id, name, email, phone, slug, active")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ agent: data });
}
