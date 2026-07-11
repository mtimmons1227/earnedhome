import { NextResponse } from "next/server";
import { requireTenantAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendLoLoginInvite } from "@/lib/email";

export const dynamic = "force-dynamic";

// POST — email an LO their set-password / sign-in link. Generates a recovery
// action link (Supabase) and sends it via Resend, so the LO can activate their
// login and reach their dashboard. Client passes `origin` (the site base URL) so
// the link points at the right host. Admin-only, scoped to the caller's tenant.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireTenantAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (gate.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  let body: { origin?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const origin = (body.origin ?? "").replace(/\/+$/, "");
  if (!origin) return NextResponse.json({ error: "Missing origin" }, { status: 400 });

  const admin = createSupabaseAdmin();
  const { data: lo } = await admin
    .from("app_users")
    .select("full_name, email")
    .eq("id", params.id)
    .eq("tenant_id", gate.tenantId)
    .maybeSingle();

  if (!lo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!lo.email) return NextResponse.json({ error: "This LO has no email on file" }, { status: 422 });

  // Generate a set-password (recovery) link the LO clicks to activate their login.
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: lo.email,
    options: { redirectTo: `${origin}/auth/callback?next=/reset-password` },
  });
  const actionLink = (linkData as { properties?: { action_link?: string } } | null)?.properties?.action_link;
  if (linkErr || !actionLink) {
    return NextResponse.json({ error: linkErr?.message ?? "Could not generate link" }, { status: 500 });
  }

  const { data: tenant } = await admin
    .from("tenants").select("lo_name").eq("id", gate.tenantId).maybeSingle();

  const r = await sendLoLoginInvite({
    to: lo.email,
    loName: lo.full_name as string | null,
    companyName: (tenant?.lo_name as string | null) ?? null,
    link: actionLink,
  });
  if (!r.sent) return NextResponse.json({ error: r.reason ?? "Could not send" }, { status: 502 });

  const sentAt = new Date().toISOString();
  await admin
    .from("app_users")
    .update({ invite_sent_at: sentAt })
    .eq("id", params.id)
    .eq("tenant_id", gate.tenantId);

  return NextResponse.json({ sent: true, invite_sent_at: sentAt });
}
