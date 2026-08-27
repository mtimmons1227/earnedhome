import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { DashHeader, BackToDashboard, roleLabel } from "../DashHeader";
import { ContactsManager } from "./ContactsManager";

export const dynamic = "force-dynamic";

// Broker-admin page: the recipient list for Broadcasts. Import a spreadsheet once,
// then add/edit/remove contacts here. Admin-only.
export default async function ContactsPage() {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: appUser } = await supabase
    .from("app_users").select("tenant_id, role, full_name").eq("id", user.id).maybeSingle();

  if (!appUser || appUser.role !== "admin") redirect("/dashboard");

  return (
    <div>
      <DashHeader title="Contacts" subtitle="Your broadcast recipient list — import once, manage here"
        user={{ name: appUser.full_name ?? user.email ?? "", role: roleLabel(appUser.role) }}>
        <a href="/dashboard/broadcasts" className="navbtn">Broadcast</a>
        <BackToDashboard />
      </DashHeader>
      <main>
        <ContactsManager />
      </main>
    </div>
  );
}
