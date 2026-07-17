import { NextResponse } from "next/server";
import { getAgentByStatusToken, createAgentInvite, getTenantIdentity } from "@/lib/shareLinks";
import { isAgentOwnerActive } from "@/lib/agents";
import { getResolvedLOForLead } from "@/lib/loanOfficer";
import { sendBuyerInviteEmail } from "@/lib/email";
import { siteOrigin } from "@/lib/site";

// Agent invites a buyer: creates an agent_invite share link and emails the buyer
// the agent's estimate link carrying the share token. Auth is the status_token in
// the URL (the no-login agent-portal credential); a revoked seat can't invite.
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const agent = await getAgentByStatusToken(params.token);
  const ownerActive = agent ? await isAgentOwnerActive(agent.id) : false;
  if (!agent || !agent.active || !ownerActive) {
    return NextResponse.json({ error: "This link isn’t active" }, { status: 403 });
  }

  let body: { name?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const email = (body.email ?? "").trim();
  const name = (body.name ?? "").trim() || null;
  if (!email || !/.+@.+\..+/.test(email)) {
    return NextResponse.json({ error: "A valid buyer email is required" }, { status: 422 });
  }

  const share = await createAgentInvite({
    tenantId: agent.tenant_id,
    agentId: agent.id,
    loId: agent.lo_id,
    recipientName: name,
    recipientEmail: email,
  });
  if (!share) return NextResponse.json({ error: "Could not create the invite" }, { status: 500 });

  // The buyer opens the agent's estimate link with the share token so the lead
  // links back to this invite (share_links.lead_id) on conversion.
  const origin = siteOrigin(new URL(req.url).origin);
  const link = `${origin}/a/${agent.slug}?st=${share.token}`;

  const lo = await getResolvedLOForLead(agent.tenant_id, agent.id);
  const ident = await getTenantIdentity(agent.tenant_id);

  const r = await sendBuyerInviteEmail({
    to: email,
    buyerName: name,
    agentName: agent.name,
    loName: lo?.full_name ?? "your loan officer",
    loNmls: lo?.nmls ?? null,
    companyName: ident.companyName,
    companyNmls: ident.companyNmls,
    link,
  });
  return NextResponse.json({ ok: true, emailed: r.sent, reason: r.reason ?? null, shareId: share.id, link });
}
