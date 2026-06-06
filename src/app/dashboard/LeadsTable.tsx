"use client";

import { useState } from "react";

export type LeadStatus = "new" | "contacted" | "working" | "closed" | "lost";
export interface LeadRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  status: LeadStatus;
  consent_tcpa: boolean;
  created_at: string;
  routed_to: string | null;
  quote_id: string | null;
}

const STATUSES: LeadStatus[] = ["new", "contacted", "working", "closed", "lost"];

export function LeadsTable({ initialLeads }: { initialLeads: LeadRow[] }) {
  const [leads, setLeads] = useState<LeadRow[]>(initialLeads);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function changeStatus(id: string, status: LeadStatus) {
    const prev = leads;
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
    setSavingId(id);
    try {
      const res = await fetch("/api/lead/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadId: id, status }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setLeads(prev); // revert on failure
    } finally {
      setSavingId(null);
    }
  }

  if (leads.length === 0) {
    return (
      <div className="panel"><div className="empty">No leads yet. They&apos;ll appear here as buyers connect.</div></div>
    );
  }

  return (
    <div className="panel" style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 12 }}>
            <th style={{ padding: "8px 10px" }}>Date</th>
            <th style={{ padding: "8px 10px" }}>Name</th>
            <th style={{ padding: "8px 10px" }}>Email</th>
            <th style={{ padding: "8px 10px" }}>Phone</th>
            <th style={{ padding: "8px 10px" }}>Consent</th>
            <th style={{ padding: "8px 10px" }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr key={l.id} style={{ borderTop: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 10px", whiteSpace: "nowrap", color: "var(--muted)" }}>
                {new Date(l.created_at).toLocaleDateString()}
              </td>
              <td style={{ padding: "8px 10px", fontWeight: 600 }}>{l.full_name ?? "—"}</td>
              <td style={{ padding: "8px 10px" }}>{l.email ?? "—"}</td>
              <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{l.phone ?? "—"}</td>
              <td style={{ padding: "8px 10px" }}>{l.consent_tcpa ? "✓" : "—"}</td>
              <td style={{ padding: "8px 10px" }}>
                <select value={l.status} disabled={savingId === l.id}
                  onChange={(e) => changeStatus(l.id, e.target.value as LeadStatus)}
                  style={{ padding: "6px 8px", fontSize: 13 }}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
