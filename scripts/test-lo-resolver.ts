/**
 * Unit test — loan-officer selection (pickLO), the Phase II routing brain.
 * Pure logic, no database, no network. Exercises the rule that decides which LO
 * a buyer is routed to.
 *
 * Run:  npm run test:lo
 */
import { pickLO, displayIdentity, type LORow } from "../src/lib/loSelect";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean): void {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.error(`  FAIL  ${name}`);
  }
}

// Build a row with sensible defaults; override only what a case cares about.
function row(p: Partial<LORow> & { id: string }): LORow {
  return {
    id: p.id,
    full_name: p.full_name ?? p.id,
    email: p.email ?? null,
    nmls: p.nmls ?? null,
    role: p.role ?? "lo",
    is_primary: p.is_primary ?? false,
    active: p.active ?? true,
    created_at: p.created_at ?? "2026-01-01T00:00:00Z",
  };
}

console.log("pickLO — loan-officer routing selection");

// 1. Single primary LO
check("single primary LO is chosen", pickLO([row({ id: "a", is_primary: true })])?.id === "a");

// 2. THE R PARRY CASE: two admins, one flagged primary → primary wins (not the older one)
check(
  "R Parry: primary admin (Richard) wins over the other admin",
  pickLO([
    row({ id: "marvin", role: "admin", is_primary: false, created_at: "2026-06-05T00:00:00Z" }),
    row({ id: "richard", role: "admin", is_primary: true, created_at: "2026-06-10T00:00:00Z" }),
  ])?.id === "richard",
);

// 3. No primary flagged → oldest active wins
check(
  "no primary → oldest active is chosen",
  pickLO([
    row({ id: "newer", created_at: "2026-06-10T00:00:00Z" }),
    row({ id: "older", created_at: "2026-06-01T00:00:00Z" }),
  ])?.id === "older",
);

// 4. An inactive primary is ignored in favor of an active LO
check(
  "inactive primary is skipped for an active LO",
  pickLO([
    row({ id: "inactivePrimary", is_primary: true, active: false }),
    row({ id: "activeLo", is_primary: false, active: true }),
  ])?.id === "activeLo",
);

// 5. Only 'staff' present → null (staff never receives leads)
check("only staff role → null", pickLO([row({ id: "s", role: "staff" })]) === null);

// 6. No users at all → null (caller falls back to lo_name)
check("empty list → null", pickLO([]) === null);

// 7. Identity fields are returned intact
const r = pickLO([
  row({ id: "x", full_name: "Richard McHargue", email: "r@rparry.com", nmls: "927662", is_primary: true }),
]);
check(
  "returns id/full_name/email/nmls of the chosen LO",
  r?.id === "x" && r?.full_name === "Richard McHargue" && r?.email === "r@rparry.com" && r?.nmls === "927662",
);

// --- displayIdentity (Option A buyer-facing correspondence) ---
console.log("\ndisplayIdentity — LO person + company brand");

// LO resolves → show the person + their individual NMLS; company NMLS from branding
const idA = displayIdentity({
  resolved: { id: "r", full_name: "Richard McHargue", email: null, nmls: "927662" },
  tenantLoName: "R Parry Financial",
  tenantNmls: "927662",
  companyNmls: "1924318",
});
check("LO name is the person, not the company", idA.loName === "Richard McHargue");
check("LO NMLS is the individual (927662)", idA.loNmls === "927662");
check("company NMLS is the broker (1924318)", idA.companyNmls === "1924318");

// No LO resolves → fall back to the tenant company display (no regression)
const idB = displayIdentity({
  resolved: null,
  tenantLoName: "Acme Homes preferred lender",
  tenantNmls: "111111",
  companyNmls: null,
});
check("falls back to tenant lo_name when no LO", idB.loName === "Acme Homes preferred lender");
check("company NMLS falls back to tenant.nmls when branding empty", idB.companyNmls === "111111");
check("no LO NMLS when nobody resolved", idB.loNmls === null);

// Nothing at all → safe default string
const idC = displayIdentity({ resolved: null, tenantLoName: null, tenantNmls: null, companyNmls: null });
check("safe default when everything is null", idC.loName === "your loan officer");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
