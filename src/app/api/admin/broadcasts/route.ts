import { NextResponse } from "next/server";
import { requireTenantAdmin } from "@/lib/auth-admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendBroadcastTest, createAndSendBroadcast, sendingEnabled } from "@/lib/broadcast";

export const dynamic = "force-dynamic";

// Footer identity, matching the legacy Word mail-merge. Defaults are R Parry's (from
// the current letter); each is overridable per environment.
async function footerInfo(tenantId: string) {
  const admin = createSupabaseAdmin();
  const { data } = await admin.from("tenants").select("name, nmls").eq("id", tenantId).maybeSingle();
  const t = data as { name: string; nmls: string | null } | null;
  return {
    company: t?.name ?? "R Parry Financial LLC",
    address: process.env.BROADCAST_ADDRESS || "PO Box 100184, Fort Worth, TX 76185-0184",
    website: process.env.BROADCAST_WEBSITE || "www.rparryfinancial.com",
    phone: process.env.BROADCAST_PHONE || "682-250-7649",
    nmls: t?.nmls ?? "1924318",
    privacyUrl: process.env.BROADCAST_PRIVACY_URL || "https://rparryfinancial.com/wp-content/uploads/2025/08/Privacy-Notice.pdf",
  };
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

  let body: { audience?: string; subject?: string; body?: string; mode?: string; isHtml?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const audience = body.audience === "contacts" ? "contacts" : body.audience === "agents" ? "agents" : null;
  const subject = (body.subject ?? "").trim();
  const bodyText = (body.body ?? "").trim();
  const isHtml = body.isHtml === true;
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
    const r = await sendBroadcastTest({ tenantId: gate.tenantId, audience, subject, body: bodyText, to, origin, footer, isHtml });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });
    return NextResponse.json({ ok: true, testedTo: to });
  }

  const r = await createAndSendBroadcast({
    tenantId: gate.tenantId, createdBy: gate.userId, audience,
    subject, body: bodyText, origin, footer, isHtml,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });
  return NextResponse.json({ ok: true, sent: r.sent, total: r.total });
}
