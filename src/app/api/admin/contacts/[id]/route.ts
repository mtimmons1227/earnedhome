import { NextResponse } from "next/server";
import { requireTenantAdmin } from "@/lib/auth-admin";
import { deleteContact } from "@/lib/broadcast";

export const dynamic = "force-dynamic";

// DELETE — remove a contact from the list (scoped to the caller's tenant).
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const gate = await requireTenantAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (gate.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const ok = await deleteContact(gate.tenantId, params.id);
  return NextResponse.json({ ok });
}
