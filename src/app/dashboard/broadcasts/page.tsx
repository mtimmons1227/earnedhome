import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { DashHeader, BackToDashboard, roleLabel } from "../DashHeader";
import { countActiveContacts, discoverContactFields, listBroadcasts, sendingEnabled } from "@/lib/broadcast";
import { BroadcastComposer } from "./BroadcastComposer";

export const dynamic = "force-dynamic";

// Broker-admin page: compose a broadcast to Agents (auto-generated links) or the
// imported Contacts (merge fields), preview it, send a test, and send to all.
// Sending is dormant until BROADCAST_FROM (news. subdomain sender) is configured.
export default async function BroadcastsPage() {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: appUser } = await supabase
    .from("app_users").select("tenant_id, role, full_name").eq("id", user.id).maybeSingle();
  if (!appUser || appUser.role !== "admin") redirect("/dashboard");

  const admin = createSupabaseAdmin();
  const [{ count: agentCount }, contactCount, contactFields, broadcasts, { data: tenant }] = await Promise.all([
    admin.from("agents").select("id", { count: "exact", head: true })
      .eq("tenant_id", appUser.tenant_id).eq("active", true),
    countActiveContacts(appUser.tenant_id),
    discoverContactFields(appUser.tenant_id),
    listBroadcasts(appUser.tenant_id),
    admin.from("tenants").select("name, nmls").eq("id", appUser.tenant_id).maybeSingle(),
  ]);

  // Footer identity for the live preview (mirrors what the send code stamps).
  const t = tenant as { name: string; nmls: string | null } | null;
  const company = t?.name ?? "R Parry Financial LLC";
  const address = process.env.BROADCAST_ADDRESS || "PO Box 100184, Fort Worth, TX 76185-0184";
  const website = process.env.BROADCAST_WEBSITE || "www.rparryfinancial.com";
  const phone = process.env.BROADCAST_PHONE || "682-250-7649";
  const nmls = t?.nmls ?? "1924318";
  const privacyUrl = process.env.BROADCAST_PRIVACY_URL || "https://rparryfinancial.com/wp-content/uploads/2025/08/Privacy-Notice.pdf";
  const footerLogoUrl = process.env.BROADCAST_FOOTER_LOGO || "/brand/rparry-logo.png";

  return (
    <div>
      <DashHeader title="Broadcasts" subtitle="Email your agents or your contact list — compose, preview, send"
        user={{ name: appUser.full_name ?? user.email ?? "", role: roleLabel(appUser.role) }}>
        <BackToDashboard />
      </DashHeader>
      <main>
        <BroadcastComposer
          agentCount={agentCount ?? 0}
          contactCount={contactCount}
          contactFields={contactFields}
          sendingEnabled={sendingEnabled()}
          initialBroadcasts={broadcasts}
          company={company}
          address={address}
          website={website}
          phone={phone}
          nmls={nmls}
          privacyUrl={privacyUrl}
          footerLogoUrl={footerLogoUrl}
        />
      </main>
    </div>
  );
}
