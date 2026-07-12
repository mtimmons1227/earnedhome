import type { ReactNode } from "react";

// Shared internal (staff) page header: the EarnedHome logo, a page title/subtitle,
// and a right-hand slot for navigation (e.g. a consistent "← Dashboard" button).
// Used across /dashboard, /dashboard/agents, /dashboard/los, /dashboard/workbook.
export function DashHeader({
  title,
  subtitle,
  user,
  children,
}: {
  title: string;
  subtitle?: string;
  user?: { name: string; role: string };
  children?: ReactNode;
}) {
  return (
    <header className="eh-header" style={{ justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/earnedhome-logo-white.png" alt="EarnedHome" style={{ height: 34, width: "auto" }} />
        <div style={{ minWidth: 0 }}>
          <div className="eh-brand">{title}</div>
          {subtitle && <div className="eh-tag">{subtitle}</div>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {user && (
          <span style={{ color: "#dbe4f0", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
            marginRight: 4, opacity: 0.95 }}>
            Signed in: {user.name} · {user.role}
          </span>
        )}
        {children}
      </div>
    </header>
  );
}

// "lo" -> "LO"; other roles title-cased (Admin, Staff).
export function roleLabel(role: string): string {
  return role === "lo" ? "LO" : role.charAt(0).toUpperCase() + role.slice(1);
}

// The single, consistent back-to-dashboard control used on every sub-page.
export function BackToDashboard() {
  return (
    <a href="/dashboard" className="navbtn">← Dashboard</a>
  );
}
