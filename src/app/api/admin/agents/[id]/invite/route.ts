import { NextResponse } from "next/server";
import { requireTenantAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendAgentLinkInvite } from "@/lib/email";

export const dynamic = "force-dynamic";

// POST — email an agent their own /a/<slug> share link ("Here's your EarnedHome
// link"). The client passes `origin` (the site's public base URL) so the link in
// the email points at the right host. Scoped to the caller's tenant.
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const gate = await requireTenantAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  let body: { origin?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const origin = (body.origin ?? "").replace(/\/+$/, "");
  if (!origin) return NextResponse.json({ error: "Missing origin" }, { status: 400 });

  const admin = createSupabaseAdmin();
  const { data: agent } = await admin
    .from("agents")
    .select("name, email, slug, status_token")
    .eq("id", params.id)
    .eq("tenant_id", gate.tenantId)
    .maybeSingle();

  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!agent.email) return NextResponse.json({ error: "This agent has no email on file" }, { status: 422 });

  // The lender name for the email body ("… while R Parry Financial handles the financing").
  const { data: tenant } = await admin
    .from("tenants").select("lo_name").eq("id", gate.tenantId).maybeSingle();

  const r = await sendAgentLinkInvite({
    to: agent.email,
    agentName: agent.name,
    loName: (tenant?.lo_name as string | null) ?? "your loan officer",
    link: `${origin}/a/${agent.slug}`,
    statusLink: agent.status_token ? `${origin}/agent/${agent.status_token}` : null,
  });

  if (!r.sent) return NextResponse.json({ error: r.reason ?? "Could not send" }, { status: 502 });

  // Record when the link was sent so the dashboard can show it.
  const sentAt = new Date().toISOString();
  await admin
    .from("agents")
    .update({ invite_sent_at: sentAt })
    .eq("id", params.id)
    .eq("tenant_id", gate.tenantId);

  return NextResponse.json({ sent: true, invite_sent_at: sentAt });
}
