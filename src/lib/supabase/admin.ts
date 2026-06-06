import { createClient } from "@supabase/supabase-js";

// Service-role client — server-only, bypasses RLS. Use for trusted writes
// (e.g. persisting quotes/leads after server-side tenant validation).
// NEVER import this into client components.
export function createSupabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
