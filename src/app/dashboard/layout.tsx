import type { ReactNode } from "react";

// The idle auto sign-off now lives app-wide in the root layout (src/app/layout.tsx),
// gated on a signed-in session, so it covers every page a staff member visits
// (including "View site") without affecting anonymous buyers. This layout is a
// simple pass-through.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
