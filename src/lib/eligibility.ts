import type { PricingInput } from "./pricing/types";

// Product edit checks derived from R Parry's lending-criteria matrix.
// 2026 NATIONAL BASE figures — vary by county and reset annually, so keep them
// here as config (later: per-community). See
// "06 Pathfinder 1A/GUI_Input_Edit_Checks_and_Limits.md".
export const LIMITS = {
  conformingMax: 832_750, // Conforming Conventional max loan
  fhaBaseMax: 573_361,    // FHA base $563,500 + financeable UFMIP (~$9,861). Confirm w/ Richard per area.
  minCredit: 620,         // min credit for Conv + FHA
  convMaxLtv: 0.95,       // 5% down
  convMaxLtvFirstTime: 0.97, // 3% down for first-time
  fhaMaxLtv: 0.965,       // 3.5% down
};

// Credit band -> its floor score, to compare against minCredit.
const BAND_FLOOR: Record<string, number> = {
  "620–639": 620, "640–659": 640, "660–679": 660, "680–699": 680,
  "700–719": 700, "720–739": 720, "740–759": 740, "760–779": 760, "780+": 780,
};

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const pctDown = (maxLtv: number) => `${Math.round((1 - maxLtv) * 100)}%`;

export interface FamilyEligibility {
  family: "conventional" | "fha" | "va";
  eligible: boolean;
  reason?: string;
}
export interface Eligibility {
  conventional: FamilyEligibility;
  fha: FamilyEligibility;
  va: FamilyEligibility;
  routeMessage?: string; // shown instead of cards when nothing qualifies
}

export function evaluateEligibility(input: PricingInput): Eligibility {
  const loan = Math.max(0, input.homePrice - input.downAmount);
  const ltv = input.homePrice > 0 ? loan / input.homePrice : 1;
  const credit = BAND_FLOOR[input.creditBand] ?? 0;

  // Conforming Conventional
  const convMaxLtv = input.firstTime ? LIMITS.convMaxLtvFirstTime : LIMITS.convMaxLtv;
  const conventional: FamilyEligibility = { family: "conventional", eligible: true };
  if (loan > LIMITS.conformingMax) Object.assign(conventional, { eligible: false, reason: `Loan is above the conforming limit (${money(LIMITS.conformingMax)}).` });
  else if (credit < LIMITS.minCredit) Object.assign(conventional, { eligible: false, reason: `Credit score below ${LIMITS.minCredit}.` });
  else if (ltv > convMaxLtv) Object.assign(conventional, { eligible: false, reason: `Needs at least ${pctDown(convMaxLtv)} down${input.firstTime ? " (first-time)" : ""}.` });

  // FHA
  const fha: FamilyEligibility = { family: "fha", eligible: true };
  if (loan > LIMITS.fhaBaseMax) Object.assign(fha, { eligible: false, reason: `FHA isn't available above ${money(LIMITS.fhaBaseMax)} in this area.` });
  else if (credit < LIMITS.minCredit) Object.assign(fha, { eligible: false, reason: `Credit score below ${LIMITS.minCredit}.` });
  else if (ltv > LIMITS.fhaMaxLtv) Object.assign(fha, { eligible: false, reason: `Needs at least ${pctDown(LIMITS.fhaMaxLtv)} down.` });

  // VA — shown only when Veteran is checked; 0% down, no loan limit, min credit 620.
  const va: FamilyEligibility = { family: "va", eligible: input.veteran && credit >= LIMITS.minCredit };
  if (input.veteran && credit < LIMITS.minCredit) va.reason = `Credit score below ${LIMITS.minCredit}.`;

  let routeMessage: string | undefined;
  if (!conventional.eligible && !fha.eligible && !va.eligible) {
    if (loan > LIMITS.conformingMax) routeMessage = "This loan is above the conforming limit — let's talk through your options, including jumbo. Use “Connect me with a loan officer” below.";
    else if (credit < LIMITS.minCredit) routeMessage = "Let's talk through your options to find the right path for you. Use “Connect me with a loan officer” below.";
    else routeMessage = "Let's talk through your options to find a program that fits. Use “Connect me with a loan officer” below.";
  }
  return { conventional, fha, va, routeMessage };
}
