import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { siteOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";

// POST target for the /auth/confirm "Continue" button. Exchanges the one-time
// token for a session SERVER-SIDE (sets the cookies), then forwards to `next`
// (e.g. /reset-password). Because the token is only spent on this human-driven
// POST — not on a GET/prefetch of the confirm page — it survives email-security
// link scanners. Mirrors the verifyOtp path in /auth/callback.
export async function POST(req: NextRequest) {
  // Canonical host (per env), NOT req.url — on Netlify req.url resolves to the
  // per-deploy permalink, which would redirect the user off the clean domain and
  // drop the just-set session cookie ("couldn't verify your reset link").
  const origin = siteOrigin(new URL(req.url).origin);
  const form = await req.formData();
  const tokenHash = String(form.get("token_hash") ?? "");
  const type = (String(form.get("type") ?? "recovery") as EmailOtpType);
  const next = String(form.get("next") ?? "/reset-password");

  // 303 so the browser follows the redirect as a GET.
  const fail = NextResponse.redirect(`${origin}/login?reset=expired`, { status: 303 });
  if (!tokenHash) return fail;

  const res = NextResponse.redirect(`${origin}${next}`, { status: 303 });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (toSet: { name: string; value: string; options: CookieOptions }[]) =>
          toSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
      },
    },
  );

  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return fail;
  return res;
}
