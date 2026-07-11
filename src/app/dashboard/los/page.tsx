import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
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

  const { data: tenant } = await supabase
    .from("tenants").select("name").eq("id", appUser.tenant_id).maybeSingle();

  return (
    <div>
      <header className="eh-header" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="eh-brand">{tenant?.name ?? "EarnedHome"} — Loan Officers</div>
          <div className="eh-tag">Add &amp; manage LOs under this broker</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a href="/dashboard" style={{ color: "#fff",
            border: "1px solid rgba(255,255,255,.5)", borderRadius: 8, padding: "8px 12px",
            fontWeight: 600, textDecoration: "none" }}>← Leads</a>
        </div>
      </header>

      <main>
        <LosManager />
      </main>
    </div>
  );
}
