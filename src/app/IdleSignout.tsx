"use client";

import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

// Auto sign-off after inactivity — now app-wide. It only arms when there is a
// signed-in session, so anonymous buyers on the public pages are never affected;
// a signed-in staff member is watched everywhere (including "View site"). After
// IDLE_MS with no activity it shows a 1-minute "Still there?" warning, then signs
// out. Any activity (or the button) resets it.
const IDLE_MS = 15 * 60 * 1000; // 15 minutes of inactivity
const WARN_MS = 60 * 1000; // show the warning for the final minute

export function IdleSignout() {
  const [enabled, setEnabled] = useState(false);
  const [warning, setWarning] = useState(false);
  const [remaining, setRemaining] = useState(60);
  const lastActivity = useRef(Date.now());
  const warningRef = useRef(false);
  const signingOut = useRef(false);

  useEffect(() => {
    warningRef.current = warning;
  }, [warning]);

  // Arm only for a signed-in session; disarm on sign-out. Never touches buyers.
  useEffect(() => {
    const supabase = createSupabaseBrowser();
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setEnabled(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEnabled(!!session);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    lastActivity.current = Date.now();
    setWarning(false);

    async function signOut() {
      if (signingOut.current) return;
      signingOut.current = true;
      try {
        await fetch("/auth/signout", { method: "POST" });
      } catch {
        /* redirect regardless */
      }
      window.location.href = "/login?timeout=1";
    }

    const bump = () => {
      lastActivity.current = Date.now();
      if (warningRef.current) setWarning(false);
    };
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));

    const id = setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      if (idle >= IDLE_MS) {
        void signOut();
      } else if (idle >= IDLE_MS - WARN_MS) {
        if (!warningRef.current) setWarning(true);
        setRemaining(Math.max(0, Math.ceil((IDLE_MS - idle) / 1000)));
      }
    }, 1000);

    return () => {
      clearInterval(id);
      events.forEach((e) => window.removeEventListener(e, bump));
    };
  }, [enabled]);

  function stay() {
    lastActivity.current = Date.now();
    setWarning(false);
  }

  if (!enabled || !warning) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
    >
      <div style={{ background: "#fff", borderRadius: 12, padding: "22px 24px", maxWidth: 380,
        width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,.35)", textAlign: "center" }}>
        <h3 style={{ margin: "0 0 6px", color: "var(--primary)" }}>Still there?</h3>
        <p style={{ margin: "0 0 16px", color: "#475569", fontSize: 14 }}>
          You&apos;ll be signed out in <strong>{remaining}s</strong> due to inactivity.
        </p>
        <button onClick={stay} className="leadbtn" style={{ width: "100%" }}>
          Stay signed in
        </button>
      </div>
    </div>
  );
}
