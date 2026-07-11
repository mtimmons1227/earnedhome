import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireTenantAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// GET — list the broker's loan officers (primary first). Admin-only.
export async function GET() {
  const gate = await requireTenantAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (gate.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("app_users")
    .select("id, full_name, email, nmls, role, is_primary, active, invite_sent_at, created_at")
    .eq("tenant_id", gate.tenantId)
    .in("role", ["lo", "admin"])
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ los: data ?? [] });
}

// POST — add an LO { fullName, email, nmls? }. Creates the login (auth user, NO
// invite email — a random temp password; activation via password reset is a
// separate step) and the app_users record (role 'lo', active, not primary).
export async function POST(req: Request) {
  const gate = await requireTenantAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (gate.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  let body: { fullName?: string; email?: string; nmls?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const fullName = (body.fullName ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const nmls = (body.nmls ?? "").trim() || null;
  if (!fullName) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

  const admin = createSupabaseAdmin();

  // Guard: reject a duplicate LO email within this broker (two logins sharing one
  // inbox makes password resets/logins ambiguous). Use a real, unique email per LO.
  const { data: dupe } = await admin
    .from("app_users")
    .select("id")
    .eq("tenant_id", gate.tenantId)
    .eq("email", email)
    .maybeSingle();
  if (dupe) {
    return NextResponse.json({ error: "A loan officer with that email already exists" }, { status: 409 });
  }

  // Create the login. email_confirm:true so no confirmation email is sent; the LO
  // can't sign in until a password is set (broker triggers a reset later).
  const tempPassword = `${randomUUID()}Aa1!`;
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });
  if (authErr || !created?.user) {
    return NextResponse.json({ error: authErr?.message ?? "Could not create login" }, { status: 500 });
  }

  const { data, error } = await admin
    .from("app_users")
    .insert({
      id: created.user.id,
      tenant_id: gate.tenantId,
      role: "lo",
      full_name: fullName,
      email,
      nmls,
      is_primary: false,
      active: true,
    })
    .select("id, full_name, email, nmls, role, is_primary, active, invite_sent_at, created_at")
    .single();

  if (error) {
    // Roll back the orphaned auth user if the record insert failed.
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ lo: data });
}
