import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Buyer self-service consent page. The token in the URL is the credential
// (unguessable, private to the buyer). Here the buyer allows or declines — and
// can later change — letting their referring agent see their loan status
// (friendly stages only; never financial detail). Server-rendered + no-store so
// it always reflects the current setting.
export default async function ConsentPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { done?: string };
}) {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("leads")
    .select("id, full_name, agent_status_consent, agent_id, agents ( name ), tenants ( lo_name )")
    .eq("consent_token", params.token)
    .maybeSingle();

  const wrap: React.CSSProperties = { maxWidth: 560, margin: "8vh auto", padding: 16 };

  if (!data) {
    return (
      <main style={wrap}>
        <div className="panel" style={{ textAlign: "center" }}>
          <h2 style={{ marginTop: 0, color: "var(--primary)" }}>This link isn&apos;t valid</h2>
          <p className="hint">Please use the most recent link from your loan officer or agent.</p>
        </div>
      </main>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any;
  const agentName: string | null = Array.isArray(row.agents) ? (row.agents[0]?.name ?? null) : (row.agents?.name ?? null);
  const company: string | null = Array.isArray(row.tenants) ? (row.tenants[0]?.lo_name ?? null) : (row.tenants?.lo_name ?? null);
  const firstName = (row.full_name ?? "").split(" ")[0] || "there";
  const agent = agentName ?? "your agent";
  const lender = company ?? "your loan officer";
  const sharing = !!row.agent_status_consent;

  if (!row.agent_id) {
    return (
      <main style={wrap}>
        <div className="panel" style={{ textAlign: "center" }}>
          <h2 style={{ marginTop: 0, color: "var(--primary)" }}>Nothing to share</h2>
          <p className="hint">
            There isn&apos;t a referring agent on this inquiry, so there&apos;s no status to share.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={wrap}>
      <div className="panel">
        <h2 style={{ marginTop: 0, color: "var(--primary)" }}>Share your loan progress?</h2>
        <p>Hi {firstName} — <strong>{agent}</strong> referred you to <strong>{lender}</strong>.</p>
        <p className="hint">
          You can let {agent} see your <strong>loan progress</strong> — simple stages like
          &ldquo;In process&rdquo; and &ldquo;Closed.&rdquo; They will <strong>never</strong> see your
          finances, credit, income, or loan details — those stay between you and {lender}. It&apos;s
          optional, and you can change it anytime on this page.
        </p>

        {searchParams.done === "on" && (
          <div style={okBox}>✓ Saved — {agent} can now see your loan progress.</div>
        )}
        {searchParams.done === "off" && (
          <div style={okBox}>✓ Saved — {agent} can no longer see your loan progress.</div>
        )}

        <div style={{ background: sharing ? "#f0fdf4" : "#f3f4f6", border: "1px solid var(--line)",
          borderRadius: 10, padding: "12px 14px", margin: "14px 0", fontSize: 14 }}>
          Current setting:{" "}
          <strong style={{ color: sharing ? "#15803d" : "#6b7280" }}>
            {sharing ? `Sharing on — ${agent} can see your progress` : "Not sharing"}
          </strong>
        </div>

        <form method="post" action={`/consent/${params.token}/set`} style={{ display: "grid", gap: 10 }}>
          {!sharing ? (
            <button type="submit" name="value" value="on" className="leadbtn" style={{ width: "100%" }}>
              Allow {agent} to see my progress
            </button>
          ) : (
            <button type="submit" name="value" value="off" className="leadbtn"
              style={{ width: "100%", background: "#6b7280" }}>
              Stop sharing with {agent}
            </button>
          )}
        </form>

        <p className="hint" style={{ fontSize: 12, marginTop: 14 }}>
          Bookmark this page — it&apos;s your personal setting, and you can return anytime to turn
          sharing on or off.
        </p>
      </div>
    </main>
  );
}

const okBox: React.CSSProperties = {
  background: "#e8f5e9", border: "1px solid #86efac", color: "#15803d",
  borderRadius: 8, padding: "8px 12px", fontSize: 13, marginTop: 8,
};
