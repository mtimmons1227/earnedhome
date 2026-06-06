import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

const STATUSES = ["new", "contacted", "working", "closed", "lost"] as const;
type Status = (typeof STATUSES)[number];

export async function POST(req: Request) {
  let body: { leadId?: string; status?: string; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { leadId, status, notes } = body;
  if (!leadId) return NextResponse.json({ error: "Missing leadId" }, { status: 400 });
  if (status !== undefined && !STATUSES.includes(status as Status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const patch: Record<string, unknown> = {};
  if (status !== undefined) patch.status = status;
  if (notes !== undefined) patch.notes = notes;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  // RLS (leads_member_update) confines this to the LO's own tenant.
  const { error } = await supabase.from("leads").update(patch).eq("id", leadId);
  if (error) return NextResponse.json({ error: "Update failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
