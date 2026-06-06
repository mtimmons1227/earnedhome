import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { LeadsTable, type LeadRow } from "./LeadsTable";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: appUser } = await supabase
    .from("app_users")
    .select("tenant_id, role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!appUser) {
    return (
      <main style={{ maxWidth: 640, margin: "8vh auto", padding: 16 }}>
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>No workspace yet</h2>
          <p className="hint">
            You&apos;re signed in as {user.email}, but this account isn&apos;t linked
            to a tenant. Ask an admin to add you to a workspace.
          </p>
          <form action="/auth/signout" method="post">
            <button className="leadbtn" type="submit" style={{ marginTop: 12 }}>Sign out</button>
          </form>
        </div>
      </main>
    );
  }

  const { data: tenant } = await supabase
    .from("tenants").select("name").eq("id", appUser.tenant_id).maybeSingle();

  // RLS scopes both of these to the signed-in user's tenant automatically.
  const { data: leads } = await supabase
    .from("leads")
    .select("id, full_name, email, phone, status, consent_tcpa, created_at, routed_to, quote_id")
    .order("created_at", { ascending: false });

  const { count: quotesRun } = await supabase
    .from("events").select("*", { count: "exact", head: true }).eq("type", "quote_created");

  const rows = (leads ?? []) as LeadRow[];
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const leadsThisWeek = rows.filter((l) => new Date(l.created_at).getTime() >= weekAgo).length;
  const newLeads = rows.filter((l) => l.status === "new").length;

  return (
    <div>
      <header className="eh-header" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="eh-brand">{tenant?.name ?? "EarnedHome"} — Leads</div>
          <div className="eh-tag">
            {appUser.full_name ?? user.email} · {appUser.role}
          </div>
        </div>
        <form action="/auth/signout" method="post">
          <button type="submit" style={{ background: "transparent", color: "#fff",
            border: "1px solid rgba(255,255,255,.5)", borderRadius: 8, padding: "8px 12px",
            cursor: "pointer", fontWeight: 600 }}>Sign out</button>
        </form>
      </header>

      <main>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 12, marginBottom: 16 }}>
          <Metric label="Total leads" value={rows.length} />
          <Metric label="New (unworked)" value={newLeads} />
          <Metric label="Leads this week" value={leadsThisWeek} />
          <Metric label="Quotes run" value={quotesRun ?? 0} />
        </div>
        <LeadsTable initialLeads={rows} />
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)",
      borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: "var(--primary)" }}>{value}</div>
    </div>
  );
}
