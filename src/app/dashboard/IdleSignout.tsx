"use client";

import { useEffect, useRef, useState } from "react";

// Auto sign-off after a period of inactivity (security for a lender tool that
// shows borrower data). Watches for real user activity; after IDLE_MS with none,
// it shows a 1-minute "Still there?" warning, and if still idle, signs the user
// out and returns them to the login page. Any activity (or the button) resets it.
const IDLE_MS = 15 * 60 * 1000; // 15 minutes of inactivity
const WARN_MS = 60 * 1000; // show the warning for the final minute

export function IdleSignout() {
  const [warning, setWarning] = useState(false);
  const [remaining, setRemaining] = useState(60);
  const lastActivity = useRef(Date.now());
  const warningRef = useRef(false);
  const signingOut = useRef(false);

  useEffect(() => {
    warningRef.current = warning;
  }, [warning]);

  useEffect(() => {
    async function signOut() {
      if (signingOut.current) return;
      signingOut.current = true;
      try {
        await fetch("/auth/signout", { method: "POST" });
      } catch {
        /* fall through to redirect regardless */
      }
      window.location.href = "/login?timeout=1";
    }

    // Any genuine activity resets the idle clock (and dismisses the warning).
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
  }, []);

  function stay() {
    lastActivity.current = Date.now();
    setWarning(false);
  }

  if (!warning) return null;

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
