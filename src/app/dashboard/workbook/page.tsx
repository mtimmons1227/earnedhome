import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { WorkbookSwap } from "./WorkbookSwap";

export const dynamic = "force-dynamic";

// Loan-officer / admin-only page: download the rate workbook, edit it, and
// upload it back to replace the live file in place.
export default async function WorkbookPage() {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: appUser } = await supabase
    .from("app_users")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!appUser || appUser.role !== "admin") redirect("/dashboard");

  return (
    <div>
      <header className="eh-header" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="eh-brand">Rate Workbook</div>
          <div className="eh-tag">{appUser.full_name ?? user.email} · Admin</div>
        </div>
        <a
          href="/dashboard"
          style={{
            color: "#fff", border: "1px solid rgba(255,255,255,.5)", borderRadius: 8,
            padding: "8px 12px", fontWeight: 600, textDecoration: "none",
          }}
        >
          ← Back to Dashboard
        </a>
      </header>
      <main style={{ maxWidth: 680, margin: "0 auto", padding: 16 }}>
        <WorkbookSwap />
      </main>
    </div>
  );
}
