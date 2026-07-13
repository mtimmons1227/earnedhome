import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// POST target for the buyer's consent page. Sets agent_status_consent from the
// buyer's choice, stamps when/how, and logs a consent_changed event (audit
// trail). Token-scoped: only ever touches the one lead the private token
// identifies. Public — the token is the credential (like the agent portal).
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const { origin } = new URL(req.url);
  const form = await req.formData();
  const value = String(form.get("value") ?? "");
  const to = value === "on";
  const fail = NextResponse.redirect(`${origin}/consent/${params.token}`, { status: 303 });
  if (value !== "on" && value !== "off") return fail;

  const admin = createSupabaseAdmin();
  const { data: lead } = await admin
    .from("leads")
    .select("id, tenant_id, agent_id, agent_status_consent")
    .eq("consent_token", params.token)
    .maybeSingle();
  if (!lead) return fail;

  const { error } = await admin
    .from("leads")
    .update({
      agent_status_consent: to,
      agent_status_consent_at: new Date().toISOString(),
      agent_status_consent_source: "buyer_link",
    })
    .eq("id", lead.id);
  if (error) return fail;

  // Append-only audit record of the change.
  try {
    await admin.from("events").insert({
      tenant_id: lead.tenant_id,
      type: "consent_changed",
      payload: {
        leadId: lead.id,
        agentId: lead.agent_id,
        from: !!lead.agent_status_consent,
        to,
        source: "buyer_link",
        at: new Date().toISOString(),
      },
    });
  } catch {
    /* best-effort */
  }

  return NextResponse.redirect(`${origin}/consent/${params.token}?done=${to ? "on" : "off"}`, { status: 303 });
}
