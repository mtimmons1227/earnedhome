import { NextResponse } from "next/server";
import { createBuyerReferral } from "@/lib/shareLinks";
import { siteOrigin } from "@/lib/site";

// Flow B: a buyer creates their own "share with a friend" link from their lead.
// Returns a /r/<token> URL the buyer sends themselves (buyer-initiated — no cold
// emailing of the friend). The friend becomes a lead only when they run numbers.
export async function POST(req: Request) {
  let body: { referrerLeadId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const referrerLeadId = (body.referrerLeadId ?? "").trim();
  if (!referrerLeadId) return NextResponse.json({ error: "Missing referrerLeadId" }, { status: 422 });

  const share = await createBuyerReferral(referrerLeadId);
  if (!share) return NextResponse.json({ error: "Could not create a share link" }, { status: 500 });

  const origin = siteOrigin(new URL(req.url).origin);
  return NextResponse.json({ ok: true, link: `${origin}/r/${share.token}` });
}
