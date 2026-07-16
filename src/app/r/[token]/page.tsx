import { headers } from "next/headers";
import { getTenantForHost, slugFromHost } from "@/lib/tenant";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getActiveShareByToken } from "@/lib/shareLinks";
import { isAgentOwnerActive } from "@/lib/agents";
import { getResolvedLOForLead } from "@/lib/loanOfficer";
import { displayIdentity } from "@/lib/loSelect";
import { BrandHeader } from "@/components/BrandHeader";
import { PathfinderTool } from "@/components/PathfinderTool";

export const dynamic = "force-dynamic";

// Flow B — buyer referral landing. A friend opens /r/<token> (the buyer sent it).
// The referral inherits the sharer's agent + LO; the resulting lead is tagged
// buyer_referral with referred_by = the buyer (handled in /api/lead via shareToken).
export default async function ReferralPage({ params }: { params: { token: string } }) {
  const h = headers();
  const host = h.get("host");
  const tenant = await getTenantForHost(host);

  if (!tenant) {
    return (
      <main>
        <div className="panel">
          <div className="empty">
            This site isn&apos;t configured yet. (No active tenant for <b>{slugFromHost(host)}</b>.)
          </div>
        </div>
      </main>
    );
  }

  const b = tenant.branding;
  const themeVars = {
    ["--primary" as string]: b.primary,
    ["--accent" as string]: b.accent,
    ["--bg" as string]: b.bg,
  } as React.CSSProperties;

  const share = await getActiveShareByToken(params.token);

  // Unknown / disabled / wrong-kind token: don't run a mis-attributed estimate —
  // show a graceful message and point them at the lender's main page.
  if (!share || share.kind !== "buyer_referral") {
    return (
      <div style={themeVars}>
        <BrandHeader tenant={tenant} />
        <main style={{ maxWidth: 560, margin: "10vh auto", padding: 16 }}>
          <div className="panel" style={{ textAlign: "center" }}>
            <h2 style={{ marginTop: 0, color: "var(--primary)" }}>This link is no longer active</h2>
            <p className="hint">
              Ask the person who shared it for a fresh link, or reach out to
              {" "}{tenant.lo_name ?? "our team"} directly.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Inherit the sharer's agent + LO. If the agent has been turned off, still let
  // the buyer run numbers (routes to the tenant's LO) so they're never stranded.
  let agentId: string | null = share.agent_id;
  let agentName: string | null = null;
  if (agentId) {
    const admin = createSupabaseAdmin();
    const { data: ag } = await admin.from("agents").select("name, active").eq("id", agentId).maybeSingle();
    const a = ag as { name: string; active: boolean } | null;
    const ownerActive = await isAgentOwnerActive(agentId);
    if (a && a.active && ownerActive) {
      agentName = a.name;
    } else {
      agentId = null;
    }
  }

  const resolvedLO = await getResolvedLOForLead(tenant.id, agentId);
  const identity = displayIdentity({
    resolved: resolvedLO,
    tenantLoName: tenant.lo_name,
    tenantNmls: tenant.nmls,
    companyNmls: tenant.branding.company_nmls ?? null,
  });

  return (
    <div style={themeVars}>
      <BrandHeader tenant={tenant} />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "8px 16px 0" }}>
        <div className="panel" style={{ marginBottom: 8, textAlign: "center" }}>
          <div style={{ fontWeight: 600, color: "var(--primary)" }}>A friend shared this with you</div>
          <div className="hint" style={{ marginTop: 2 }}>
            See what you can afford — no credit pull, no obligation.
          </div>
        </div>
      </main>
      <PathfinderTool
        tenantId={tenant.id}
        loName={identity.loName}
        loNmls={identity.loNmls}
        nmls={identity.companyNmls}
        applyUrl={tenant.apply_url}
        loPhone={tenant.lo_phone}
        bookingUrl={tenant.booking_url}
        agentId={agentId}
        agentName={agentName}
        shareToken={params.token}
      />
    </div>
  );
}
