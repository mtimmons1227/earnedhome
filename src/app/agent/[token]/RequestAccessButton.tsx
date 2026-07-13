"use client";

import { useState } from "react";

// Mirrors the "Email link" button pattern (send → "Sent ✓" → re-enable). One click
// sends the buyer the consent request email — the agent never handles a link, so the
// buyer stays the one who grants. Disabled once the buyer is already sharing.
export function RequestAccessButton({
  token, leadId, disabled, hasEmail,
}: {
  token: string; leadId: string; disabled: boolean; hasEmail: boolean;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  if (disabled) {
    return <span style={{ fontSize: 12, color: "#15803d", fontWeight: 700, whiteSpace: "nowrap" }}>Sharing ✓</span>;
  }
  if (!hasEmail) {
    return <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>No email on file</span>;
  }

  async function send() {
    if (state === "sending") return;
    setState("sending");
    try {
      const res = await fetch(`/agent/${token}/request`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      if (!res.ok) throw new Error("send failed");
      setState("sent");
      setTimeout(() => setState("idle"), 3000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  return (
    <button onClick={send} disabled={state === "sending"} style={btn}>
      {state === "sending" ? "Sending…" : state === "sent" ? "Sent ✓" : state === "error" ? "Try again" : "Request access"}
    </button>
  );
}

const btn: React.CSSProperties = {
  background: "transparent", border: "1px solid var(--line)", borderRadius: 8,
  padding: "6px 10px", cursor: "pointer", fontWeight: 600, fontSize: 12, whiteSpace: "nowrap",
};
