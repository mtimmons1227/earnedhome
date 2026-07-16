import { NextResponse } from "next/server";
import { getAgentByStatusToken, setShareActiveForAgent } from "@/lib/shareLinks";

// Agent disables one of THEIR buyer links (soft: share_links.active=false). The
// scope check in disableShareLinkForAgent (eq agent_id) means an agent can only
// switch off their own links, never another agent's. The lead is untouched.
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const agent = await getAgentByStatusToken(params.token);
  if (!agent || !agent.active) {
    return NextResponse.json({ error: "This link isn’t active" }, { status: 403 });
  }

  let body: { shareId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.shareId) return NextResponse.json({ error: "Missing shareId" }, { status: 422 });

  const ok = await setShareActiveForAgent(body.shareId, agent.id, false);
  if (!ok) return NextResponse.json({ error: "Could not disable that link" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
