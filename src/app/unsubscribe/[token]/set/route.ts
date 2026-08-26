import { NextResponse } from "next/server";
import { unsubscribeByToken } from "@/lib/broadcast";

export const dynamic = "force-dynamic";

// Processes the unsubscribe: adds the email to the suppression list and flags the
// contact. Idempotent and safe for unknown/test tokens (no-op). Then redirects back
// to the confirmation page.
export async function POST(req: Request, { params }: { params: { token: string } }) {
  await unsubscribeByToken(params.token);
  const origin = new URL(req.url).origin;
  return NextResponse.redirect(new URL(`/unsubscribe/${encodeURIComponent(params.token)}?done=1`, origin), { status: 303 });
}
