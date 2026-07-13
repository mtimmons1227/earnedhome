import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendPasswordResetEmail } from "@/lib/email";
import { siteOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";

// POST { email } — "Forgot password?" from the sign-in page.
//
// Generates a Supabase recovery token, then emails a link to our OWN
// /auth/confirm page (via Resend, from the verified domain) — the same
// branded flow as the LO invite. This beats Safe Links, avoids Supabase's
// rate-limited default email, and stays on the allow-listed domain.
//
// Always returns a generic { ok: true } so the response never reveals whether
// an account exists for that email (no account enumeration).
export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email) return NextResponse.json({ ok: true });

  const origin = siteOrigin(new URL(req.url).origin);
  const admin = createSupabaseAdmin();

  try {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${origin}/auth/callback?next=/reset-password` },
    });
    const hashedToken = (data as { properties?: { hashed_token?: string } } | null)?.properties?.hashed_token;

    if (!error && hashedToken) {
      // Best-effort personalization: the LO's name + their broker's display name.
      let loName: string | null = null;
      let companyName: string | null = null;
      const { data: appUser } = await admin
        .from("app_users").select("full_name, tenant_id").eq("email", email).maybeSingle();
      if (appUser) {
        loName = (appUser.full_name as string | null) ?? null;
        if (appUser.tenant_id) {
          const { data: tenant } = await admin
            .from("tenants").select("lo_name").eq("id", appUser.tenant_id).maybeSingle();
          companyName = (tenant?.lo_name as string | null) ?? null;
        }
      }

      const link =
        `${origin}/auth/confirm?token_hash=${encodeURIComponent(hashedToken)}` +
        `&type=recovery&next=${encodeURIComponent("/reset-password")}`;

      await sendPasswordResetEmail({ to: email, loName, companyName, link });
    }
    // If generateLink errored (e.g. no such user), fall through to generic success.
  } catch {
    /* swallow — never reveal whether the account exists */
  }

  return NextResponse.json({ ok: true });
}
