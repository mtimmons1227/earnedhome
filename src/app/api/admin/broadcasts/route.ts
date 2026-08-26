import { NextResponse } from "next/server";
import { requireTenantAdmin } from "@/lib/auth-admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendBroadcastTest, createAndSendBroadcast, sendingEnabled } from "@/lib/broadcast";

export const dynamic = "force-dynamic";

// CAN-SPAM physical address for the footer. Defaults to R Parry's (from the current
// mail-merge letter); override per environment with BROADCAST_ADDRESS.
const DEFAULT_ADDRESS = "PO Box 100184, Fort Worth, TX 76185-0184";

async function footerInfo(tenantId: string): Promise<{ company: string; address: string }> {
  const admin = createSupabaseAdmin();
  const { data } = await admin.from("tenants").select("name").eq("id", tenantId).maybeSingle();
  const company = (data as { name: string } | null)?.name ?? "R Parry Financial LLC";
  return { company, address: process.env.BROADCAST_ADDRESS || DEFAULT_ADDRESS };
}

// GET — whether the bulk-send path is live (client disables Send buttons if not).
export async function GET() {
  const gate = await requireTenantAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (gate.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  return NextResponse.json({ sendingEnabled: sendingEnabled() });
}

// POST — { audience, subject, body, mode: "test" | "send" }.
//  - "test": emails a single [TEST] copy to the signed-in admin.
//  - "send": creates the broadcast and emails the whole audience.
// Both are DORMANT unless BROADCAST_FROM is configured (news. subdomain sender).
export async function POST(req: Request) {
  const gate = await requireTenantAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (gate.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  let body: { audience?: string; subject?: string; body?: string; mode?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const audience = body.audience === "contacts" ? "contacts" : body.audience === "agents" ? "agents" : null;
  const subject = (body.subject ?? "").trim();
  const bodyText = (body.body ?? "").trim();
  const mode = body.mode === "send" ? "send" : "test";
  if (!audience) return NextResponse.json({ error: "Pick an audience (Agents or Contacts)." }, { status: 422 });
  if (!subject) return NextResponse.json({ error: "Subject is required." }, { status: 422 });
  if (!bodyText) return NextResponse.json({ error: "Email body is required." }, { status: 422 });

  const origin = new URL(req.url).origin;
  const footer = await footerInfo(gate.tenantId);

  if (mode === "test") {
    const supabase = createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    const to = user?.email ?? "";
    const r = await sendBroadcastTest({ tenantId: gate.tenantId, audience, subject, body: bodyText, to, origin, footer });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });
    return NextResponse.json({ ok: true, testedTo: to });
  }

  const r = await createAndSendBroadcast({
    tenantId: gate.tenantId, createdBy: gate.userId, audience,
    subject, body: bodyText, origin, footer,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });
  return NextResponse.json({ ok: true, sent: r.sent, total: r.total });
}
