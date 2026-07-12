"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import type { PricingQuote } from "@/lib/pricing/types";

export type LeadStatus = "new" | "contacted" | "working" | "closed" | "lost";
export interface LeadRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  status: LeadStatus;
  consent_tcpa: boolean;
  consent_text: string | null;
  consent_at: string | null;
  source: string | null;
  notes: string | null;
  created_at: string;
  closed_at: string | null;
  agent_name: string | null;
  agent_active: boolean | null;
  assigned_lo_name: string | null;
  quote: { inputs: Record<string, unknown> | null; outputs: PricingQuote | null; rates_as_of: string | null } | null;
}

const STATUSES: LeadStatus[] = ["new", "contacted", "working", "closed", "lost"];
const ACTIVE_STATUSES: LeadStatus[] = ["new", "contacted", "working"];
type FilterValue = "active" | "all" | LeadStatus;
// Display labels — the stored value stays `contacted`, but it shows as "Initial contact".
const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New", contacted: "Initial contact", working: "Working", closed: "Closed / Funded", lost: "Lost",
};
export interface LeadNote { authorName: string; body: string; created_at: string; }
const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

export function LeadsTable({ initialLeads, initialNotes, isAdmin = false }: { initialLeads: LeadRow[]; initialNotes: Record<string, LeadNote[]>; isAdmin?: boolean }) {
  const [leads, setLeads] = useState<LeadRow[]>(initialLeads);
  const [notesByLead, setNotesByLead] = useState<Record<string, LeadNote[]>>(initialNotes);
  const [openId, setOpenId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [noteMsg, setNoteMsg] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<FilterValue>("active");
  const [loFilter, setLoFilter] = useState<string>("all");
  const router = useRouter();

  // The broker's roll-up filter: distinct LOs across the leads (admin view only).
  const loNames = Array.from(new Set(leads.map((l) => l.assigned_lo_name).filter(Boolean))) as string[];

  async function patch(id: string, body: Record<string, unknown>): Promise<boolean> {
    setSavingId(id);
    try {
      const res = await fetch("/api/lead/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadId: id, ...body }),
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      setSavingId(null);
    }
  }

  async function changeStatus(id: string, status: LeadStatus) {
    const prev = leads;
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
    if (!(await patch(id, { status }))) { setLeads(prev); return; }
    router.refresh(); // re-sync the top metric cards (New/unworked, conversion) with the saved status
  }

  async function addNote(id: string) {
    const text = (noteDraft[id] ?? "").trim();
    if (!text) return;
    setSavingId(id);
    try {
      const res = await fetch("/api/lead/note", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadId: id, body: text }),
      });
      const data = (await res.json()) as { ok?: boolean; note?: LeadNote; error?: string };
      if (res.ok && data.ok && data.note) {
        const note = data.note;
        setNotesByLead((m) => ({ ...m, [id]: [...(m[id] ?? []), note] }));
        setNoteDraft((d) => ({ ...d, [id]: "" }));
      } else {
        setNoteMsg((m) => ({ ...m, [id]: data.error ?? "Couldn't save" }));
        setTimeout(() => setNoteMsg((m) => ({ ...m, [id]: "" })), 2500);
      }
    } catch {
      setNoteMsg((m) => ({ ...m, [id]: "Couldn't save" }));
      setTimeout(() => setNoteMsg((m) => ({ ...m, [id]: "" })), 2500);
    } finally {
      setSavingId(null);
    }
  }

  if (leads.length === 0) {
    return <div className="panel"><div className="empty">No leads yet. They&apos;ll appear here as buyers connect.</div></div>;
  }

  const th = { padding: "8px 10px" } as const;

  const byStatus =
    filter === "all"
      ? leads
      : filter === "active"
        ? leads.filter((l) => ACTIVE_STATUSES.includes(l.status))
        : leads.filter((l) => l.status === filter);
  const visible =
    isAdmin && loFilter !== "all"
      ? byStatus.filter((l) => (l.assigned_lo_name ?? "—") === loFilter)
      : byStatus;
  const colCount = isAdmin ? 9 : 8;

  return (
    <div className="panel" style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>
          Showing {visible.length} of {leads.length}
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {isAdmin && loNames.length > 0 && (
            <label style={{ fontSize: 13, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
              LO:
              <select value={loFilter} onChange={(e) => setLoFilter(e.target.value)}
                style={{ padding: "6px 8px", fontSize: 13 }}>
                <option value="all">All LOs</option>
                {loNames.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          )}
          <label style={{ fontSize: 13, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
            View:
            <select value={filter} onChange={(e) => setFilter(e.target.value as FilterValue)}
              style={{ padding: "6px 8px", fontSize: 13 }}>
              <option value="active">Active</option>
              <option value="all">All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 12 }}>
            <th style={{ ...th, width: 24 }}></th>
            <th style={th}>Date</th><th style={th}>Name</th><th style={th}>Agent</th>{isAdmin && <th style={th}>LO</th>}<th style={th}>Email</th>
            <th style={th}>Phone</th><th style={th}>Consent</th><th style={th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 && (
            <tr>
              <td colSpan={colCount} style={{ padding: 16, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                No leads in this view.{" "}
                <button onClick={() => setFilter("all")}
                  style={{ background: "none", border: "none", color: "var(--primary)", fontWeight: 600,
                    cursor: "pointer", fontSize: 13, textDecoration: "underline" }}>
                  Show all
                </button>
              </td>
            </tr>
          )}
          {visible.map((l) => {
            const isOpen = openId === l.id;
            const q = l.quote?.outputs ?? null;
            const inp = l.quote?.inputs ?? null;
            return (
              <Fragment key={l.id}>
                <tr style={{ borderTop: "1px solid var(--line)", cursor: "pointer" }}
                  onClick={() => setOpenId(isOpen ? null : l.id)}>
                  <td style={{ ...th, color: "var(--muted)" }}>{isOpen ? "▾" : "▸"}</td>
                  <td style={{ ...th, whiteSpace: "nowrap", color: "var(--muted)" }}>{new Date(l.created_at).toLocaleDateString()}</td>
                  <td style={{ ...th, fontWeight: 600 }}>{l.full_name ?? "—"}{(notesByLead[l.id]?.length ?? 0) > 0 ? " 📝" : ""}</td>
                  <td style={{ ...th, color: l.agent_name ? undefined : "var(--muted)" }}>
                    {l.agent_name ?? "—"}
                    {l.agent_name && l.agent_active === false && (
                      <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#b91c1c",
                        border: "1px solid #fca5a5", background: "#fef2f2", borderRadius: 5, padding: "1px 5px",
                        whiteSpace: "nowrap" }}>DISABLED</span>
                    )}
                  </td>
                  {isAdmin && (
                    <td style={{ ...th, color: l.assigned_lo_name ? undefined : "var(--muted)" }}>
                      {l.assigned_lo_name ?? "—"}
                    </td>
                  )}
                  <td style={th}>{l.email ?? "—"}</td>
                  <td style={{ ...th, whiteSpace: "nowrap" }}>{l.phone ?? "—"}</td>
                  <td style={th}>{l.consent_tcpa ? "✓" : "—"}</td>
                  <td style={th} onClick={(e) => e.stopPropagation()}>
                    <select value={l.status} disabled={savingId === l.id}
                      onChange={(e) => changeStatus(l.id, e.target.value as LeadStatus)}
                      style={{ padding: "6px 8px", fontSize: 13 }}>
                      {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={colCount} style={{ padding: 0 }}>
                      <div style={{ background: "#f7f9fc", border: "1px solid var(--line)", borderRadius: 10, margin: "0 10px 12px", padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <div>
                          <div style={{ fontWeight: 700, color: "var(--primary)", marginBottom: 6 }}>Buyer & consent</div>
                          <Field k="Name" v={l.full_name} /><Field k="Email" v={l.email} /><Field k="Phone" v={l.phone} />
                          <Field k="Source" v={l.source} />
                          <Field k="Agent" v={l.agent_name ? `${l.agent_name}${l.agent_active === false ? " (disabled)" : ""}` : null} />
                          <Field k="Consent" v={l.consent_tcpa ? "Yes" : "No"} />
                          {l.consent_at && <Field k="Consent at" v={new Date(l.consent_at).toLocaleString()} />}
                          {l.consent_text && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, fontStyle: "italic" }}>&ldquo;{l.consent_text}&rdquo;</div>}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: "var(--primary)", marginBottom: 6 }}>Quote the buyer saw</div>
                          {q ? (
                            <>
                              {inp && <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
                                Home {money(Number(inp.homePrice ?? 0))} · down {money(Number(inp.downAmount ?? 0))} · {String(inp.creditBand ?? "")} · {String(inp.occupancy ?? "")}
                              </div>}
                              {q.products.map((p) => (
                                <div key={p.product} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
                                  <span>{p.product} <span style={{ color: "var(--muted)" }}>· {p.rate.toFixed(3)}%</span></span>
                                  <span style={{ fontWeight: 600 }}>{money(p.totalPayment)}/mo</span>
                                </div>
                              ))}
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0 0", borderTop: "1px dashed var(--line)", marginTop: 4 }}>
                                <span style={{ color: "var(--muted)" }}>Cash to close</span>
                                <span style={{ fontWeight: 700, color: "var(--primary)" }}>{money(q.cashToClose)}</span>
                              </div>
                              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Rates as of {l.quote?.rates_as_of ?? q.ratesAsOf}</div>
                            </>
                          ) : <div style={{ fontSize: 13, color: "var(--muted)" }}>No quote linked.</div>}
                        </div>
                        <div style={{ gridColumn: "1 / -1" }}>
                          <div style={{ fontWeight: 700, color: "var(--primary)", marginBottom: 6 }}>Notes</div>
                          {(notesByLead[l.id] ?? []).slice().reverse().map((n, i) => (
                            <div key={i} style={{ borderLeft: "3px solid var(--line)", padding: "2px 10px", marginBottom: 8 }}>
                              <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
                                {n.authorName} · {new Date(n.created_at).toLocaleString()}
                              </div>
                              <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{n.body}</div>
                            </div>
                          ))}
                          {(notesByLead[l.id]?.length ?? 0) === 0 && (
                            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>No notes yet.</div>
                          )}
                          <textarea
                            value={noteDraft[l.id] ?? ""}
                            onChange={(e) => setNoteDraft((d) => ({ ...d, [l.id]: e.target.value }))}
                            placeholder="Add a note…"
                            style={{ width: "100%", minHeight: 60, padding: 10, border: "1px solid var(--line)", borderRadius: 8, fontFamily: "inherit", fontSize: 13 }} />
                          <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 10 }}>
                            <button onClick={() => addNote(l.id)} disabled={savingId === l.id || !(noteDraft[l.id] ?? "").trim()}
                              style={{ background: "var(--accent)", color: "#fff", border: 0, padding: "8px 14px", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13,
                                opacity: savingId === l.id || !(noteDraft[l.id] ?? "").trim() ? 0.6 : 1 }}>
                              {savingId === l.id ? "Adding…" : "Add note"}
                            </button>
                            {noteMsg[l.id] && <span style={{ fontSize: 12, color: "var(--muted)" }}>{noteMsg[l.id]}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Field({ k, v }: { k: string; v: string | null }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "2px 0" }}>
      <span style={{ color: "var(--muted)" }}>{k}</span><span>{v ?? "—"}</span>
    </div>
  );
}
