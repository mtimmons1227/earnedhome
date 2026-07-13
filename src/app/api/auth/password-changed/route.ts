import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendPasswordChangedEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// POST — called by the reset page right after a successful password update,
// while the recovery session is still active. Emails the signed-in user a
// "your password was changed" security notice. Identified by their own session
// (no body needed). Best-effort: always returns ok so it never blocks the reset.
export async function POST() {
  try {
    const supabase = createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return NextResponse.json({ ok: true });

    const admin = createSupabaseAdmin();
    let loName: string | null = null;
    let companyName: string | null = null;
    const { data: appUser } = await admin
      .from("app_users").select("full_name, tenant_id").eq("id", user.id).maybeSingle();
    if (appUser) {
      loName = (appUser.full_name as string | null) ?? null;
      if (appUser.tenant_id) {
        const { data: tenant } = await admin
          .from("tenants").select("lo_name").eq("id", appUser.tenant_id).maybeSingle();
        companyName = (tenant?.lo_name as string | null) ?? null;
      }
    }

    await sendPasswordChangedEmail({ to: user.email, loName, companyName });
  } catch {
    /* best-effort — never block the password reset on this notice */
  }
  return NextResponse.json({ ok: true });
}
