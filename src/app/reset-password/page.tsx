"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

// Where the password-reset email link lands. The Supabase browser client
// auto-processes the recovery code in the URL and establishes a short-lived
// recovery session; the user then sets a new password.
export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [sessionOk, setSessionOk] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSessionOk(true);
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessionOk(true);
      setReady(true);
    });
    const t = setTimeout(() => setReady(true), 2000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError(
        /session|auth/i.test(error.message)
          ? "This reset link is invalid or has expired. Please request a new one from the sign-in page."
          : error.message,
      );
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1200);
  }

  return (
    <main style={{ maxWidth: 380, margin: "8vh auto", padding: 16 }}>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Set a new password</h2>
        {!ready ? (
          <p className="hint">Verifying your reset link…</p>
        ) : done ? (
          <p style={{ color: "#0f6e56", fontWeight: 600 }}>
            Password updated. Taking you to your dashboard…
          </p>
        ) : (
          <>
            {!sessionOk && (
              <div className="errbox" style={{ marginBottom: 12 }}>
                We couldn&apos;t verify your reset link. If saving fails, request a new link
                from the sign-in page (and open it in this same browser).
              </div>
            )}
            <form onSubmit={submit}>
              <label>New password</label>
              <input type="password" value={password} autoComplete="new-password"
                onChange={(e) => setPassword(e.target.value)} required />
              <div className="spacer" />
              <label>Confirm password</label>
              <input type="password" value={confirm} autoComplete="new-password"
                onChange={(e) => setConfirm(e.target.value)} required />
              {error && <div className="errbox" style={{ marginTop: 12 }}>{error}</div>}
              <button className="leadbtn" type="submit" disabled={busy} style={{ marginTop: 16 }}>
                {busy ? "Saving…" : "Update password"}
              </button>
            </form>
            <a href="/login" style={{ display: "inline-block", marginTop: 14,
              color: "var(--primary)", fontWeight: 600, fontSize: 13 }}>← Back to sign in</a>
          </>
        )}
      </div>
    </main>
  );
}
