"use client";

import { useState } from "react";

// Flow B: shown on the buyer's confirmation. The buyer creates their own referral
// link and sends it themselves (native share sheet on mobile, or copy). Keeping it
// buyer-initiated is what makes it compliant — we never cold-email their friends.
export function ShareWithFriend({ leadId }: { leadId: string }) {
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function make() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/share/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ referrerLeadId: leadId }),
      });
      const j = (await res.json().catch(() => ({}))) as { link?: string; error?: string };
      if (!res.ok || !j.link) {
        setErr(j.error ?? "Could not create a link.");
        return;
      }
      setLink(j.link);
      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({ title: "See what you can afford", url: j.link });
        } catch {
          /* user dismissed the share sheet — the link is still shown below */
        }
      }
    } catch {
      setErr("Something went wrong — please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the buyer can select the field manually */
    }
  }

  return (
    <div style={{ marginTop: 12, padding: 12, border: "1px dashed var(--line)", borderRadius: 10 }}>
      <div style={{ fontWeight: 600, color: "var(--primary)" }}>Know someone else house‑hunting?</div>
      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
        Share this with a friend or family member so they can see what they can afford too.
      </div>
      {!link ? (
        <button
          onClick={make}
          disabled={busy}
          style={{ marginTop: 10, background: "var(--primary)", color: "#fff", border: "none",
            padding: "9px 14px", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 14 }}
        >
          {busy ? "Creating…" : "Share with a friend"}
        </button>
      ) : (
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            style={{ flex: 1, minWidth: 200, fontSize: 12, padding: "8px 10px" }}
          />
          <button
            onClick={copy}
            style={{ background: "transparent", border: "1px solid var(--line)", color: "var(--primary)",
              padding: "8px 12px", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13 }}
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      )}
      {err && <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 6 }}>{err}</div>}
    </div>
  );
}
