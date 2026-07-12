"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Quietly re-fetches the server-rendered status portal on an interval so a
// referral agent sees status changes without manually reloading. Uses
// router.refresh() (re-runs the server component + its fresh no-store reads)
// rather than a full page reload, so there's no flash. Only polls while the tab
// is visible to avoid needless traffic in a backgrounded tab.
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, Math.max(5, seconds) * 1000);
    // Also refresh immediately when the agent returns to the tab.
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, seconds]);
  return null;
}
