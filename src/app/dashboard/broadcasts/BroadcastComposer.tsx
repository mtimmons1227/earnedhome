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

// The current "Eye on the Ball" letter, as an editable template with merge tokens.
// {portal} = the agent's private portal link; {link} = the agent's buyer/referral link.
const AGENT_TEMPLATE_SUBJECT = "The Best Time to Introduce BuyerBridge";
const AGENT_TEMPLATE_BODY = `{date}

Hi {first_name}!

The best time to introduce BuyerBridge is when someone is thinking about moving — before they know where they want to move, before they know what they can afford, before they're ready to buy.

That's when BuyerBridge gives you the chance to become part of their journey — and stay connected as their plans develop.

If someone mentions moving, wondering what they can afford, wanting more space, downsizing, retiring, or simply "maybe someday" — send them to BuyerBridge. There's no reason to wait. It lets them explore their numbers and see what a move could look like before they're ready to decide.

And because BuyerBridge keeps you connected to the people you've introduced, you don't have to guess who's still thinking about moving. When they start exploring seriously and decide they're ready to connect, you'll already be there.

You're not chasing buyers after they're ready — you're building relationships with buyers before they're ready.

To connect your buyers to you, use your private link below to sign up a buyer and send them their personal BuyerBridge link:
{portal}

This is what connects the buyer to you. Once they're connected, you can stay informed as they explore their options — and when they're ready to connect with a mortgage professional, you'll be the first to know.

Here is your personal link to check it out — this is also what the buyer sees:
{link}

Give it a try with your next buyer. I think you'll find it a pretty powerful tool.

Sincerely,
Richard McHargue (NMLS 927662)
Managing Member, R Parry Financial, LLC (NMLS 1924318)
Office: (682) 250-7649 · Mobile: (817) 905-8660
richard@rparryfinancial.com · www.rparryfinancial.com`;

const CONTACT_TEMPLATE_SUBJECT = "A quick way to see what you can afford";
const CONTACT_TEMPLATE_BODY = `{date}

Hi {first_name},

Thinking about a move — or just curious what your numbers look like? BuyerBridge lets you see real monthly-payment and cash-to-close estimates in about a minute. No credit pull, no obligation.

Take a look whenever you're ready, and reach out with any questions.

Sincerely,
Richard McHargue
R Parry Financial, LLC`;

