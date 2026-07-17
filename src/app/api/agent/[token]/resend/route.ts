import { NextResponse } from "next/server";
import { getAgentByStatusToken, getShareForAgent } from "@/lib/shareLinks";
import { isAgentOwnerActive } from "@/lib/agents";
import { getResolvedLOForLead } from "@/lib/loanOfficer";
import { sendBuyerInviteEmail } from "@/lib/email";
import { siteOrigin } from "@/lib/site";

// Re-send a buyer their invite link (the same link the agent originally sent).
// Scoped to the agent (getShareForAgent checks agent_id). Only works for invites
// that have a recipient email on file.
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const agent = await getAgentByStatusToken(params.token);
  const ownerActive = agent ? await isAgentOwnerActive(agent.id) : false;
  if (!agent || !agent.active || !ownerActive) {
    return NextResponse.json({ error: "This link isn’t active" }, { status: 403 });
  }

  let body: { shareId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.shareId) return NextResponse.json({ error: "Missing shareId" }, { status: 422 });

  const share = await getShareForAgent(body.shareId, agent.id);
  if (!share) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!share.recipient_email) {
    return NextResponse.json({ error: "No email on file for this buyer" }, { status: 422 });
  }

  const origin = siteOrigin(new URL(req.url).origin);
  const link = `${origin}/a/${agent.slug}?st=${share.token}`;
  const lo = await getResolvedLOForLead(agent.tenant_id, agent.id);
  const loName = lo?.full_name ?? "your loan officer";

  const r = await sendBuyerInviteEmail({
    to: share.recipient_email,
    buyerName: share.recipient_name,
    agentName: agent.name,
    loName,
    link,
  });
  return NextResponse.json({ ok: true, emailed: r.sent, reason: r.reason ?? null });
}
