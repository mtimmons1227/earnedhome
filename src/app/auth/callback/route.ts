import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";

// Auth callback for email links (password reset / magic link). Establishes the
// session SERVER-SIDE (more reliable than client-side detection in the App
// Router), sets the cookies, then forwards to `next` (e.g. /reset-password).
//
// Handles BOTH email-link styles so it works regardless of the Supabase email
// template / flow:
//   • PKCE:      ?code=...                 -> exchangeCodeForSession
//   • token_hash: ?token_hash=...&type=... -> verifyOtp (works cross-browser)
// On a missing/expired/used link, Supabase appends error_* params (or no token);
// we send those to /login?reset=expired so the UI can prompt for a fresh link.
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = (searchParams.get("type") as EmailOtpType | null) ?? "recovery";
  const next = searchParams.get("next") ?? "/dashboard";
  const errorDescription = searchParams.get("error_description");

  if (errorDescription || (!code && !tokenHash)) {
    return NextResponse.redirect(`${origin}/login?reset=expired`);
  }

  const res = NextResponse.redirect(`${origin}${next}`);
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

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({ type, token_hash: tokenHash! });

  if (error) {
    return NextResponse.redirect(`${origin}/login?reset=expired`);
  }
  return res;
}
