import { NextResponse } from "next/server";
import { requireTenantAdmin } from "@/lib/auth-admin";
import { resolveAudience } from "@/lib/broadcast";

export const dynamic = "force-dynamic";

// GET ?audience=agents|contacts — real recipients (name + their resolved merge
// values, including live links) so the composer can preview with an actual person
// instead of placeholder "sample" values. Admin-only.
export async function GET(req: Request) {
  const gate = await requireTenantAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (gate.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const url = new URL(req.url);
  const audience = url.searchParams.get("audience") === "contacts" ? "contacts" : "agents";
  const recips = await resolveAudience(gate.tenantId, audience, url.origin);
  const recipients = recips.slice(0, 50).map((r) => ({
    label: r.firstName || r.email,
    email: r.email,
    values: r.values,
  }));
  return NextResponse.json({ recipients });
}
