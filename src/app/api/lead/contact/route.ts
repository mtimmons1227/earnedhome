import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// POST — a buyer corrects the contact info on THEIR OWN lead, right after
// connecting. Authorized by possession of the lead's random UUID (returned to
// them on submit) — a capability token. Only contact fields can change; nothing
// else is touched. Uses the service-role client because anon has no UPDATE on
// leads under RLS.
export async function POST(req: Request) {
  let body: { leadId?: string; fullName?: string | null; email?: string | null; phone?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const leadId = (body.leadId ?? "").trim();
  // Basic UUID shape check so a random string can't scan the table.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(leadId)) {
    return NextResponse.json({ error: "Invalid lead id" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.fullName !== undefined) patch.full_name = body.fullName?.toString().trim() || null;
  if (body.email !== undefined) patch.email = body.email?.toString().trim() || null;
  if (body.phone !== undefined) patch.phone = body.phone?.toString().trim() || null;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("leads")
    .update(patch)
    .eq("id", leadId)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Could not update" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
