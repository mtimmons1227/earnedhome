// Pure loan-officer selection logic — no database, no imports — so it can be
// unit-tested directly (see scripts/test-lo-resolver.ts). getResolvedLO
// (loanOfficer.ts) fetches the tenant's user rows; pickLO decides which LO wins.

export interface ResolvedLO {
  id: string;
  full_name: string | null;
  email: string | null;
  nmls: string | null;
}

export interface LORow {
  id: string;
  full_name: string | null;
  email: string | null;
  nmls: string | null;
  role: string;
  is_primary: boolean;
  active: boolean;
  created_at: string;
}

// Default routing strategy: among a tenant's users, choose the loan officer a
// buyer is routed to — the flagged primary if there is one, otherwise the oldest
// active LO/admin (covers a broker-and-LO shop like R Parry, where the one admin
// IS the loan officer). Only 'lo' and 'admin' roles are eligible; 'staff' never
// receives leads. Returns null when no eligible LO exists (the caller then falls
// back to the tenant's lo_name display string, preserving Phase 1A behavior).
export function pickLO(rows: LORow[]): ResolvedLO | null {
  const eligible = rows
    .filter((r) => r.active && (r.role === "lo" || r.role === "admin"))
    .sort((a, b) => {
      if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1; // primary first
      return a.created_at.localeCompare(b.created_at); // then oldest first
    });
  const row = eligible[0];
  if (!row) return null;
  return {
    id: row.id,
    full_name: row.full_name ?? null,
    email: row.email ?? null,
    nmls: row.nmls ?? null,
  };
}
