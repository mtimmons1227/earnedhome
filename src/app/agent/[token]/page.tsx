import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isAgentOwnerActive } from "@/lib/agents";
import { listPendingInvites } from "@/lib/shareLinks";
import { agentStage } from "@/lib/loSelect";
import { AutoRefresh } from "./AutoRefresh";
import { AgentActions } from "./AgentActions";

export const dynamic = "force-dynamic";

interface Branding {
  primary?: string;
  accent?: string;
  bg?: string;
}

// Pretty-print a US phone number (matches the dashboard/agents pages).
function formatPhone(raw: string | null): string {
  if (!raw) return "";
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === "1") return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return raw;
}

// Public, no-login agent status portal. The token in the URL is the credential —
// unguessable and revocable (turning the agent off blocks it). Shows the buyers
// this agent referred and a friendly stage. Loan progression only appears where
// the buyer consented (agent_status_consent); otherwise "Connected". No financials.
export default async function AgentStatusPage({ params }: { params: { token: string } }) {
  const admin = createSupabaseAdmin();

  const { data: agent } = await admin
    .from("agents")
    .select("id, name, active, tenant_id")
    .eq("status_token", params.token)
    .maybeSingle();

  // A turned-off LO revokes their agents' status portals too.
  const ownerActive = agent ? await isAgentOwnerActive(agent.id) : true;

  if (!agent || !agent.active || !ownerActive) {
    return (
      <main style={{ maxWidth: 520, margin: "12vh auto", padding: 24, textAlign: "center" }}>
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>This status link isn’t active</h2>
          <p className="hint">
            This link may have been turned off. Please contact your loan officer for an updated link.
          </p>
        </div>
      </main>
    );
  }

  const { data: tenant } = await admin
    .from("tenants")
    .select("name, lo_name, branding")
    .eq("id", agent.tenant_id)
    .maybeSingle();

  const { data: leads } = await admin
    .from("leads")
    .select("id, full_name, status, email, phone, created_at")
    .eq("agent_id", agent.id)
    .order("created_at", { ascending: false });

  const rows = (leads ?? []) as {
    id: string;
    full_name: string | null;
    status: string;
    email: string | null;
    phone: string | null;
    created_at: string;
  }[];

  // Buyers who've run their numbers (with a friendly stage) + invites still waiting.
  const buyers = rows.map((r) => ({
    id: r.id,
    name: r.full_name || "A buyer",
    subtitle: [r.email, formatPhone(r.phone), new Date(r.created_at).toLocaleDateString()].filter(Boolean).join(" · "),
    stage: agentStage(r.status),
  }));
  const pending = await listPendingInvites(agent.id);
  const invites = pending.map((p) => ({ id: p.id, name: p.recipient_name ?? "", email: p.recipient_email }));

  const company = (tenant?.lo_name as string | null) ?? (tenant?.name as string | null) ?? "your loan officer";
  const b = (tenant?.branding ?? {}) as Branding;
  const themeVars = {
    ["--primary" as string]: b.primary ?? "#1F3864",
    ["--accent" as string]: b.accent ?? "#2E75B6",
    ["--bg" as string]: b.bg ?? "#F4F6FA",
  } as React.CSSProperties;

  return (
    <div style={themeVars}>
      <AutoRefresh seconds={30} />
      <header className="eh-header">
        <div>
          <div className="eh-brand">Your referred buyers</div>
          <div className="eh-tag">{agent.name} · powered by {company}</div>
        </div>
      </header>

      <main style={{ maxWidth: 620, margin: "0 auto", padding: 16 }}>
        <AgentActions token={params.token} buyers={buyers} invites={invites} />
        <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 12, marginTop: 12 }}>
          You see only a high-level stage — no financial, credit, or loan details.
          Those stay between the buyer and {company}.
        </p>
      </main>
    </div>
  );
}
