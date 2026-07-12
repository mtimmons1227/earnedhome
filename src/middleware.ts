import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { slugFromHost } from "@/lib/tenant";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  res.headers.set("x-tenant-slug", slugFromHost(req.headers.get("host")));

  // The public agent status portal must always reflect the current lead status.
  // Without this, browsers serve a cached copy (and restore it from the
  // back/forward cache on reopen/reload), so the agent sees a stale page until a
  // hard refresh. `no-store` disables both the disk cache and bfcache for it.
  if (req.nextUrl.pathname.startsWith("/agent/")) {
    res.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  }

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
  await supabase.auth.getUser();
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
