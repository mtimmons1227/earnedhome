import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
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

  const { data: tenant } = await supabase
    .from("tenants").select("name").eq("id", appUser.tenant_id).maybeSingle();

  return (
    <div>
      <header className="eh-header" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="eh-brand">{tenant?.name ?? "EarnedHome"} — Agents</div>
          <div className="eh-tag">Realtor partners &amp; share links</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a href="/dashboard" style={{ color: "#fff",
            border: "1px solid rgba(255,255,255,.5)", borderRadius: 8, padding: "8px 12px",
            fontWeight: 600, textDecoration: "none" }}>← Leads</a>
        </div>
      </header>

      <main>
        <AgentsManager />
      </main>
    </div>
  );
}
