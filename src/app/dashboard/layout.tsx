import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Wraps every /dashboard/* page. Blocks a turned-off user (LO or admin whose
// `active` flag is false) from reaching the dashboard — a turned-off account
// can no longer sign in / access anything. The idle auto sign-off lives app-wide
// in the root layout. Individual pages still enforce their own auth redirects.
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: appUser } = await supabase
      .from("app_users")
      .select("active")
      .eq("id", user.id)
      .maybeSingle();
    if (appUser && appUser.active === false) {
      redirect("/login?disabled=1");
    }
  }
  return <>{children}</>;
}
