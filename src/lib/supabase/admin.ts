import { createClient } from "@supabase/supabase-js";

// Service-role client — server-only, bypasses RLS. Use for trusted writes
// (e.g. persisting quotes/leads after server-side tenant validation).
// NEVER import this into client components.
export function createSupabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Service-role reads must NEVER be served from Next.js's fetch Data Cache
    // (which persists to .next/cache and survives dev-server restarts). Without
    // this, pages that read via the admin client — e.g. the public agent status
    // portal — show stale data until the cache happens to revalidate. Forcing
    // no-store makes every service-role query hit the database fresh.
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, cache: "no-store" }),
    },
  });
}
