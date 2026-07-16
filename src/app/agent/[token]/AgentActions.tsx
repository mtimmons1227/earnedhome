"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AgentStage } from "@/lib/loSelect";

export interface BuyerRow {
  id: string;
  name: string;
  subtitle: string;
  stage: AgentStage;
  shareId: string | null;   // the buyer's link, when they came via one
  shareActive: boolean;     // whether that link is currently on
}
export interface InviteRow {
  id: string;
  name: string;
  email: string | null;
  active: boolean;
}

const stageColor: Record<AgentStage, { bg: string; fg: string }> = {
  Connected: { bg: "#eef2f7", fg: "#1F3864" },
  "In process": { bg: "#e7f0fb", fg: "#1d4ed8" },
  Closed: { bg: "#e8f5e9", fg: "#15803d" },
  Inactive: { bg: "#f3f4f6", fg: "#6b7280" },
};

// The agent's whole workspace (no login — the token in the URL is the key):
// invite a buyer, see the buyers you've referred with a plain status, and turn
// any buyer's link on or off. Deliberately lighter than the LO dashboard.
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

  async function toggle(shareId: string, active: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/agent/${token}/toggle`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shareId, active }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setMsg(j.error ?? "Could not update that link.");
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
                <div key={b.id} style={rowStyle(b.shareId != null && !b.shareActive)}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{b.name}</div>
                    {b.subtitle && <div style={subStyle}>{b.subtitle}</div>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <span style={{ ...pillStyle, background: c.bg, color: c.fg }}>{b.stage}</span>
                    {b.shareId && (
                      <ToggleButton active={b.shareActive} busy={busy} onClick={() => toggle(b.shareId as string, !b.shareActive)} />
                    )}
                  </div>
                </div>
              );
            })}
            {invites.map((iv) => (
              <div key={iv.id} style={rowStyle(!iv.active)}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{iv.name || iv.email || "A buyer"}</div>
                  <div style={subStyle}>{iv.active ? "Invited · waiting to run numbers" : "Invited · turned off"}</div>
                </div>
                <ToggleButton active={iv.active} busy={busy} onClick={() => toggle(iv.id, !iv.active)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function ToggleButton({ active, busy, onClick }: { active: boolean; busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      style={{
        fontSize: 12, fontWeight: 600, cursor: "pointer", borderRadius: 6, padding: "4px 12px",
        border: active ? "1px solid #e6a1a1" : "1px solid #a9d8ba",
        background: active ? "#fbe6e6" : "#e7f6ec",
        color: active ? "#b91c1c" : "#15803d",
      }}
    >
      {active ? "Turn off" : "Turn on"}
    </button>
  );
}

const rowStyle = (off: boolean): React.CSSProperties => ({
  display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 10,
  border: "1px solid var(--line)", borderRadius: 10, padding: "12px 14px",
  opacity: off ? 0.6 : 1,
});
const subStyle: React.CSSProperties = { color: "var(--muted)", fontSize: 12, marginTop: 2, wordBreak: "break-word" };
const pillStyle: React.CSSProperties = { fontWeight: 700, fontSize: 13, borderRadius: 999, padding: "4px 12px", whiteSpace: "nowrap" };
