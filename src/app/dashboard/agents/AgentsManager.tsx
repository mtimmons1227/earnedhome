"use client";

import { useEffect, useState } from "react";

interface Agent {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  slug: string;
  active: boolean;
  created_at?: string;
}

export function AgentsManager() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [adding, setAdding] = useState(false);

  const [origin, setOrigin] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/agents");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load agents");
      setAgents(data.agents ?? []);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function addAgent(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || adding) return;
    setAdding(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() || undefined, phone: phone.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add agent");
      setAgents((prev) => [data.agent, ...prev]);
      setName(""); setEmail(""); setPhone("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function toggleActive(a: Agent) {
    setErr(null);
    // optimistic
    setAgents((prev) => prev.map((x) => (x.id === a.id ? { ...x, active: !x.active } : x)));
    try {
      const res = await fetch(`/api/admin/agents/${a.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: !a.active }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Could not update agent");
      }
    } catch (e) {
      setErr((e as Error).message);
      // revert
      setAgents((prev) => prev.map((x) => (x.id === a.id ? { ...x, active: a.active } : x)));
    }
  }

  function copyLink(a: Agent) {
    const link = `${origin}/a/${a.slug}`;
    void navigator.clipboard.writeText(link);
    setCopiedId(a.id);
    setTimeout(() => setCopiedId((c) => (c === a.id ? null : c)), 1500);
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Add an agent</h3>
        <p className="hint" style={{ marginTop: 0 }}>
          Each agent gets a unique link. Buyers who run an estimate from that link are tagged to
          the agent, and the agent gets a copy of the lead. Turn a seat off to revoke the link.
        </p>
        <form onSubmit={addAgent} style={{ display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, alignItems: "end" }}>
          <label style={fieldLabel}>Name*
            <input value={name} onChange={(e) => setName(e.target.value)} required
              placeholder="Jane Realtor" style={input} />
          </label>
          <label style={fieldLabel}>Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
              placeholder="jane@brokerage.com" style={input} />
          </label>
          <label style={fieldLabel}>Phone
            <input value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 555-1234" style={input} />
          </label>
          <button className="leadbtn" type="submit" disabled={adding || !name.trim()}
            style={{ height: 40 }}>{adding ? "Adding…" : "Add agent"}</button>
        </form>
        {err && <div style={{ color: "#b91c1c", marginTop: 10, fontSize: 13 }}>{err}</div>}
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Agents ({agents.length})</h3>
        {loading ? (
          <div className="hint">Loading…</div>
        ) : agents.length === 0 ? (
          <div className="hint">No agents yet. Add one above to generate a share link.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {agents.map((a) => {
              const link = `${origin}/a/${a.slug}`;
              return (
                <div key={a.id} style={{ display: "grid",
                  gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center",
                  border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px",
                  opacity: a.active ? 1 : 0.55 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>
                      {a.name}
                      {!a.active && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700,
                        color: "var(--muted)", border: "1px solid var(--line)", borderRadius: 6,
                        padding: "1px 6px" }}>SEAT OFF</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      {[a.email, a.phone].filter(Boolean).join(" · ") || "No contact info"}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {link}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button onClick={() => copyLink(a)} style={smallBtn}>
                      {copiedId === a.id ? "Copied!" : "Copy link"}
                    </button>
                    <button onClick={() => toggleActive(a)} style={smallBtn}>
                      {a.active ? "Turn off" : "Turn on"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const fieldLabel: React.CSSProperties = {
  display: "grid", gap: 4, fontSize: 12, fontWeight: 600, color: "var(--muted)",
};
const input: React.CSSProperties = {
  padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)",
  fontSize: 14, fontWeight: 400, color: "var(--text, #111)",
};
const smallBtn: React.CSSProperties = {
  background: "transparent", border: "1px solid var(--line)", borderRadius: 8,
  padding: "6px 10px", cursor: "pointer", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap",
};
