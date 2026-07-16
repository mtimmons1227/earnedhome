import { NextResponse } from "next/server";
import { getAgentByStatusToken, setShareActiveForAgent } from "@/lib/shareLinks";

// Agent toggles one of THEIR buyer links on or off (share_links.active). Scoped
// to the agent (setShareActiveForAgent checks agent_id) so an agent can only
// touch their own links. The lead is never changed — only the link's on/off state.
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const agent = await getAgentByStatusToken(params.token);
  if (!agent || !agent.active) {
    return NextResponse.json({ error: "This link isn’t active" }, { status: 403 });
  }

  let body: { shareId?: string; active?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.shareId || typeof body.active !== "boolean") {
    return NextResponse.json({ error: "Missing shareId or active" }, { status: 422 });
  }

  const ok = await setShareActiveForAgent(body.shareId, agent.id, body.active);
  if (!ok) return NextResponse.json({ error: "Could not update that link" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