// Client-side mirror of the server's {token|fallback} merge, for the live preview.
function renderMerge(template: string, values: Record<string, string>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)(?:\|([^}]*))?\}/g, (_m, key: string, fb?: string) => {
    const v = values[key];
    return v == null || v === "" ? (fb != null ? fb : "") : v;
  });
}
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
function escapeAndLink(s: string): string {
  return escapeHtml(s).replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" style="color:#1F3864;font-weight:600;">${u}</a>`);
}
function previewHtml(body: string, values: Record<string, string>): string {
  const merged = renderMerge(body, values);
  return merged.split(/\n{2,}/).map((b) =>
    `<p style="margin:0 0 12px;">${escapeAndLink(b).replace(/\n/g, "<br/>")}</p>`).join("");
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
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (typeof window !== "undefined") setOrigin(window.location.origin); }, []);

  const tokens = useMemo(() => (
    audience === "agents"
      ? ["date", "first_name", "firm", "link", "portal"]
      : ["date", "first_name", "last_name", "link", ...contactFields]
  ), [audience, contactFields]);

  const recipientCount = audience === "agents" ? agentCount : contactCount;

  const today = useMemo(() => new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), []);

  const sample: Record<string, string> = useMemo(() => {
    if (audience === "agents") {
      return { first_name: "Alex", firm: "Keller Williams", date: today, link: `${origin}/a/sample`, portal: `${origin}/agent/sample` };
    }
    const v: Record<string, string> = { first_name: "Alex", last_name: "Sample", date: today, link: `${origin}/` };
    for (const f of contactFields) v[f] = `[${f}]`;
    return v;
  }, [audience, contactFields, origin, today]);

  function insertToken(tok: string) {
    const ta = bodyRef.current;
    const ins = `{${tok}}`;
    if (!ta) { setBody((b) => b + ins); return; }
    const start = ta.selectionStart ?? body.length;
    const end = ta.selectionEnd ?? body.length;
    const next = body.slice(0, start) + ins + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + ins.length; });
  }

  function loadTemplate() {
    if (audience === "agents") { setSubject(AGENT_TEMPLATE_SUBJECT); setBody(AGENT_TEMPLATE_BODY); }
    else { setSubject(CONTACT_TEMPLATE_SUBJECT); setBody(CONTACT_TEMPLATE_BODY); }
    setMsg(null); setErr(null);
  }

  async function post(mode: "test" | "send") {
    setBusy(true); setErr(null); setMsg(null);
    try {
      const res = await fetch("/api/admin/broadcasts", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ audience, subject, body, mode }),
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
    if (!confirm(`Send this to all ${recipientCount} ${audience}? This emails real people.`)) return;
    void post("send");
  }

  const input: React.CSSProperties = { width: "100%", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 8, fontSize: 14, boxSizing: "border-box" };
  const canSend = sendingEnabled && !busy && recipientCount > 0 && subject.trim() !== "" && body.trim() !== "";

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

      {/* Audience + template */}
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div>
            <h3 style={{ margin: "0 0 8px" }}>1 · Who gets this?</h3>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <AudienceBtn active={audience === "agents"} onClick={() => setAudience("agents")} label="My agents" count={agentCount} />
              <AudienceBtn active={audience === "contacts"} onClick={() => setAudience("contacts")} label="My contacts" count={contactCount} />
            </div>
          </div>
          <button type="button" onClick={loadTemplate}
            style={{ border: "1px solid var(--line)", background: "#fff", borderRadius: 8, padding: "9px 14px", fontWeight: 600, cursor: "pointer", height: 40 }}>
            Load template
          </button>
        </div>
        <p className="hint" style={{ marginBottom: 0 }}>
          {audience === "agents"
            ? "Agents get personalized links generated live — {portal} (sign up a buyer) and {link} (their buyer link)."
            : "Contacts get their stored merge fields. Any spreadsheet column you imported is available below."}
        </p>
      </div>

      {/* Compose */}
      <div className="panel">
        <h3 style={{ margin: "0 0 10px" }}>2 · Compose</h3>
        <label style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--muted)", fontWeight: 600, marginBottom: 10 }}>
          Subject
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line" style={input} />
        </label>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Insert field:</span>
          {tokens.map((t) => (
            <button key={t} type="button" onClick={() => insertToken(t)}
              style={{ fontSize: 12, fontWeight: 600, border: "1px solid #cddaea", background: "#eef3fb", color: "#1F3864", borderRadius: 999, padding: "4px 10px", cursor: "pointer" }}>
              {`{${t}}`}
            </button>
          ))}
        </div>
        <textarea ref={bodyRef} value={body} onChange={(e) => setBody(e.target.value)} rows={16}
          placeholder="Write your email. Use the Insert field buttons for personalization, and leave a blank line between paragraphs."
          style={{ ...input, fontFamily: "inherit", lineHeight: 1.5, resize: "vertical" }} />
        <p className="hint" style={{ margin: "6px 0 0" }}>
          Tip: <b>{"{first_name|there}"}</b> shows a fallback (&ldquo;there&rdquo;) when the field is blank. Paste a link on its own line and it becomes clickable.
        </p>
      </div>

      {/* Preview */}
      <div className="panel">
        <h3 style={{ margin: "0 0 10px" }}>3 · Preview <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>(sample values)</span></h3>
        <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 16, background: "#fff", maxWidth: 620 }}>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
            <b>Subject:</b> {renderMerge(subject, sample) || <span style={{ color: "#9aa7b6" }}>(subject)</span>}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <img src="/brand/buyerbridge-logo.png" alt="BuyerBridge" style={{ height: 44, width: "auto" }} />
          </div>
          {body.trim()
            ? <div style={{ fontSize: 14, color: "#1f2937" }} dangerouslySetInnerHTML={{ __html: previewHtml(body, sample) }} />
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

      {/* Send */}
      <div className="panel">
        <h3 style={{ margin: "0 0 10px" }}>4 · Send</h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" onClick={() => void post("test")} disabled={!sendingEnabled || busy || !subject.trim() || !body.trim()}
            style={{ border: "1px solid var(--primary)", background: "#fff", color: "var(--primary)", borderRadius: 8, padding: "11px 16px", fontWeight: 600, cursor: "pointer", height: 42, opacity: (!sendingEnabled || busy) ? 0.5 : 1 }}>
            Send test to me
          </button>
          <button type="button" onClick={onSendAll} disabled={!canSend}
            style={{ border: "none", background: "var(--primary)", color: "#fff", borderRadius: 8, padding: "11px 18px", fontWeight: 700, cursor: "pointer", height: 42, opacity: canSend ? 1 : 0.5 }}>
            {`Send to all ${recipientCount} ${audience}`}
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
