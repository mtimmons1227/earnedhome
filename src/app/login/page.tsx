"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

type Mode = "signin" | "reset";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // If the auth callback bounced us back with an expired/used reset link, open
  // the reset form and explain. Read from window (no useSearchParams → no
  // Suspense boundary needed for this client page).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reset = params.get("reset");
    if (reset === "expired") {
      setMode("reset");
      setError("That reset link was invalid or expired. Request a new one below.");
    } else if (reset === "success") {
      setMode("signin");
      setInfo("Your password was updated. Please sign in with your new password.");
    } else if (params.get("timeout") === "1") {
      setMode("signin");
      setInfo("You were signed out after 15 minutes of inactivity. Please sign in again.");
    } else if (params.get("disabled") === "1") {
      setMode("signin");
      setError("This account has been turned off. Please contact your broker administrator.");
    }
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setInfo(
      "If that email has an account, a password reset link is on its way. Check your inbox (and spam).",
    );
  }

  return (
    <main style={{ maxWidth: 380, margin: "8vh auto", padding: 16 }}>
      <div className="panel">
        {mode === "signin" ? (
          <>
            <h2 style={{ marginTop: 0 }}>Loan officer sign in</h2>
            <p className="hint">EarnedHome — Pathfinder back office.</p>
            <form onSubmit={signIn}>
              <label>Email</label>
              <input type="email" inputMode="email" value={email} autoComplete="username"
                onChange={(e) => setEmail(e.target.value)} required />
              <div className="spacer" />
              <label>Password</label>
              <input type="password" value={password} autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)} required />
              {error && <div className="errbox" style={{ marginTop: 12 }}>{error}</div>}
              {info && (
                <div style={{ marginTop: 12, fontSize: 13, color: "#0f6e56",
                  background: "#e7f7f0", padding: "10px 12px", borderRadius: 8 }}>{info}</div>
              )}
              <button className="leadbtn" type="submit" disabled={busy} style={{ marginTop: 16 }}>
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </form>
            {process.env.NEXT_PUBLIC_ENABLE_PASSWORD_RESET === "true" && (
              <button type="button" onClick={() => { setMode("reset"); setError(null); setInfo(null); }}
                style={linkBtn}>Forgot password?</button>
            )}
          </>
        ) : (
          <>
            <h2 style={{ marginTop: 0 }}>Reset your password</h2>
            <p className="hint">Enter your email and we&apos;ll send a reset link.</p>
            <form onSubmit={sendReset}>
              <label>Email</label>
              <input type="email" inputMode="email" value={email} autoComplete="username"
                onChange={(e) => setEmail(e.target.value)} required />
              {error && <div className="errbox" style={{ marginTop: 12 }}>{error}</div>}
              {info && (
                <div style={{ marginTop: 12, fontSize: 13, color: "#0f6e56",
                  background: "#e7f7f0", padding: "10px 12px", borderRadius: 8 }}>{info}</div>
              )}
              <button className="leadbtn" type="submit" disabled={busy} style={{ marginTop: 16 }}>
                {busy ? "Sending…" : "Send reset link"}
              </button>
            </form>
            <button type="button" onClick={() => { setMode("signin"); setError(null); setInfo(null); }}
              style={linkBtn}>← Back to sign in</button>
          </>
        )}
      </div>
    </main>
  );
}

const linkBtn: React.CSSProperties = {
  marginTop: 14, background: "none", border: "none", color: "var(--primary)",
  fontWeight: 600, cursor: "pointer", fontSize: 13, textDecoration: "underline", padding: 0,
};
