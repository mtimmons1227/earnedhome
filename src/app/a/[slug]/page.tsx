import { headers } from "next/headers";
import { getTenantForHost, slugFromHost } from "@/lib/tenant";
import { getAgentBySlug } from "@/lib/agents";
import { BrandHeader } from "@/components/BrandHeader";
import { PathfinderTool } from "@/components/PathfinderTool";

export const dynamic = "force-dynamic";

// Agent-attributed entry point. A realtor shares /a/<their-slug>; any buyer who
// runs an estimate here is tagged to that agent (and the agent gets a copy of
// the lead). If the slug is unknown or the seat has been revoked (agent
// deactivated), we fall back to a normal, unattributed estimate so the buyer's
// experience is never broken.
export default async function AgentPage({ params }: { params: { slug: string } }) {
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

  const b = tenant.branding;
  const themeVars = {
    ["--primary" as string]: b.primary,
    ["--accent" as string]: b.accent,
    ["--bg" as string]: b.bg,
  } as React.CSSProperties;

  // Revoked seat: the slug exists but the agent is turned off. Block the link
  // with a graceful message instead of running a (mis-attributed) estimate, and
  // point the buyer at the lender's main page so they're never fully stranded.
  if (agent && !agent.active) {
    return (
      <div style={themeVars}>
        <BrandHeader tenant={tenant} />
        <main style={{ maxWidth: 560, margin: "10vh auto", padding: 16 }}>
          <div className="panel" style={{ textAlign: "center" }}>
            <h2 style={{ marginTop: 0, color: "var(--primary)" }}>This link is no longer active</h2>
            <p className="hint">
              The link you used has been turned off. You can still get your home-payment estimate
              from {tenant.lo_name ?? "our team"} below.
            </p>
            <a href="/" className="leadbtn" style={{ display: "inline-block", marginTop: 8,
              textDecoration: "none" }}>Get my estimate</a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={themeVars}>
      <BrandHeader tenant={tenant} />
      <PathfinderTool
        tenantId={tenant.id}
        loName={tenant.lo_name ?? "your loan officer"}
        nmls={tenant.nmls}
        applyUrl={tenant.apply_url}
        loPhone={tenant.lo_phone}
        bookingUrl={tenant.booking_url}
        agentId={agent?.id ?? null}
        agentName={agent?.name ?? null}
      />
    </div>
  );
}
