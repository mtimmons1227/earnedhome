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

  // RLS scopes leads + the embedded quote to the signed-in user's tenant.
  const { data: leads } = await supabase
    .from("leads")
    .select(
      "id, full_name, email, phone, status, consent_tcpa, consent_text, consent_at, source, notes, created_at, agents ( name ), quotes ( inputs, outputs, rates_as_of )",
    )
    .order("created_at", { ascending: false });

  const { count: quotesRun } = await supabase
    .from("events").select("*", { count: "exact", head: true }).eq("type", "quote_created");

  // Lead notes are append-only `lead_note` events. Group them by lead for the table.
  const { data: noteEvents } = await supabase
    .from("events")
    .select("payload, created_at")
    .eq("type", "lead_note")
    .order("created_at", { ascending: true });

  const notesByLead: Record<string, { authorName: string; body: string; created_at: string }[]> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const e of (noteEvents ?? []) as any[]) {
    const p = e.payload ?? {};
    const lid = p.leadId as string | undefined;
    if (!lid) continue;
    (notesByLead[lid] ??= []).push({
      authorName: p.authorName ?? "Unknown",
      body: p.body ?? "",
      created_at: e.created_at,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: LeadRow[] = ((leads ?? []) as any[]).map((l) => ({
    id: l.id, full_name: l.full_name, email: l.email, phone: l.phone,
    status: l.status, consent_tcpa: l.consent_tcpa, consent_text: l.consent_text,
    consent_at: l.consent_at, source: l.source, notes: l.notes, created_at: l.created_at,
    agent_name: Array.isArray(l.agents) ? (l.agents[0]?.name ?? null) : (l.agents?.name ?? null),
    quote: Array.isArray(l.quotes) ? (l.quotes[0] ?? null) : (l.quotes ?? null),
  }));

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const leadsThisWeek = rows.filter((l) => new Date(l.created_at).getTime() >= weekAgo).length;
  const newLeads = rows.filter((l) => l.status === "new").length;
  const conversion = (quotesRun ?? 0) > 0 ? Math.round((rows.length / (quotesRun ?? 1)) * 100) : 0;

  return (
    <div>
      <header className="eh-header" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="eh-brand">{tenant?.name ?? "EarnedHome"} — Leads</div>
          <div className="eh-tag">{appUser.full_name ?? user.email} · {roleLabel(appUser.role)}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a href="/" target="_blank" rel="noreferrer" style={{ color: "#fff",
            border: "1px solid rgba(255,255,255,.5)", borderRadius: 8, padding: "8px 12px",
            fontWeight: 600, textDecoration: "none" }}>View EarnedHome</a>
          <a href="/dashboard/agents" style={{ color: "#fff",
            border: "1px solid rgba(255,255,255,.5)", borderRadius: 8, padding: "8px 12px",
            fontWeight: 600, textDecoration: "none" }}>Agents</a>
          {appUser.role === "admin" && (
            <a href="/dashboard/workbook" style={{ color: "#fff",
              border: "1px solid rgba(255,255,255,.5)", borderRadius: 8, padding: "8px 12px",
              fontWeight: 600, textDecoration: "none" }}>Update rates</a>
          )}
          <form action="/auth/signout" method="post">
            <button type="submit" style={{ background: "transparent", color: "#fff",
              border: "1px solid rgba(255,255,255,.5)", borderRadius: 8, padding: "8px 12px",
              cursor: "pointer", fontWeight: 600 }}>Sign out</button>
          </form>
        </div>
      </header>

      <main>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12, marginBottom: 16 }}>
          <Metric label="Total leads" value={String(rows.length)} />
          <Metric label="New (unworked)" value={String(newLeads)} />
          <Metric label="Leads this week" value={String(leadsThisWeek)} />
          <Metric label="Quotes run" value={String(quotesRun ?? 0)} />
          <Metric label="Quote → lead" value={`${conversion}%`} />
        </div>
        <LeadsTable initialLeads={rows} initialNotes={notesByLead} />
      </main>
    </div>
  );
}

// "lo" -> "LO"; other roles title-cased (Admin, Staff).
function roleLabel(role: string): string {
  return role === "lo" ? "LO" : role.charAt(0).toUpperCase() + role.slice(1);
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)",
      borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: "var(--primary)" }}>{value}</div>
    </div>
  );
}
