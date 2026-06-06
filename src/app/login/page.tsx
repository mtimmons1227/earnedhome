"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  return (
    <main style={{ maxWidth: 380, margin: "8vh auto", padding: 16 }}>
      <div className="panel">
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
          {error && (
            <div className="errbox" style={{ marginTop: 12 }}>{error}</div>
          )}
          <button className="leadbtn" type="submit" disabled={busy} style={{ marginTop: 16 }}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
