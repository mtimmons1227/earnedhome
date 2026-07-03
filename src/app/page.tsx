import { headers } from "next/headers";
import { getTenantForHost, slugFromHost } from "@/lib/tenant";
import { createSupabaseServer } from "@/lib/supabase/server";
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

  // Show a discreet "back to dashboard" link only to signed-in staff (never buyers).
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let isStaff = false;
  if (user) {
    const { data: appUser } = await supabase
      .from("app_users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    isStaff = !!appUser;
  }

  return (
    <div style={themeVars}>
      {isStaff && (
        <div style={{ background: "var(--primary)", textAlign: "right", padding: "6px 14px",
          borderBottom: "1px solid rgba(255,255,255,.18)" }}>
          <a
            href="/dashboard"
            style={{ color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none",
              opacity: 0.9 }}
          >
            ← Back to dashboard
          </a>
        </div>
      )}
      <BrandHeader tenant={tenant} />
      <PathfinderTool
        tenantId={tenant.id}
        loName={tenant.lo_name ?? "your loan officer"}
        nmls={tenant.nmls}
        applyUrl={tenant.apply_url}
        loPhone={tenant.lo_phone}
        bookingUrl={tenant.booking_url}
      />
    </div>
  );
}
