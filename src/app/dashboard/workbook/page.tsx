import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { DashHeader, BackToDashboard } from "../DashHeader";
import { WorkbookSwap } from "./WorkbookSwap";

export const dynamic = "force-dynamic";

// Loan-officer / admin-only page: download the rate workbook, edit it, and
// upload it back to replace the live file in place.
export default async function WorkbookPage() {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: appUser } = await supabase
    .from("app_users")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!appUser || appUser.role !== "admin") redirect("/dashboard");

  return (
    <div>
      <DashHeader title="Rate Workbook" subtitle={`${appUser.full_name ?? user.email} · Admin`}>
        <BackToDashboard />
      </DashHeader>
      <main style={{ maxWidth: 680, margin: "0 auto", padding: 16 }}>
        <WorkbookSwap />
      </main>
    </div>
  );
}
