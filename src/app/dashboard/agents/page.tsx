import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { DashHeader, BackToDashboard, roleLabel } from "../DashHeader";
import { AgentsManager } from "./AgentsManager";

export const dynamic = "force-dynamic";

// LO/admin page to manage realtor "seats": add an agent, copy their unique
// /a/<slug> share link, and toggle a seat on/off (deactivating revokes the
// link). Reads/writes go through /api/admin/agents (requireTenantAdmin).
export default async function AgentsPage() {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: appUser } = await supabase
    .from("app_users")
    .select("tenant_id, role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!appUser || (appUser.role !== "admin" && appUser.role !== "lo")) {
    redirect("/dashboard");
  }

  return (
    <div>
      <DashHeader title="Agents" subtitle="Realtor partners & share links"
        user={{ name: appUser.full_name ?? user.email ?? "", role: roleLabel(appUser.role) }}>
        <BackToDashboard />
      </DashHeader>

      <main>
        <AgentsManager />
      </main>
    </div>
  );
}
