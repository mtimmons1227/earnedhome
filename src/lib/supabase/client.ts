import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client for auth (login/logout) in client components.
export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
