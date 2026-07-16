import { headers } from "next/headers";
import { getTenantForHost, slugFromHost } from "@/lib/tenant";
import { getAgentBySlug, isAgentOwnerActive } from "@/lib/agents";
import { getResolvedLOForLead } from "@/lib/loanOfficer";
import { displayIdentity } from "@/lib/loSelect";
import { BrandHeader } from "@/components/BrandHeader";
import { PathfinderTool } from "@/components/PathfinderTool";

export const dynamic = "force-dynamic";

// Agent-attributed entry point. A realtor shares /a/<their-slug>; any buyer who
// runs an estimate here is tagged to that agent (and the agent gets a copy of
// the lead). If the slug is unknown or the seat has been revoked (agent
// deactivated), we fall back to a normal, unattributed estimate so the buyer's
// experience is never broken.
export default async function AgentPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { st?: string };
}) {
  const shareToken = typeof searchParams?.st === "string" ? searchParams.st : null;
  const h = headers();
  const host = h.get("host");
  const tenant = await getTenantForHost(host);

  if (!tenant) {
    return (
      <main>
        <div className="panel">
          <div className="empty">
            This site isn&apos;t configured yet. (No active tenant for{" "}
            <b>{slugFromHost(host)}</b>.)
          </div>
        </div>
      </main>
    );
  }

  const agent = await getAgentBySlug(tenant.id, params.slug);
  // A turned-off LO revokes their agents' links too (full deactivation).
  const ownerActive = agent ? await isAgentOwnerActive(agent.id) : true;

  const b = tenant.branding;
  const themeVars = {
    ["--primary" as string]: b.primary,
    ["--accent" as string]: b.accent,
    ["--bg" as string]: b.bg,
  } as React.CSSProperties;

  // Revoked seat: the slug exists but the agent is turned off. Block the link
  // with a graceful message instead of running a (mis-attributed) estimate, and
  // point the buyer at the lender's main page so they're never fully stranded.
  if (agent && (!agent.active || !ownerActive)) {
    return (
      <div style={themeVars}>
        <BrandHeader tenant={tenant} />
        <main style={{ maxWidth: 560, margin: "10vh auto", padding: 16 }}>
          <div className="panel" style={{ textAlign: "center" }}>
            <h2 style={{ marginTop: 0, color: "var(--primary)" }}>This link is no longer active</h2>
            <p className="hint">
              The link you used has been turned off. Please reach out to your agent or
              {" "}{tenant.lo_name ?? "our team"} for an updated link.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Show the agent's own LO as the loan officer (matches where the lead routes),
  // falling back to the tenant's primary/company when the agent has no LO.
  const resolvedLO = await getResolvedLOForLead(tenant.id, agent?.id ?? null);
  const identity = displayIdentity({
    resolved: resolvedLO,
    tenantLoName: tenant.lo_name,
    tenantNmls: tenant.nmls,
    companyNmls: tenant.branding.company_nmls ?? null,
  });

  return (
    <div style={themeVars}>
      <BrandHeader tenant={tenant} />
      <PathfinderTool
        tenantId={tenant.id}
        loName={identity.loName}
        loNmls={identity.loNmls}
        nmls={identity.companyNmls}
        applyUrl={tenant.apply_url}
        loPhone={tenant.lo_phone}
        bookingUrl={tenant.booking_url}
        agentId={agent?.id ?? null}
        agentName={agent?.name ?? null}
        shareToken={shareToken}
      />
    </div>
  );
}
