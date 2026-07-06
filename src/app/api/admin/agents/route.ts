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
  const { data, error } = await admin
    .from("agents")
    .select("id, name, email, phone, slug, active, invite_sent_at, created_at")
    .eq("tenant_id", gate.tenantId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ agents: data ?? [] });
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
      name,
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      slug,
      active: true,
    })
    .select("id, name, email, phone, slug, active, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ agent: data });
}
