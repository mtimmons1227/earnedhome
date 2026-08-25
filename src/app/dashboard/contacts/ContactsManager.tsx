"use client";

import { useEffect, useRef, useState } from "react";

interface Contact {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  fields: Record<string, unknown>;
  status: string;
}

// Minimal RFC-4180-ish CSV parser: handles quoted fields, embedded commas, and
// doubled quotes. Returns array of row objects keyed by the header row.
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "", row: string[] = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\r") { /* ignore */ }
    else if (ch === "\n") { row.push(field); rows.push(row); field = ""; row = []; }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.some((c) => c.trim() !== "")).map((r) => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => { o[h] = (r[i] ?? "").trim(); });
    return o;
  });
}

export function ContactsManager() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [email, setEmail] = useState(""); const [first, setFirst] = useState(""); const [last, setLast] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { void load(); }, []);

  async function load(search = "") {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/contacts${search ? `?q=${encodeURIComponent(search)}` : ""}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Could not load contacts");
      setContacts(j.contacts ?? []); setActive(j.active ?? 0);
    } catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true); setMsg(null); setErr(null);
    try {
      const text = await f.text();
      const rows = parseCsv(text);
      if (!rows.length) throw new Error("No rows found. Make sure the file has a header row with an Email column.");
      const res = await fetch("/api/admin/contacts/import", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ rows, source: `import ${f.name}` }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Import failed");
      setMsg(`Imported ${j.imported} contact${j.imported === 1 ? "" : "s"}${j.skipped ? ` · skipped ${j.skipped} without a valid email` : ""}.`);
      await load(q);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function addOne(e: React.FormEvent) {
    e.preventDefault(); if (!email.trim() || busy) return;
    setBusy(true); setErr(null); setMsg(null);
    try {
      const res = await fetch("/api/admin/contacts", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), first_name: first.trim(), last_name: last.trim() }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Could not add");
      setEmail(""); setFirst(""); setLast(""); await load(q);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function remove(id: string) {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    await fetch(`/api/admin/contacts/${id}`, { method: "DELETE" });
    void load(q);
  }

  const input: React.CSSProperties = { width: "100%", padding: "9px 11px", border: "1px solid var(--line)", borderRadius: 8, fontSize: 14 };
  const label: React.CSSProperties = { display: "grid", gap: 4, fontSize: 12, color: "var(--muted)", fontWeight: 600 };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="panel">
        <h3 style={{ marginTop: 0, marginBottom: 4 }}>Import contacts</h3>
        <p className="hint" style={{ marginTop: 0 }}>
          Upload a CSV with a header row. An <b>Email</b> column is required; <b>First name</b> / <b>Last name</b> and any
          other columns are saved as merge fields you can use in a broadcast. Re-importing updates existing contacts (no duplicates).
        </p>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} disabled={busy} />
        {msg && <div style={{ color: "#15803d", marginTop: 10, fontSize: 13 }}>{msg}</div>}
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Add a contact</h3>
        <form onSubmit={addOne} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, alignItems: "end" }}>
          <label style={label}>Email*<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="name@email.com" style={input} /></label>
          <label style={label}>First name<input value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Jane" style={input} /></label>
          <label style={label}>Last name<input value={last} onChange={(e) => setLast(e.target.value)} placeholder="Doe" style={input} /></label>
          <button type="submit" disabled={busy || !email.trim()} style={{ background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, padding: "11px 16px", fontWeight: 600, cursor: "pointer", height: 40 }}>Add</button>
        </form>
        {err && <div style={{ color: "#b91c1c", marginTop: 10, fontSize: 13 }}>{err}</div>}
      </div>

      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Contacts ({active} active · {contacts.length} shown)</h3>
          <input value={q} onChange={(e) => { setQ(e.target.value); void load(e.target.value); }} placeholder="Search…" style={{ ...input, maxWidth: 220 }} />
        </div>
        {loading ? (
          <div className="hint">Loading…</div>
        ) : contacts.length === 0 ? (
          <div className="hint">No contacts yet. Import a spreadsheet above to get started.</div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {contacts.map((c) => (
              <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center",
                border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px",
                opacity: c.status === "active" ? 1 : 0.55 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{[c.first_name, c.last_name].filter(Boolean).join(" ") || c.email}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    {c.email}{c.status !== "active" ? ` · ${c.status}` : ""}
                    {Object.keys(c.fields || {}).length ? ` · +${Object.keys(c.fields).length} field${Object.keys(c.fields).length === 1 ? "" : "s"}` : ""}
                  </div>
                </div>
                <button type="button" onClick={() => remove(c.id)}
                  style={{ fontSize: 12, fontWeight: 600, cursor: "pointer", borderRadius: 6, padding: "5px 12px", border: "1px solid #e6a1a1", background: "#fbe6e6", color: "#b91c1c" }}>Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
