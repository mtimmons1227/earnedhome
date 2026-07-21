import type { PricingInput, Occupancy } from "./pricing/types";

// Loan eligibility rules for Phase 1A, from R Parry's 2026 lending-criteria matrix.
// LIMITS are on the LOAN AMOUNT (home price − down payment); LTV = loan / price.
// National base figures — vary by county and reset annually, so keep them here as
// config (later: per-community). See "06 Pathfinder 1A/GUI_Input_Edit_Checks_and_Limits.md".
export const LIMITS = {
  // Conventional / Jumbo (one continuum by loan size)
  conformingMax: 832_750,     // Conforming Conventional max loan
  jumboTier1Max: 2_000_000,   // Jumbo Tier 1 ceiling ($832,751–$2,000,000)
  jumboTier2Max: 3_500_000,   // Jumbo Tier 2 ceiling ($2,000,001–$3,500,000); above → LO only
  // FHA
  fhaMax: 573_361,            // FHA base $563,500 + financed UFMIP (1.75%). Assumes UFMIP financed.
  // VA
  vaStandardMax: 832_750,     // VA standard ceiling; above → VA Jumbo
  vaJumboTier1Max: 1_500_000, // VA Jumbo Tier 1 ceiling ($832,751–$1,500,000)
  vaJumboTier2Max: 2_500_000, // VA Jumbo Tier 2 ceiling ($1,500,001–$2,500,000); above → ineligible

  // Minimum credit (band floor) by program/tier
  minCredit: 620,             // Conforming Conventional + FHA
  jumboTier1MinCredit: 680,
  jumboTier2MinCredit: 700,
  vaStandardMinCredit: 620,
  vaJumboTier1MinCredit: 640,
  vaJumboTier2MinCredit: 680,

  // Max LTV by program/tier
  convMaxLtv: 0.95,           // 5% down
  convMaxLtvFirstTime: 0.97,  // 3% down (first-time)
  jumboTier1MaxLtv: 0.8999,   // ~10% down
  jumboTier2MaxLtv: 0.80,     // 20% down
  fhaMaxLtv: 0.965,           // 3.5% down
  vaMaxLtv: 1.0,              // 100% — no down required
};

// Credit band -> its floor score, to compare against the minimums above.
const BAND_FLOOR: Record<string, number> = {
  "620–639": 620, "640–659": 640, "660–679": 660, "680–699": 680,
  "700–719": 700, "720–739": 720, "740–759": 740, "760–779": 760, "780+": 780,
};

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
// Min down implied by a max LTV. Kept to 2 decimals so an 89.99% cap reads as
// "10.01%" (the true minimum) rather than a misleading "10%" that implies exactly
// 10% qualifies. Clean tiers stay clean: 0.95 -> "5%", 0.965 -> "3.5%", 0.80 -> "20%".
const downNeeded = (maxLtv: number) => {
  const pct = Math.round((1 - maxLtv) * 10000) / 100;
  return `${pct}%`;
};

export type Family = "conventional" | "fha" | "va";

export interface FamilyEligibility {
  family: Family;
  eligible: boolean;
  reason?: string; // shown on a greyed-out card when not eligible
  tier?: string;   // "Conforming" | "Jumbo" | "VA" | "VA Jumbo"
}

export interface Eligibility {
  conventional: FamilyEligibility;
  fha: FamilyEligibility;
  va: FamilyEligibility;
  routeMessage?: string; // shown only when nothing at all can be displayed
}

const no = (family: Family, reason: string, tier?: string): FamilyEligibility =>
  ({ family, eligible: false, reason, tier });

