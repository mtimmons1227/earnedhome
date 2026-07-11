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

// When a lead comes through an agent link, the agent's own LO takes precedence
// over the tenant's default (primary) LO. Pure/testable. Falls back to the tenant
// default when the agent has no (active) LO.
export function preferAgentLO(
  agentLO: ResolvedLO | null,
  tenantDefault: ResolvedLO | null,
): ResolvedLO | null {
  return agentLO ?? tenantDefault;
}

// What the buyer-facing correspondence shows (Option A: LO person + company brand,
// each with its own NMLS). Pure/testable. Falls back to the tenant's lo_name when
// no LO resolves (preserves Phase 1A behavior), and company NMLS falls back to the
// legacy tenant.nmls if the clean branding.company_nmls isn't set.
export interface DisplayIdentity {
  loName: string; // the person (or company name as fallback)
  loNmls: string | null; // the LO's individual NMLS
  companyNmls: string | null; // the broker/company NMLS
}
export function displayIdentity(args: {
  resolved: ResolvedLO | null;
  tenantLoName: string | null;
  tenantNmls: string | null;
  companyNmls: string | null;
}): DisplayIdentity {
  return {
    loName: args.resolved?.full_name ?? args.tenantLoName ?? "your loan officer",
    loNmls: args.resolved?.nmls ?? null,
    companyNmls: args.companyNmls ?? args.tenantNmls ?? null,
  };
}
