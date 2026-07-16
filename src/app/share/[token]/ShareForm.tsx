"use client";

import { useState } from "react";

// The buyer's "modal" for sending a friend the estimate. They enter the friend's
// email; we email that friend the /r estimate link. The friend can run it or
// forward it to anyone — every completion routes up the same agent/LO chain.
export function ShareForm({ token, estimateUrl }: { token: string; estimateUrl: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setSent(null);
    try {
      const res = await fetch("/api/share/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, name, email }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(j.error ?? "Could not send it — please try again.");
        return;
      }
      setSent(j.emailed ? `Sent to ${email}. Share with someone else?` : "Saved — email isn’t on in this environment yet.");
      setName("");
      setEmail("");
    } catch {
      setErr("Something went wrong — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h2 style={{ marginTop: 0, color: "var(--primary)" }}>Share with a friend</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        Know someone else house-hunting? Send them the estimate — they can run their own numbers,
        no credit pull and no obligation. They can forward it to anyone, too.
      </p>
      <form onSubmit={send} style={{ display: "grid", gap: 8 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Friend’s name (optional)" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@email.com" type="email" required />
        <button
          type="submit"
          disabled={busy}
          style={{ background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8,
            padding: "12px 16px", fontWeight: 600, fontSize: 15, cursor: "pointer" }}
        >
          {busy ? "Sending…" : "Send the estimate"}
        </button>
      </form>
      {sent && <div className="hint" style={{ marginTop: 10, color: "#15803d" }}>{sent}</div>}
      {err && <div className="hint" style={{ marginTop: 10, color: "#b91c1c" }}>{err}</div>}
      <p style={{ marginTop: 14, fontSize: 13 }}>
        <a href={estimateUrl} style={{ color: "var(--primary)", fontWeight: 600 }}>Or open the estimate yourself →</a>
      </p>
    </div>
  );
}
