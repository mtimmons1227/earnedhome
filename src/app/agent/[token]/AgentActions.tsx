"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AgentStage } from "@/lib/loSelect";

export interface BuyerRow {
  id: string;
  name: string;
  subtitle: string;
  stage: AgentStage;
}
export interface InviteRow {
  id: string;
  name: string;
  email: string | null;
}

const stageColor: Record<AgentStage, { bg: string; fg: string }> = {
  Connected: { bg: "#eef2f7", fg: "#1F3864" },
  "In process": { bg: "#e7f0fb", fg: "#1d4ed8" },
  Closed: { bg: "#e8f5e9", fg: "#15803d" },
  Inactive: { bg: "#f3f4f6", fg: "#6b7280" },
};

// The agent's whole workspace (no login — the token in the URL is the key):
// invite a buyer, and see the buyers you've referred with a plain status.
// Deliberately lighter than the LO dashboard — an agent has just two jobs.
export function AgentActions({ token, buyers, invites }: { token: string; buyers: BuyerRow[]; invites: InviteRow[] }) {
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
      setMsg(j.emailed ? "Invite sent." : "Invite created — email isn’t on in this environment yet.");
      setName("");
      setEmail("");
      router.refresh();
    } catch {
      setMsg("Something went wrong — please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff(shareId: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/agent/${token}/disable`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shareId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setMsg(j.error ?? "Could not turn it off.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const empty = buyers.length === 0 && invites.length === 0;

  return (
    <>
      <div className="panel" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0, marginBottom: 4 }}>Invite a buyer</h3>
        <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>Send them a link to run their numbers.</p>
        <form onSubmit={invite} style={{ display: "grid", gap: 8 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Buyer name" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" type="email" required />
          <button
            type="submit"
            disabled={busy}
            style={{ background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8,
              padding: "12px 16px", fontWeight: 600, fontSize: 15, cursor: "pointer" }}
          >
            Send link
          </button>
        </form>
        {msg && <div className="hint" style={{ marginTop: 8 }}>{msg}</div>}
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Your buyers</h3>
        {empty ? (
          <div className="hint">No buyers yet. Invite one above, or share your link.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {buyers.map((b) => {
              const c = stageColor[b.stage];
              return (
                <div key={b.id} style={rowStyle}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{b.name}</div>
                    {b.subtitle && <div style={subStyle}>{b.subtitle}</div>}
                  </div>
                  <span style={{ ...pillStyle, background: c.bg, color: c.fg }}>{b.stage}</span>
                </div>
              );
            })}
            {invites.map((iv) => (
              <div key={iv.id} style={rowStyle}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{iv.name || iv.email || "A buyer"}</div>
                  <div style={subStyle}>Invited · waiting to run numbers</div>
                </div>
                <button type="button" onClick={() => turnOff(iv.id)} disabled={busy} style={turnOffStyle}>
                  Turn off
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

const rowStyle: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 10,
  border: "1px solid var(--line)", borderRadius: 10, padding: "12px 14px",
};
const subStyle: React.CSSProperties = { color: "var(--muted)", fontSize: 12, marginTop: 2, wordBreak: "break-word" };
const pillStyle: React.CSSProperties = { fontWeight: 700, fontSize: 13, borderRadius: 999, padding: "4px 12px", whiteSpace: "nowrap" };
const turnOffStyle: React.CSSProperties = { fontSize: 13, color: "var(--muted)", background: "none", border: "none", padding: "4px 6px", cursor: "pointer" };
