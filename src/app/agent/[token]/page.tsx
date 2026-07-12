import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isAgentOwnerActive } from "@/lib/agents";
import { agentStage, type AgentStage } from "@/lib/loSelect";
import { AutoRefresh } from "./AutoRefresh";
import { RequestAccessButton } from "./RequestAccessButton";

export const dynamic = "force-dynamic";

interface Branding {
  primary?: string;
  accent?: string;
  bg?: string;
}

const stageColor: Record<AgentStage, { bg: string; fg: string }> = {
  Connected: { bg: "#eef2f7", fg: "#1F3864" },
  "In process": { bg: "#e7f0fb", fg: "#1d4ed8" },
  Closed: { bg: "#e8f5e9", fg: "#15803d" },
  Inactive: { bg: "#f3f4f6", fg: "#6b7280" },
};

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
    .select("id, full_name, status, agent_status_consent, email, created_at")
    .eq("agent_id", agent.id)
    .order("created_at", { ascending: false });

  const rows = (leads ?? []) as {
    id: string;
    full_name: string | null;
    status: string;
    agent_status_consent: boolean;
    email: string | null;
    created_at: string;
  }[];

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

      <main style={{ maxWidth: 760, margin: "0 auto", padding: 16 }}>
        <div className="panel">
          <p className="hint" style={{ marginTop: 0 }}>
            Buyers who ran their numbers from your link. Detailed loan status appears only where the
            buyer authorized it — otherwise you’ll see “Connected.” For specifics, contact {company}.
          </p>

          {rows.length === 0 ? (
            <div className="hint">No buyers yet. Share your link and they’ll show up here.</div>
          ) : (
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {rows.map((r, i) => {
                const stage = agentStage(r.status, r.agent_status_consent);
                const c = stageColor[stage];
                return (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto",
                    alignItems: "center", gap: 10, border: "1px solid var(--line)",
                    borderRadius: 10, padding: "12px 14px" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{r.full_name || "A buyer"}</div>
                      <div style={{ color: "var(--muted)", fontSize: 13 }}>
                        {new Date(r.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      <span style={{ background: c.bg, color: c.fg, fontWeight: 700, fontSize: 13,
                        borderRadius: 999, padding: "4px 12px", whiteSpace: "nowrap" }}>
                        {stage}
                      </span>
                      <RequestAccessButton token={params.token} leadId={r.id}
                        disabled={r.agent_status_consent} hasEmail={!!r.email} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 12, marginTop: 8 }}>
          Status shown with the buyer’s consent. This page shows no financial, credit, or loan
          details — those stay between the buyer and {company}.
        </p>
      </main>
    </div>
  );
}
