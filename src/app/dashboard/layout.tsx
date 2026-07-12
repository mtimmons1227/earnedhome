import type { ReactNode } from "react";
import { IdleSignout } from "./IdleSignout";

// Wraps every /dashboard/* page. Mounts the idle auto sign-off watcher so any
// signed-in staff session (leads, agents, LOs, workbook) auto-locks after
// inactivity. Individual pages still enforce their own auth redirects.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <IdleSignout />
      {children}
    </>
  );
}
