"use client";

import { useRef, useState, type CSSProperties } from "react";

type Status =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "done"; verified: boolean; message: string }
  | { kind: "error"; message: string };

export function WorkbookSwap() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadAndReplace() {
    if (!file) return;

    // Friendly guard: the daily file should be the rate workbook. The site
    // replaces by file ID (the name doesn't matter to the server), but a wrong
    // name usually means the wrong file was picked — so warn before proceeding.
    if (!file.name.toLowerCase().startsWith("ratestreamworkbook")) {
      const proceed = window.confirm(
        `Heads up: "${file.name}" isn't named like the rate workbook ` +
          `(it should start with "RateStreamWorkBook").\n\n` +
          "Make sure this is the file you downloaded from here. Upload it anyway?",
      );
      if (!proceed) return;
    }

    const ok = window.confirm(
      `Replace the live rate workbook with "${file.name}"?\n\n` +
        "This updates the file the website reads. The previous version is kept " +
        "in SharePoint and can be restored if needed.",
    );
    if (!ok) return;

    setStatus({ kind: "uploading" });
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/workbook/replace", { method: "POST", body });
      const data = (await res.json()) as {
        ok?: boolean; verified?: boolean; message?: string; error?: string;
      };
      if (!res.ok || !data.ok) {
        setStatus({ kind: "error", message: data.error ?? "Upload failed." });
        return;
      }
      setStatus({
        kind: "done",
        verified: !!data.verified,
        message: data.message ?? "Workbook replaced.",
      });
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) {
      setStatus({ kind: "error", message: (e as Error).message });
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        Update the daily rates: <strong>download</strong> the workbook, edit the{" "}
        <strong>Rate</strong> tab in Excel, then <strong>upload it back</strong> to
        replace the live file. Always start from the download so the file keeps its
        connection to the website.
      </p>

      {/* Download */}
      <section style={card}>
        <h3 style={h3}>Download workbook</h3>
        <p style={muted}>
          Saves the current file to your Downloads folder. Open it in the desktop
          Excel app to edit.
        </p>
        <a href="/api/admin/workbook/download" style={btnPrimary}>
          ⬇ Download workbook
        </a>
      </section>

      {/* Backup — Upload & Replace */}
      <section style={card}>
        <h3 style={h3}>Upload &amp; replace</h3>
        <p style={muted}>
          After you&apos;ve edited and saved it, pick that file here to replace the
          live workbook. You only choose the file — everything else is handled for you.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setStatus({ kind: "idle" });
          }}
          style={{ marginBottom: 12 }}
        />
        <div>
          <button
            onClick={uploadAndReplace}
            disabled={!file || status.kind === "uploading"}
            style={{ ...btnPrimary, opacity: !file || status.kind === "uploading" ? 0.5 : 1,
              cursor: !file || status.kind === "uploading" ? "not-allowed" : "pointer",
              border: "none" }}
          >
            {status.kind === "uploading" ? "Replacing…" : "⬆ Upload & Replace"}
          </button>
        </div>

        {status.kind === "done" && (
          <p style={{ ...note, color: status.verified ? "#0f6e56" : "#92400e",
            background: status.verified ? "#e7f7f0" : "#fef3c7" }}>
            {status.verified ? "✓ " : "⚠ "}{status.message}
          </p>
        )}
        {status.kind === "error" && (
          <p style={{ ...note, color: "#991b1b", background: "#fee2e2" }}>
            ✕ {status.message}
          </p>
        )}
      </section>

      <p style={muted}>
        Tip: the website refreshes within a few minutes of a replace (or instantly
        when a buyer changes an input).
      </p>
    </div>
  );
}

const card: CSSProperties = {
  background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: 16,
};
const h3: CSSProperties = { margin: "0 0 6px", fontSize: 16 };
const muted: CSSProperties = { color: "var(--muted)", fontSize: 14, marginTop: 0 };
const note: CSSProperties = {
  marginTop: 12, padding: "10px 12px", borderRadius: 8, fontSize: 14, fontWeight: 600,
};
const btnPrimary: CSSProperties = {
  display: "inline-block", background: "var(--primary)", color: "#fff", fontWeight: 700,
  padding: "10px 16px", borderRadius: 10, textDecoration: "none",
};
