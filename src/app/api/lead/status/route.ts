import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

const STATUSES = ["new", "contacted", "working", "closed", "lost"] as const;
type Status = (typeof STATUSES)[number];

export async function POST(req: Request) {
  let body: { leadId?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { leadId, status } = body;
  if (!leadId || !status || !STATUSES.includes(status as Status)) {
    return NextResponse.json({ error: "Missing or invalid leadId/status" }, { status: 400 });
  }

  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // RLS (leads_member_update) ensures the LO can only update leads in their tenant.
  const { error } = await supabase
    .from("leads")
    .update({ status: status as Status })
    .eq("id", leadId);
  if (error) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
