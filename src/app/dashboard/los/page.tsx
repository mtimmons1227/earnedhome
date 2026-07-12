import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { DashHeader, BackToDashboard } from "../DashHeader";
import { LosManager } from "./LosManager";

export const dynamic = "force-dynamic";

// Broker-admin page to manage loan officers: add an LO (record + login), set the
// primary LO (who gets non-agent leads), edit, and toggle active. Admin-only —
// reads/writes go through /api/admin/los.
export default async function LosPage() {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: appUser } = await supabase
    .from("app_users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .maybeSingle();

  // LO management is broker-admin only.
  if (!appUser || appUser.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div>
      <DashHeader title="Loan Officers" subtitle="Add & manage LOs under this broker">
        <BackToDashboard />
      </DashHeader>

      <main>
        <LosManager />
      </main>
    </div>
  );
}
