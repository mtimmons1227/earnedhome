"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface InviteRow {
  id: string;
  recipient_name: string | null;
  recipient_email: string | null;
  created_at: string;
}

// Agent-portal actions (no login — the token in the URL is the credential):
// invite a buyer by email, and disable any invite link the agent sent.
export function AgentActions({ token, invites }: { token: string; invites: InviteRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/agent/${token}/invite`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(j.error ?? "Could not send the invite.");
        return;
      }
      setMsg(j.emailed ? "Invite sent." : "Invite created (email isn’t configured yet).");
      setName("");
      setEmail("");
      router.refresh();
    } catch {
      setMsg("Something went wrong — please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disable(id: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/agent/${token}/disable`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shareId: id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setMsg(j.error ?? "Could not disable that link.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <h3 style={{ marginTop: 0 }}>Invite a buyer</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        Send a buyer their own link to run the numbers. You can turn any link off later.
      </p>
      <form onSubmit={invite} style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr auto", alignItems: "center" }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Buyer name (optional)" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Buyer email" type="email" required />
        <button type="submit" disabled={busy}>Send link</button>
      </form>
      {msg && <div className="hint" style={{ marginTop: 8 }}>{msg}</div>}

      {invites.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Invited — waiting to run numbers</div>
          <div style={{ display: "grid", gap: 6 }}>
            {invites.map((iv) => (
              <div
                key={iv.id}
                style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 10,
                  border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px" }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{iv.recipient_name || iv.recipient_email || "A buyer"}</div>
                  {iv.recipient_email && (
                    <div style={{ color: "var(--muted)", fontSize: 12, wordBreak: "break-word" }}>{iv.recipient_email}</div>
                  )}
                </div>
                <button type="button" onClick={() => disable(iv.id)} disabled={busy} style={{ fontSize: 13 }}>
                  Disable link
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
