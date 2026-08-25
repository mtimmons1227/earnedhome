import { NextResponse } from "next/server";
import { requireTenantAdmin } from "@/lib/auth-admin";
import { listContacts, addContact, countActiveContacts } from "@/lib/broadcast";

export const dynamic = "force-dynamic";

// GET — the tenant's imported contacts (+ active count). Broadcasts are a broker
// tool, so this is admin-only.
export async function GET(req: Request) {
  const gate = await requireTenantAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (gate.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const search = new URL(req.url).searchParams.get("q") ?? undefined;
  const [contacts, active] = await Promise.all([
    listContacts(gate.tenantId, search),
    countActiveContacts(gate.tenantId),
  ]);
  return NextResponse.json({ contacts, active });
}

// POST — add a single contact { email, first_name?, last_name? }.
export async function POST(req: Request) {
  const gate = await requireTenantAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (gate.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  let body: { email?: string; first_name?: string; last_name?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const res = await addContact(gate.tenantId, { email: body.email ?? "", first_name: body.first_name, last_name: body.last_name });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 422 });
  return NextResponse.json({ ok: true });
}
