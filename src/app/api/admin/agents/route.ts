import { NextResponse } from "next/server";
import { requireTenantAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { slugify } from "@/lib/agents";

export const dynamic = "force-dynamic";

// GET — list the tenant's agents (the LO's realtor partners).
export async function GET() {
  const gate = await requireTenantAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const admin = createSupabaseAdmin();
  // Admins see all of the tenant's agents; a loan officer sees only the agents
  // they own. (This route uses the service role, which bypasses RLS, so the
  // per-LO scope must be applied here in code.)
  let q = admin
    .from("agents")
    .select("id, name, email, phone, slug, active, status_token, invite_sent_at, created_at, lo_id, lo:app_users!lo_id ( full_name )")
    .eq("tenant_id", gate.tenantId);
  if (gate.role !== "admin") q = q.eq("lo_id", gate.userId);
  const { data, error } = await q.order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Flatten the owning-LO name so the UI can show/reassign it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agents = ((data ?? []) as any[]).map((a) => ({
    id: a.id, name: a.name, email: a.email, phone: a.phone, slug: a.slug, active: a.active,
    status_token: a.status_token, invite_sent_at: a.invite_sent_at, created_at: a.created_at,
    lo_id: a.lo_id ?? null,
    lo_name: Array.isArray(a.lo) ? (a.lo[0]?.full_name ?? null) : (a.lo?.full_name ?? null),
  }));
  return NextResponse.json({ agents });
}

// POST — create an agent { name, email?, phone? }. Generates a slug unique
// within the tenant. New agents are active (a seat) by default.
export async function POST(req: Request) {
  const gate = await requireTenantAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  let body: { name?: string; email?: string; phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const admin = createSupabaseAdmin();

  // Ensure the slug is unique within this tenant.
  const base = slugify(name);
  let slug = base;
  for (let i = 2; i < 100; i++) {
    const { data: existing } = await admin
      .from("agents")
      .select("id")
      .eq("tenant_id", gate.tenantId)
      .eq("slug", slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${base}-${i}`;
  }

  const { data, error } = await admin
    .from("agents")
    .insert({
      tenant_id: gate.tenantId,
      // The agent belongs to whoever created them (the owning LO). For R Parry the
      // admin is the LO; for a multi-LO broker each LO owns the agents they add.
      lo_id: gate.userId,
      name,
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      slug,
      active: true,
    })
    .select("id, name, email, phone, slug, active, status_token, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ agent: data });
}
