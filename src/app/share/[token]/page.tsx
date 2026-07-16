import { headers } from "next/headers";
import { getTenantForHost, slugFromHost } from "@/lib/tenant";
import { getActiveShareByToken } from "@/lib/shareLinks";
import { BrandHeader } from "@/components/BrandHeader";
import { ShareForm } from "./ShareForm";

export const dynamic = "force-dynamic";

// The buyer's "share with a friend" page (linked from their estimate email). They
// enter a friend's email and we send that friend the /r estimate link. Same
// referral token, so anyone who completes routes up the same agent/LO chain.
export default async function SharePage({ params }: { params: { token: string } }) {
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

  if (!share || share.kind !== "buyer_referral") {
    return (
      <div style={themeVars}>
        <BrandHeader tenant={tenant} />
        <main style={{ maxWidth: 520, margin: "10vh auto", padding: 16 }}>
          <div className="panel" style={{ textAlign: "center" }}>
            <h2 style={{ marginTop: 0, color: "var(--primary)" }}>This share link isn’t active</h2>
            <p className="hint">Run a new estimate to get a fresh link to share.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={themeVars}>
      <BrandHeader tenant={tenant} />
      <main style={{ maxWidth: 520, margin: "6vh auto", padding: 16 }}>
        <ShareForm token={share.token} estimateUrl={`/r/${share.token}`} />
      </main>
    </div>
  );
}
