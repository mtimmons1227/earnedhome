"use client";

import { useEffect, useState } from "react";

interface LO {
  id: string;
  full_name: string | null;
  email: string | null;
  nmls: string | null;
  phone: string | null;
  role: string;
  is_primary: boolean;
  active: boolean;
  invite_sent_at: string | null;
  created_at: string;
}

// Pretty-print a US phone number for display (matches the Agents page).
function formatPhone(raw: string | null): string {
  if (!raw) return "";
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === "1") return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return raw;
}

export function LosManager() {
  const [los, setLos] = useState<LO[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // add form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [nmls, setNmls] = useState("");
  const [phone, setPhone] = useState("");
  const [adding, setAdding] = useState(false);

  // inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editNmls, setEditNmls] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // send sign-in link
  const [origin, setOrigin] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    void load();
  }, []);

  async function sendInvite(id: string) {
    setSendingId(id);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/los/${id}/invite`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ origin }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not send link");
      setSentId(id);
      setTimeout(() => setSentId(null), 3000);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSendingId(null);
    }
  }

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/los");
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed to load");
      setLos(j.los ?? []);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function addLo(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setAdding(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/los", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fullName: name, email, nmls, phone }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not add loan officer");
      setName("");
      setEmail("");
      setNmls("");
      setPhone("");
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setErr(null);
    try {
      const res = await fetch(`/api/admin/los/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Update failed");
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  function startEdit(lo: LO) {
    setEditingId(lo.id);
    setEditName(lo.full_name ?? "");
    setEditEmail(lo.email ?? "");
    setEditNmls(lo.nmls ?? "");
    setEditPhone(lo.phone ?? "");
  }
  async function saveEdit(id: string) {
    setSavingEdit(true);
    await patch(id, { fullName: editName, email: editEmail, nmls: editNmls, phone: editPhone });
    setSavingEdit(false);
    setEditingId(null);
  }

  const activeCount = los.filter((l) => l.active).length;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Add a loan officer</h3>
        <p className="hint" style={{ marginTop: 0 }}>
          Each LO gets their own login and sees their own leads and agents. New LOs are added as a
          record + login (no email yet) — set their password from Supabase or a reset to activate.
          Use “Make primary” to choose who receives leads that don’t come through a specific agent.
        </p>
        <form onSubmit={addLo} style={{ display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, alignItems: "end" }}>
          <label style={fieldLabel}>Name*
            <input value={name} onChange={(e) => setName(e.target.value)} required
              placeholder="Jane Officer" style={input} />
          </label>
          <label style={fieldLabel}>Email*
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required
              placeholder="jane@rparryfinancial.com" style={input} />
          </label>
          <label style={fieldLabel}>NMLS
            <input value={nmls} onChange={(e) => setNmls(e.target.value)}
              placeholder="1234567" style={input} />
          </label>
          <label style={fieldLabel}>Phone
            <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel"
              placeholder="(555) 555-1234" style={input} />
          </label>
          <button className="leadbtn" type="submit" disabled={adding || !name.trim() || !email.trim()}
            style={{ height: 40 }}>{adding ? "Adding…" : "Add loan officer"}</button>
        </form>
        {err && <div style={{ color: "#b91c1c", marginTop: 10, fontSize: 13 }}>{err}</div>}
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>
          Loan officers ({activeCount} active · {los.length} total)
        </h3>
        {loading ? (
          <div className="hint">Loading…</div>
        ) : los.length === 0 ? (
          <div className="hint">No loan officers yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {los.map((lo) => (
              <div key={lo.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10,
                alignItems: "center", border: "1px solid var(--line)", borderRadius: 10, padding: 12 }}>
                {editingId === lo.id ? (
                  <div style={{ gridColumn: "1 / -1", display: "grid", gap: 8 }}>
                    <div style={{ display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
                      <label style={fieldLabel}>Name
                        <input value={editName} onChange={(e) => setEditName(e.target.value)} style={input} />
                      </label>
                      <label style={fieldLabel}>Email
                        <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} type="email" style={input} />
                      </label>
                      <label style={fieldLabel}>NMLS
                        <input value={editNmls} onChange={(e) => setEditNmls(e.target.value)} style={input} />
                      </label>
                      <label style={fieldLabel}>Phone
                        <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} type="tel" style={input} />
                      </label>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={smallBtn} onClick={() => saveEdit(lo.id)} disabled={savingEdit}>
                        {savingEdit ? "Saving…" : "Save"}
                      </button>
                      <button style={smallBtn} onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <div style={{ fontWeight: 700 }}>
                        {lo.full_name || "(no name)"}
                        {lo.is_primary && <span style={badgePrimary}>Primary</span>}
                        {lo.role === "admin" && <span style={badgeAdmin}>Broker admin</span>}
                        {!lo.active && <span style={badgeOff}>Off</span>}
                      </div>
                      <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 2 }}>
                        {lo.email}{lo.nmls ? ` · NMLS ${lo.nmls}` : ""}{lo.phone ? ` · ${formatPhone(lo.phone)}` : ""}
                      </div>
                      {lo.invite_sent_at && (
                        <div style={{ color: "#15803d", fontSize: 12, marginTop: 2 }}>
                          ✓ Sign-in link sent {new Date(lo.invite_sent_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {lo.email && (
                        <button style={smallBtn} onClick={() => sendInvite(lo.id)} disabled={sendingId === lo.id}>
                          {sendingId === lo.id ? "Sending…" : sentId === lo.id ? "Sent ✓" : "Email link"}
                        </button>
                      )}
                      {!lo.is_primary && (
                        <button style={smallBtn} onClick={() => patch(lo.id, { isPrimary: true })}>Make primary</button>
                      )}
                      <button style={smallBtn} onClick={() => startEdit(lo)}>Edit</button>
                      <button
                        style={{ ...smallBtn, color: lo.active ? "#b91c1c" : "#15803d",
                          borderColor: lo.active ? "#b91c1c" : "#15803d" }}
                        onClick={() => patch(lo.id, { active: !lo.active })}
                      >
                        {lo.active ? "Turn off" : "Turn on"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
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
const badgeBase: React.CSSProperties = {
  fontSize: 12, borderRadius: 6, padding: "2px 8px", marginLeft: 6, fontWeight: 600,
};
const badgePrimary: React.CSSProperties = { ...badgeBase, background: "#1F3864", color: "#fff" };
const badgeAdmin: React.CSSProperties = { ...badgeBase, background: "#eef2f7", color: "#1F3864" };
const badgeOff: React.CSSProperties = { ...badgeBase, background: "#fbe9e7", color: "#b91c1c" };
