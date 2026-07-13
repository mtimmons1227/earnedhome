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

  let body: { name?: string; email?: string | null; phone?: string | null; active?: boolean; loId?: string; moveOpenLeads?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (body.email !== undefined) patch.email = body.email?.toString().trim() || null;
  if (body.phone !== undefined) patch.phone = body.phone?.toString().trim() || null;
  if (typeof body.active === "boolean") patch.active = body.active;

  // Reassign the owning loan officer (broker-admin only). Buyers who use this
  // agent's link from now on route to the new LO. Past leads keep their LO unless
  // moveOpenLeads is set, in which case the agent's OPEN (active) leads move too;
  // closed/lost leads always stay put as the original LO's record.
  if (body.loId !== undefined) {
    if (gate.role !== "admin") {
      return NextResponse.json({ error: "Only a broker admin can reassign an agent's loan officer" }, { status: 403 });
    }
    const { data: targetLo } = await admin
      .from("app_users").select("id, active, role").eq("id", body.loId).eq("tenant_id", gate.tenantId).maybeSingle();
    if (!targetLo || (targetLo.role !== "lo" && targetLo.role !== "admin")) {
      return NextResponse.json({ error: "Pick a valid loan officer" }, { status: 400 });
    }
    if (targetLo.active === false) {
      return NextResponse.json({ error: "That loan officer is turned off — turn them on first" }, { status: 400 });
    }
    patch.lo_id = body.loId;
  }

  const { data, error } = await admin
    .from("agents")
    .update(patch)
    .eq("id", params.id)
    .eq("tenant_id", gate.tenantId)
    .select("id, name, email, phone, slug, active, lo_id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Optionally move the agent's OPEN leads to the new LO (closed/lost stay).
  let movedLeads = 0;
  if (body.loId && body.moveOpenLeads) {
    const { data: moved } = await admin
      .from("leads")
      .update({ assigned_lo_id: body.loId })
      .eq("agent_id", params.id)
      .eq("tenant_id", gate.tenantId)
      .in("status", ["new", "contacted", "working"])
      .select("id");
    movedLeads = moved?.length ?? 0;
  }

  return NextResponse.json({ agent: data, movedLeads });
}