// Conventional + Jumbo is one continuum, selected by loan size.
function evalConventional(loan: number, ltv: number, credit: number, firstTime: boolean): FamilyEligibility {
  if (loan > LIMITS.jumboTier2Max)
    return no("conventional", `Above our jumbo limit (${money(LIMITS.jumboTier2Max)}) — a loan officer can discuss options.`, "Jumbo");

  if (loan > LIMITS.jumboTier1Max) { // Jumbo Tier 2
    if (credit < LIMITS.jumboTier2MinCredit)
      return no("conventional", `This jumbo tier needs a credit score of ${LIMITS.jumboTier2MinCredit}+.`, "Jumbo");
    if (ltv > LIMITS.jumboTier2MaxLtv)
      return no("conventional", `This jumbo tier needs at least ${downNeeded(LIMITS.jumboTier2MaxLtv)} down.`, "Jumbo");
    return { family: "conventional", eligible: true, tier: "Jumbo" };
  }

  if (loan > LIMITS.conformingMax) { // Jumbo Tier 1
    if (credit < LIMITS.jumboTier1MinCredit)
      return no("conventional", `This jumbo tier needs a credit score of ${LIMITS.jumboTier1MinCredit}+.`, "Jumbo");
    if (ltv > LIMITS.jumboTier1MaxLtv)
      return no("conventional", `This jumbo tier needs at least ${downNeeded(LIMITS.jumboTier1MaxLtv)} down.`, "Jumbo");
    return { family: "conventional", eligible: true, tier: "Jumbo" };
  }

  // Conforming Conventional
  const maxLtv = firstTime ? LIMITS.convMaxLtvFirstTime : LIMITS.convMaxLtv;
  if (credit < LIMITS.minCredit)
    return no("conventional", `Credit score below ${LIMITS.minCredit}.`, "Conforming");
  if (ltv > maxLtv)
    return no("conventional", `Needs at least ${downNeeded(maxLtv)} down${firstTime ? " (first-time)" : ""}.`, "Conforming");
  return { family: "conventional", eligible: true, tier: "Conforming" };
}

function evalFha(loan: number, ltv: number, credit: number, occupancy: Occupancy): FamilyEligibility {
  if (occupancy !== "Primary")
    return no("fha", "FHA loans require the home to be your primary residence — they aren't available for a second home or investment property.");
  if (loan > LIMITS.fhaMax)
    return no("fha", `FHA isn't available above ${money(LIMITS.fhaMax)} in this area.`);
  if (credit < LIMITS.minCredit)
    return no("fha", `Credit score below ${LIMITS.minCredit}.`);
  if (ltv > LIMITS.fhaMaxLtv)
    return no("fha", `Needs at least ${downNeeded(LIMITS.fhaMaxLtv)} down.`);
  return { family: "fha", eligible: true };
}

// VA — shown only when Veteran is checked; 100% LTV (no down required).
function evalVa(loan: number, credit: number, veteran: boolean, occupancy: Occupancy): FamilyEligibility {
  if (occupancy !== "Primary")
    return no("va", "VA loans require the home to be your primary residence — they aren't available for a second home or investment property.");
  if (!veteran)
    return no("va", "VA loans require military/veteran eligibility.");
  if (loan > LIMITS.vaJumboTier2Max)
    return no("va", `Above the VA jumbo limit (${money(LIMITS.vaJumboTier2Max)}) — a loan officer can discuss options.`, "VA Jumbo");

  let minCredit = LIMITS.vaStandardMinCredit;
  let tier = "VA";
  if (loan > LIMITS.vaJumboTier1Max) { minCredit = LIMITS.vaJumboTier2MinCredit; tier = "VA Jumbo"; }
  else if (loan > LIMITS.vaStandardMax) { minCredit = LIMITS.vaJumboTier1MinCredit; tier = "VA Jumbo"; }

  if (credit < minCredit)
    return no("va", `This VA loan size needs a credit score of ${minCredit}+.`, tier);
  return { family: "va", eligible: true, tier };
}

export function evaluateEligibility(input: PricingInput): Eligibility {
  const loan = Math.max(0, input.homePrice - input.downAmount);
  const ltv = input.homePrice > 0 ? loan / input.homePrice : 1;
  const credit = BAND_FLOOR[input.creditBand] ?? 0;

  const conventional = evalConventional(loan, ltv, credit, input.firstTime);
  const fha = evalFha(loan, ltv, credit, input.occupancy);
  const va = evalVa(loan, credit, input.veteran, input.occupancy);

  // routeMessage is a fallback for the case where no card can be shown at all
  // (e.g. nothing returned). With greyed-out cards we normally show the cards
  // themselves; this stays as a safety net.
  let routeMessage: string | undefined;
  if (!conventional.eligible && !fha.eligible && !va.eligible) {
    if (loan > LIMITS.jumboTier2Max)
      routeMessage = "This loan is above our standard limits — let's talk through your options. Use “Connect me with a loan officer” below.";
    else
      routeMessage = "Let's talk through your options to find the right program for you. Use “Connect me with a loan officer” below.";
  }
  return { conventional, fha, va, routeMessage };
}
