"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface BroadcastSummary {
  id: string; audience: string; subject: string; status: string;
  total: number; sent_count: number; created_at: string; sent_at: string | null;
}

interface Props {
  agentCount: number;
  contactCount: number;
  contactFields: string[];
  sendingEnabled: boolean;
  initialBroadcasts: BroadcastSummary[];
  company: string;
  address: string;
  website: string;
  phone: string;
  nmls: string;
  privacyUrl: string;
  footerLogoUrl: string | null;
}

type Audience = "agents" | "contacts";

// Client-side mirror of the server's {token|fallback} merge, for the live preview.
function renderMerge(template: string, values: Record<string, string>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)(?:\|([^}]*))?\}/g, (_m, key: string, fb?: string) => {
    const v = values[key];
    return v == null || v === "" ? (fb != null ? fb : "") : v;
  });
}
// Autolink bare URLs inside HTML, skipping any already inside <a>…</a>.
function autolinkHtml(html: string): string {
  return html.split(/(<a\b[^>]*>.*?<\/a>)/gis).map((seg) =>
    seg.toLowerCase().startsWith("<a")
      ? seg
      : seg.replace(/(https?:\/\/[^\s<"']+)/g, (u) => `<a href="${u}" style="color:#1F3864;font-weight:600;">${u}</a>`),
  ).join("");
}
// Strip tags to test whether the editor is effectively empty.
function isBlank(html: string): boolean {
  return html.replace(/<[^>]*>/g, "").replace(/ /g, " ").trim() === "";
}

export function BroadcastComposer({ agentCount, contactCount, contactFields, sendingEnabled, initialBroadcasts, company, address, website, phone, nmls, privacyUrl, footerLogoUrl }: Props) {
  const [audience, setAudience] = useState<Audience>("agents");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [broadcasts, setBroadcasts] = useState(initialBroadcasts);
  const [origin, setOrigin] = useState("https://home.rparryfinancial.com");
  const [previewRecipients, setPreviewRecipients] = useState<{ label: string; email: string; values: Record<string, string> }[]>([]);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [docName, setDocName] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (typeof window !== "undefined") setOrigin(window.location.origin); }, []);

  const tokens = useMemo(() => (
    audience === "agents"
      ? ["date", "first_name", "firm", "link", "portal"]
      : ["date", "first_name", "last_name", "link", ...contactFields]
  ), [audience, contactFields]);

  const today = useMemo(() => new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), []);

  const sample: Record<string, string> = useMemo(() => {
    if (audience === "agents") {
      return { first_name: "Alex", firm: "Keller Williams", date: today, link: `${origin}/a/sample`, portal: `${origin}/agent/sample` };
    }
    const v: Record<string, string> = { first_name: "Alex", last_name: "Sample", date: today, link: `${origin}/` };
    for (const f of contactFields) v[f] = `[${f}]`;
    return v;
  }, [audience, contactFields, origin, today]);

  // Pull real recipients (with their live links) so the preview can show an actual
  // person instead of placeholder "sample" values.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/broadcasts/preview?audience=${audience}`);
        const j = await res.json();
        if (!cancelled && res.ok) { setPreviewRecipients(j.recipients ?? []); setPreviewIdx(0); }
      } catch { /* falls back to sample values */ }
    })();
    return () => { cancelled = true; };
  }, [audience]);

  // The values used in the preview: the selected real recipient, else sample.
  const previewValues = previewRecipients[previewIdx]?.values ?? sample;

  // Default to everyone selected whenever the recipient list (re)loads.
  useEffect(() => {
    setSelectedEmails(new Set(previewRecipients.map((r) => r.email.toLowerCase())));
  }, [previewRecipients]);

  const DAILY_CAP = 100; // Resend free plan sends up to 100/day
  const selectedCount = selectedEmails.size;
  const overCap = selectedCount > DAILY_CAP;

  function toggleRecipient(email: string) {
    const e = email.toLowerCase();
    setSelectedEmails((prev) => { const n = new Set(prev); if (n.has(e)) n.delete(e); else n.add(e); return n; });
  }
  function selectAllRecipients() { setSelectedEmails(new Set(previewRecipients.map((r) => r.email.toLowerCase()))); }
  function selectNoRecipients() { setSelectedEmails(new Set()); }

  // Write HTML into the editor imperatively (and sync state). We never re-write the
  // editor on every keystroke (that fights the cursor) — onInput reads back out.
  function setEditorHtml(html: string) {
    if (editorRef.current) editorRef.current.innerHTML = html;
    setBody(html);
  }

  // Insert {token} at the cursor inside the rich editor.
  function insertToken(tok: string) {
    const el = editorRef.current; if (!el) return;
    el.focus();
    const ok = document.execCommand("insertText", false, `{${tok}}`);
    if (!ok) el.innerHTML += `{${tok}}`;
    setBody(el.innerHTML);
  }

  // Toolbar formatting (bold / bullet list) on the current selection.
  function fmt(cmd: "bold" | "insertUnorderedList") {
    editorRef.current?.focus();
    document.execCommand(cmd);
    setBody(editorRef.current?.innerHTML ?? "");
  }

  // Upload a Word .docx → convert to formatted HTML, then it's fully editable below.
  async function onWordFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true); setErr(null); setMsg(null);
    try {
      const fd = new FormData(); fd.append("file", f);
      const res = await fetch("/api/admin/broadcasts/import-docx", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Could not read the document");
      setEditorHtml(j.html); setDocName(j.filename ?? f.name);
      setMsg(`Loaded "${j.filename ?? f.name}" — it's editable below, and you can insert fields.`);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); if (docRef.current) docRef.current.value = ""; }
  }

  function clearBody() { setEditorHtml(""); setDocName(null); setMsg(null); }

  async function post(mode: "test" | "send") {
    setBusy(true); setErr(null); setMsg(null);
    try {
      const res = await fetch("/api/admin/broadcasts", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ audience, subject, body, mode, isHtml: true, recipients: [...selectedEmails] }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Something went wrong");
      if (mode === "test") setMsg(`Test sent to ${j.testedTo}. Check your inbox.`);
      else {
        setMsg(`Sent to ${j.sent} of ${j.total} recipients.`);
        // refresh history
        setBroadcasts((prev) => [{
          id: Math.random().toString(), audience, subject, status: "sent",
          total: j.total, sent_count: j.sent, created_at: new Date().toISOString(), sent_at: new Date().toISOString(),
        }, ...prev]);
      }
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  function onSendAll() {
    if (!confirm(`Send this to ${selectedCount} selected ${audience}? This emails real people.`)) return;
    void post("send");
  }

  const input: React.CSSProperties = { width: "100%", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 8, fontSize: 14, boxSizing: "border-box" };
  const canSend = sendingEnabled && !busy && selectedCount > 0 && !overCap && subject.trim() !== "" && !isBlank(body);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {!sendingEnabled && (
        <div className="panel" style={{ background: "#FFF8E1", border: "1px solid #FCE8A6" }}>
          <b style={{ color: "#8a5a00" }}>Sending is not enabled yet.</b>
          <p className="hint" style={{ margin: "6px 0 0" }}>
            You can compose, load the template, and preview now. Broadcasts will actually send once the
            dedicated <b>news.</b> sending subdomain is set up in Resend and <code>BROADCAST_FROM</code> is
            configured. Until then the <b>Send</b> buttons are disabled — nothing can be emailed.
          </p>
        </div>
      )}

      {/* Audience */}
      <div className="panel">
        <h3 style={{ margin: "0 0 8px" }}>1 · Who gets this?</h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <AudienceBtn active={audience === "agents"} onClick={() => setAudience("agents")} label="My agents" count={agentCount} />
          <AudienceBtn active={audience === "contacts"} onClick={() => setAudience("contacts")} label="My contacts" count={contactCount} />
        </div>
        <p className="hint" style={{ marginBottom: 0 }}>
          {audience === "agents"
            ? "Agents get personalized links generated live — {portal} (sign up a buyer) and {link} (their buyer link)."
            : "Contacts get their stored merge fields. Any spreadsheet column you imported is available below."}
        </p>
      </div>

      {/* Compose */}
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h3 style={{ margin: "0 0 10px" }}>2 · Compose</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <input ref={docRef} type="file" accept=".docx" onChange={onWordFile} style={{ display: "none" }} />
            <button type="button" onClick={() => docRef.current?.click()} disabled={busy}
              style={{ border: "1px solid var(--primary)", background: "#fff", color: "var(--primary)", borderRadius: 8, padding: "8px 14px", fontWeight: 600, cursor: "pointer" }}>
              ⬆ Load from Word (.docx)
            </button>
          </div>
        </div>
        <label style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--muted)", fontWeight: 600, marginBottom: 10 }}>
          Subject
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line" style={input} />
        </label>

        {/* Toolbar: formatting + insert fields (onMouseDown preventDefault keeps the caret) */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6, alignItems: "center" }}>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => fmt("bold")} title="Bold"
            style={{ fontSize: 13, fontWeight: 800, border: "1px solid var(--line)", background: "#fff", borderRadius: 6, padding: "4px 11px", cursor: "pointer" }}>B</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => fmt("insertUnorderedList")} title="Bulleted list"
            style={{ fontSize: 13, fontWeight: 600, border: "1px solid var(--line)", background: "#fff", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>• List</button>
          <span style={{ width: 1, height: 20, background: "var(--line)", margin: "0 4px" }} />
          <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Insert field:</span>
          {tokens.map((t) => (
            <button key={t} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insertToken(t)}
              style={{ fontSize: 12, fontWeight: 600, border: "1px solid #cddaea", background: "#eef3fb", color: "#1F3864", borderRadius: 999, padding: "4px 10px", cursor: "pointer" }}>
              {`{${t}}`}
            </button>
          ))}
        </div>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => setBody(editorRef.current?.innerHTML ?? "")}
          style={{ minHeight: 320, border: "1px solid var(--line)", borderRadius: 8, padding: "12px 14px", fontSize: 14, lineHeight: 1.6, background: "#fff", overflowY: "auto" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
          <p className="hint" style={{ margin: 0 }}>
            {docName ? <>📄 From <b>{docName}</b> — fully editable here; changes don&apos;t touch the original file. </> : null}
            Click in the letter, then <b>Insert field</b> to drop <b>{"{first_name}"}</b>, <b>{"{link}"}</b>, etc. at the cursor. <b>{"{first_name|there}"}</b> shows a fallback.
          </p>
          {!isBlank(body) && (
            <button type="button" onClick={clearBody}
              style={{ fontSize: 12, fontWeight: 600, border: "1px solid var(--line)", background: "#fff", borderRadius: 6, padding: "6px 12px", cursor: "pointer" }}>Clear</button>
          )}
        </div>
      </div>

      {/* Preview */}
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>3 · Preview <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>
            {previewRecipients.length ? `— real values for ${previewRecipients[previewIdx]?.label ?? ""}` : "(sample values)"}
          </span></h3>
          {previewRecipients.length > 0 && (
            <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, display: "flex", gap: 6, alignItems: "center" }}>
              Preview as:
              <select value={previewIdx} onChange={(e) => setPreviewIdx(Number(e.target.value))}
                style={{ padding: "6px 8px", border: "1px solid var(--line)", borderRadius: 6, fontSize: 13 }}>
                {previewRecipients.map((r, i) => <option key={r.email} value={i}>{r.label}</option>)}
              </select>
            </label>
          )}
        </div>
        <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 16, background: "#fff", maxWidth: 620 }}>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
            <b>Subject:</b> {renderMerge(subject, previewValues) || <span style={{ color: "#9aa7b6" }}>(subject)</span>}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <img src="/brand/buyerbridge-logo.png" alt="BuyerBridge" style={{ height: 44, width: "auto" }} />
          </div>
          {!isBlank(body)
            ? <div style={{ fontSize: 14, color: "#1f2937" }} dangerouslySetInnerHTML={{ __html: autolinkHtml(renderMerge(body, previewValues)) }} />
            : <div className="hint">Your email preview will appear here.</div>}

          {/* Footer — logo + Privacy Notice + address·website·phone·NMLS + unsubscribe, exactly as recipients get it */}
          {footerLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <div style={{ marginTop: 20 }}><img src={footerLogoUrl} alt={company} style={{ maxWidth: 260, height: "auto" }} /></div>
          )}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #e5e7eb", fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>
            <div>Please review our <a href={privacyUrl} target="_blank" rel="noreferrer" style={{ color: "#6b7280", textDecoration: "underline" }}>Privacy Notice</a>.</div>
            <div>{address} · {website} · {phone} · NMLS {nmls}</div>
            <div>You&apos;re receiving this because you&apos;re a contact of {company}. <span style={{ textDecoration: "underline" }}>Unsubscribe</span>.</div>
          </div>
        </div>
      </div>

      {/* Recipients */}
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
          <h3 style={{ margin: 0 }}>4 · Recipients <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>({selectedCount} of {previewRecipients.length} selected)</span></h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={selectAllRecipients} style={{ fontSize: 12, fontWeight: 600, border: "1px solid var(--line)", background: "#fff", borderRadius: 6, padding: "5px 12px", cursor: "pointer" }}>Select all</button>
            <button type="button" onClick={selectNoRecipients} style={{ fontSize: 12, fontWeight: 600, border: "1px solid var(--line)", background: "#fff", borderRadius: 6, padding: "5px 12px", cursor: "pointer" }}>None</button>
          </div>
        </div>
        <p className="hint" style={{ marginTop: 0 }}>Pick exactly who this goes to. Your email plan sends up to <b>{DAILY_CAP}/day</b> — select {DAILY_CAP} or fewer.</p>
        {overCap && (
          <div style={{ color: "#b91c1c", background: "#fbe6e6", border: "1px solid #e6a1a1", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 8 }}>
            You&apos;ve selected {selectedCount}. Deselect {selectedCount - DAILY_CAP} to stay within the {DAILY_CAP}/day limit (or raise the limit later with a paid plan).
          </div>
        )}
        {previewRecipients.length === 0 ? (
          <div className="hint">No active recipients in this audience yet.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 6, maxHeight: 260, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 8, padding: 10 }}>
            {previewRecipients.map((r) => (
              <label key={r.email} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, cursor: "pointer", minWidth: 0 }}>
                <input type="checkbox" checked={selectedEmails.has(r.email.toLowerCase())} onChange={() => toggleRecipient(r.email)} />
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <b>{r.label}</b> <span style={{ color: "var(--muted)" }}>{r.email}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Send */}
      <div className="panel">
        <h3 style={{ margin: "0 0 10px" }}>5 · Send</h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" onClick={() => void post("test")} disabled={!sendingEnabled || busy || !subject.trim() || isBlank(body)}
            style={{ border: "1px solid var(--primary)", background: "#fff", color: "var(--primary)", borderRadius: 8, padding: "11px 16px", fontWeight: 600, cursor: "pointer", height: 42, opacity: (!sendingEnabled || busy) ? 0.5 : 1 }}>
            Send test to me
          </button>
          <button type="button" onClick={onSendAll} disabled={!canSend}
            style={{ border: "none", background: "var(--primary)", color: "#fff", borderRadius: 8, padding: "11px 18px", fontWeight: 700, cursor: "pointer", height: 42, opacity: canSend ? 1 : 0.5 }}>
            {`Send to ${selectedCount} selected`}
          </button>
          {busy && <span className="hint">Working…</span>}
        </div>
        {msg && <div style={{ color: "#15803d", marginTop: 10, fontSize: 13 }}>{msg}</div>}
        {err && <div style={{ color: "#b91c1c", marginTop: 10, fontSize: 13 }}>{err}</div>}
      </div>

      {/* History */}
      <div className="panel">
        <h3 style={{ margin: "0 0 10px" }}>Recent broadcasts</h3>
        {broadcasts.length === 0 ? (
          <div className="hint">Nothing sent yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {broadcasts.map((b) => (
              <div key={b.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center", border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.subject}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{b.audience} · {new Date(b.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: b.status === "sent" ? "#15803d" : b.status === "failed" ? "#b91c1c" : "#5b6b80" }}>
                  {b.status === "sent" ? `Sent ${b.sent_count}/${b.total}` : b.status}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AudienceBtn({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        border: active ? "2px solid var(--primary)" : "1px solid var(--line)",
        background: active ? "#eef3fb" : "#fff", borderRadius: 10, padding: "10px 16px",
        cursor: "pointer", textAlign: "left", minWidth: 150,
      }}>
      <div style={{ fontWeight: 700, color: "#1F3864" }}>{label}</div>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>{count} active</div>
    </button>
  );
}
