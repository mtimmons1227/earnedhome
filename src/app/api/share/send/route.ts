import { NextResponse } from "next/server";
import { getActiveShareByToken } from "@/lib/shareLinks";
import { getResolvedLOForLead } from "@/lib/loanOfficer";
import { sendReferralToFriendEmail } from "@/lib/email";
import { siteOrigin } from "@/lib/site";

// Buyer-initiated: the buyer entered a friend's email on the /share page. We send
// that friend the /r estimate link (the same referral token — anyone who runs it
// inherits the referrer's agent + LO). Buyer-driven single referral; the friend
// can forward it onward and any completion still routes up the same chain.
export async function POST(req: Request) {
  let body: { token?: string; name?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const token = (body.token ?? "").trim();
  const email = (body.email ?? "").trim();
  const name = (body.name ?? "").trim() || null;
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 422 });
  if (!email || !/.+@.+\..+/.test(email)) {
    return NextResponse.json({ error: "A valid friend email is required" }, { status: 422 });
  }

  const share = await getActiveShareByToken(token);
  if (!share || share.kind !== "buyer_referral") {
    return NextResponse.json({ error: "This share link isn’t active" }, { status: 403 });
  }

  const origin = siteOrigin(new URL(req.url).origin);
  const link = `${origin}/r/${share.token}`;
  const lo = await getResolvedLOForLead(share.tenant_id, share.agent_id);
  const loName = lo?.full_name ?? "a loan officer";

  const r = await sendReferralToFriendEmail({ to: email, friendName: name, loName, link });
  return NextResponse.json({ ok: true, emailed: r.sent, reason: r.reason ?? null });
}
