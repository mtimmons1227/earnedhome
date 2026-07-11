"use client";

import { useEffect, useState } from "react";

interface Agent {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  slug: string;
  active: boolean;
  status_token?: string | null;
  invite_sent_at?: string | null;
  created_at?: string;
}

type Filter = "all" | "active" | "off";

// Format a US 10-digit number as (XXX) XXX-XXXX; leave anything else as-is.
function formatPhone(raw: string | null): string {
  if (!raw) return "";
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === "1") return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return raw;
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
  const [copiedStatusId, setCopiedStatusId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);

  const [filter, setFilter] = useState<Filter>("all");

  // Inline edit state.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

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
      setAgents((prev) => prev.map((x) => (x.id === a.id ? { ...x, active: a.active } : x)));
    }
  }

  function startEdit(a: Agent) {
    setEditingId(a.id);
    setEditName(a.name);
    setEditEmail(a.email ?? "");
    setEditPhone(a.phone ?? "");
    setErr(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(a: Agent) {
    if (!editName.trim() || savingEdit) return;
    setSavingEdit(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/agents/${a.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          email: editEmail.trim() || null,
          phone: editPhone.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save changes");
      // Merge returned fields; keep invite_sent_at (PATCH doesn't return it).
      setAgents((prev) => prev.map((x) => (x.id === a.id ? { ...x, ...data.agent } : x)));
      setEditingId(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSavingEdit(false);
    }
  }

  function copyLink(a: Agent) {
    const link = `${origin}/a/${a.slug}`;
    void navigator.clipboard.writeText(link);
    setCopiedId(a.id);
    setTimeout(() => setCopiedId((c) => (c === a.id ? null : c)), 1500);
  }

  // The agent's private status portal link (/agent/<token>) — where they see the
  // status of the buyers they referred. Secret + revocable (turning the seat off
  // blocks it). Different from the public /a/<slug> share link.
  function copyStatusLink(a: Agent) {
    if (!a.status_token) return;
    void navigator.clipboard.writeText(`${origin}/agent/${a.status_token}`);
    setCopiedStatusId(a.id);
    setTimeout(() => setCopiedStatusId((c) => (c === a.id ? null : c)), 1500);
  }

  // Send the agent their link via the app (Resend) — one click, no mail client.
  async function emailLink(a: Agent) {
    if (!a.email || sendingId === a.id) return;
    setSendingId(a.id);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/agents/${a.id}/invite`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ origin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send");
      const at = data.invite_sent_at ?? new Date().toISOString();
      setAgents((prev) => prev.map((x) => (x.id === a.id ? { ...x, invite_sent_at: at } : x)));
      setSentId(a.id);
      setTimeout(() => setSentId((c) => (c === a.id ? null : c)), 2000);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSendingId(null);
    }
  }

  const activeCount = agents.filter((a) => a.active).length;
  const visible =
    filter === "active" ? agents.filter((a) => a.active)
    : filter === "off" ? agents.filter((a) => !a.active)
    : agents;

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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
          gap: 8, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0 }}>Agents ({activeCount} active · {agents.length} total)</h3>
          <label style={{ fontSize: 13, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
            Show:
            <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}
              style={{ padding: "6px 8px", fontSize: 13 }}>
              <option value="all">All</option>
              <option value="active">Active only</option>
              <option value="off">Turned off</option>
            </select>
          </label>
        </div>

        {loading ? (
          <div className="hint" style={{ marginTop: 12 }}>Loading…</div>
        ) : agents.length === 0 ? (
          <div className="hint" style={{ marginTop: 12 }}>No agents yet. Add one above to generate a share link.</div>
        ) : visible.length === 0 ? (
          <div className="hint" style={{ marginTop: 12 }}>No agents in this view.</div>
        ) : (
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {visible.map((a) => {
              const link = `${origin}/a/${a.slug}`;
              const editing = editingId === a.id;
              return (
                <div key={a.id} style={{ display: "grid",
                  gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center",
                  border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px",
                  opacity: a.active || editing ? 1 : 0.55 }}>
                  {editing ? (
                    <>
                      <div style={{ display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
                        <label style={fieldLabel}>Name*
                          <input value={editName} onChange={(e) => setEditName(e.target.value)} style={input} />
                        </label>
                        <label style={fieldLabel}>Email
                          <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} type="email" style={input} />
                        </label>
                        <label style={fieldLabel}>Phone
                          <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} style={input} />
                        </label>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <button onClick={() => saveEdit(a)} disabled={savingEdit || !editName.trim()}
                          style={{ ...smallBtn, ...onBtn }}>{savingEdit ? "Saving…" : "Save"}</button>
                        <button onClick={cancelEdit} style={smallBtn}>Cancel</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700 }}>
                          {a.name}
                          {!a.active && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700,
                            color: "var(--muted)", border: "1px solid var(--line)", borderRadius: 6,
                            padding: "1px 6px" }}>SEAT OFF</span>}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>
                          {[a.email, formatPhone(a.phone)].filter(Boolean).join(" · ") || "No contact info"}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {link}
                        </div>
                        {a.invite_sent_at && (
                          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                            ✓ Link sent {new Date(a.invite_sent_at).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <button onClick={() => copyLink(a)} style={smallBtn}>
                          {copiedId === a.id ? "Copied!" : "Copy link"}
                        </button>
                        {a.status_token && (
                          <button onClick={() => copyStatusLink(a)} style={smallBtn}>
                            {copiedStatusId === a.id ? "Copied!" : "Status link"}
                          </button>
                        )}
                        {a.email && (
                          <button onClick={() => emailLink(a)} disabled={sendingId === a.id} style={smallBtn}>
                            {sentId === a.id ? "Sent!" : sendingId === a.id ? "Sending…" : "Email link"}
                          </button>
                        )}
                        <button onClick={() => startEdit(a)} style={smallBtn}>Edit</button>
                        <button onClick={() => toggleActive(a)}
                          style={{ ...smallBtn, ...(a.active ? offBtn : onBtn) }}>
                          {a.active ? "Turn off" : "Turn on"}
                        </button>
                      </div>
                    </>
                  )}
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
// Toggle colors: red = the button turns the seat OFF (agent is active);
// green = the button turns it ON (agent is currently off).
const offBtn: React.CSSProperties = { background: "#dc2626", color: "#fff", border: "1px solid #dc2626" };
const onBtn: React.CSSProperties = { background: "#16a34a", color: "#fff", border: "1px solid #16a34a" };
