import { NextResponse } from "next/server";
import { requireTenantAdmin } from "@/lib/auth-admin";
import { importContacts } from "@/lib/broadcast";

export const dynamic = "force-dynamic";

// POST — bulk import contacts from a parsed spreadsheet.
// Body: { rows: Record<string,string>[], source?: string }
// The client parses the CSV/Excel and sends rows (header -> value); we map email /
// first / last and stash the rest as merge fields, de-duping on (tenant, email).
export async function POST(req: Request) {
  const gate = await requireTenantAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (gate.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  let body: { rows?: Record<string, string>[]; source?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) return NextResponse.json({ error: "No rows to import" }, { status: 422 });
  if (rows.length > 20000) return NextResponse.json({ error: "Too many rows (max 20,000 per import)" }, { status: 422 });

  const source = body.source?.trim() || `import ${new Date().toISOString().slice(0, 10)}`;
  const { imported, skipped } = await importContacts(gate.tenantId, rows, source);
  return NextResponse.json({ imported, skipped });
}
