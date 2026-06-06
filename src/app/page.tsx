import { headers } from "next/headers";
import { getTenantForHost, slugFromHost } from "@/lib/tenant";
import { BrandHeader } from "@/components/BrandHeader";
import { PathfinderTool } from "@/components/PathfinderTool";

export const dynamic = "force-dynamic";

export default async function Page() {
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

  const b = tenant.branding;
  const themeVars = {
    ["--primary" as string]: b.primary,
    ["--accent" as string]: b.accent,
    ["--bg" as string]: b.bg,
  } as React.CSSProperties;

  return (
    <div style={themeVars}>
      <BrandHeader tenant={tenant} />
      <PathfinderTool
        tenantId={tenant.id}
        loName={tenant.lo_name ?? "your loan officer"}
        nmls={tenant.nmls}
      />
    </div>
  );
}
