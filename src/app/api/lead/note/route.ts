import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

// POST — append a timestamped, attributed note to a lead.
// Notes are stored as append-only `lead_note` events, so history is never
// overwritten. The author is the signed-in user (captured server-side).
export async function POST(req: Request) {
  let body: { leadId?: string; body?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const leadId = body.leadId;
  const text = (body.body ?? "").trim();
  if (!leadId) return NextResponse.json({ error: "Missing leadId" }, { status: 400 });
  if (!text) return NextResponse.json({ error: "Note is empty" }, { status: 400 });

  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: appUser } = await supabase
    .from("app_users")
    .select("tenant_id, full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (!appUser) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  // RLS (leads_member_read) confirms the lead is in the signed-in user's tenant.
  const { data: lead } = await supabase
    .from("leads")
    .select("id, tenant_id")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const authorName = appUser.full_name ?? user.email ?? "Unknown";

  // Insert via the authenticated client — the events_public_insert RLS policy
  // allows it (same path lead-capture uses), so no service-role key is needed.
  const { data: inserted, error } = await supabase
    .from("events")
    .insert({
      tenant_id: lead.tenant_id,
      type: "lead_note",
      payload: { leadId, authorId: user.id, authorName, body: text },
    })
    .select("created_at")
    .single();

  if (error || !inserted) {
    return NextResponse.json({ error: error?.message ?? "Could not save note" }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    note: { authorName, body: text, created_at: inserted.created_at },
  });
}
