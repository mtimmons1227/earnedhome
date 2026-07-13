import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendBuyerConsentRequest } from "@/lib/email";
import { isAgentOwnerActive } from "@/lib/agents";
import { siteOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";

// POST — the agent's "Request access" button. Sends the buyer their consent email
// so the buyer can choose to share loan status. Scoped to the agent's status token
// (the credential) and to that agent's own leads. The agent never sees the buyer's
// consent link — only triggers the send — so the buyer stays the one who grants.
export async function POST(req: Request, { params }: { params: { token: string } }) {
  let body: { leadId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const leadId = body.leadId;
  if (!leadId) return NextResponse.json({ error: "Missing leadId" }, { status: 400 });

  const admin = createSupabaseAdmin();

  // Validate the agent by their status token (and that their owning LO is active).
  const { data: agent } = await admin
    .from("agents").select("id, name, active, tenant_id").eq("status_token", params.token).maybeSingle();
  if (!agent || !agent.active) return NextResponse.json({ error: "Link not active" }, { status: 403 });
  if (!(await isAgentOwnerActive(agent.id))) return NextResponse.json({ error: "Link not active" }, { status: 403 });

  // The lead must belong to this agent.
  const { data: lead } = await admin
    .from("leads")
    .select("id, full_name, email, agent_id, agent_status_consent, consent_token, tenant_id")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead || lead.agent_id !== agent.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (lead.agent_status_consent) return NextResponse.json({ error: "Already sharing" }, { status: 409 });
  if (!lead.email) return NextResponse.json({ error: "No buyer email on file" }, { status: 422 });

  const origin = siteOrigin(new URL(req.url).origin);
  const { data: tenant } = await admin.from("tenants").select("lo_name").eq("id", lead.tenant_id).maybeSingle();

  const r = await sendBuyerConsentRequest({
    to: lead.email,
    buyerName: lead.full_name,
    agentName: agent.name,
    companyName: (tenant?.lo_name as string | null) ?? null,
    link: `${origin}/consent/${lead.consent_token}`,
  });
  if (!r.sent) return NextResponse.json({ error: r.reason ?? "Could not send" }, { status: 502 });

  // Audit: record the agent-initiated request.
  try {
    await admin.from("events").insert({
      tenant_id: lead.tenant_id,
      type: "consent_requested",
      payload: { leadId: lead.id, agentId: agent.id, at: new Date().toISOString() },
    });
  } catch {
    /* best-effort */
  }

  return NextResponse.json({ ok: true });
}
