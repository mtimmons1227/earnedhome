import type {
  PricingAdapter, PricingInput, PricingProduct, PricingQuote, ProductName,
} from "./types";
import { RPARRY_DISCLOSURES } from "./disclosures";

const CREDIT_ADJ: Record<string, number> = {
  "780+": -0.25, "760–779": -0.125, "740–759": 0, "720–739": 0.125, "700–719": 0.25,
  "680–699": 0.45, "660–679": 0.65, "640–659": 0.95, "620–639": 1.25,
};
const OCC_ADJ: Record<string, number> = {
  "Primary": 0, "Second Home": 0.25, "Investment": 0.625,
};

function money(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

/**
 * Stub pricing — illustrative math ported from the prototype. NOT real loan
 * pricing. Replaced by the Graph-backed live workbook in Phase 1A.2 behind
 * this same PricingAdapter contract.
 */
export const stubAdapter: PricingAdapter = {
  name: "stub",
  async quote(inp: PricingInput): Promise<PricingQuote> {
    const ca =
      (CREDIT_ADJ[inp.creditBand] ?? 0) +
      (OCC_ADJ[inp.occupancy] ?? 0) -
      (inp.veteran ? 0.05 : 0);

    const taxes = (inp.homePrice * 0.0125) / 12;
    const insurance = Math.max(95, (inp.homePrice * 0.0035) / 12);

    const build = (
      product: ProductName, baseRate: number, termYears: 15 | 30, isFha: boolean, isVa = false,
    ): PricingProduct => {
      const rate = +(baseRate + ca).toFixed(3);
      const loan = inp.homePrice - inp.downAmount;
      const n = termYears * 12;
      const mr = rate / 100 / 12;
      const pi = loan * mr / (1 - Math.pow(1 + mr, -n));
      const ltv = loan / inp.homePrice;
      let mi = 0;
      if (!isVa) {
        if (isFha) mi = (loan * 0.0055) / 12;
        else if (ltv > 0.8) mi = (loan * 0.0052) / 12;
      }
      const loanFees = Math.round(loan * 0.02);
      const prepaids = Math.round(inp.homePrice * 0.005);
      const downPayment = Math.round(inp.downAmount);
      const lessSeller = Math.round(inp.sellerCredit);
      return {
        product, displayName: product, termYears, isFha, isVa,
        loanFees, prepaids, downPayment, lessSeller,
        cashToClose: Math.max(0, loanFees + prepaids + downPayment - lessSeller),
        rate,
        apr: +(rate + (isFha ? 0.92 : 0.18)).toFixed(3),
        principalAndInterest: Math.round(pi),
        taxes: Math.round(taxes),
        insurance: Math.round(insurance),
        mortgageInsurance: Math.round(mi),
        totalPayment: Math.round(pi + taxes + insurance + mi),
      };
    };

    return {
      engine: "stub",
      ratesAsOf: new Date().toISOString().slice(0, 10),
      cashToClose: Math.max(
        0,
        Math.round(inp.downAmount + inp.homePrice * 0.03 - inp.sellerCredit),
      ),
      products: [
        build("30-yr Fixed", 6.625, 30, false),
        build("30-yr FHA", 6.25, 30, true),
        build("15-yr Fixed", 5.875, 15, false),
        build("15-yr FHA", 5.625, 15, true),
        build("30-yr VA", 6.125, 30, false, true),
        build("15-yr VA", 5.5, 15, false, true),
      ],
      disclosures: [
        ...RPARRY_DISCLOSURES,
        "For this estimate, a seller credit of " + money(inp.sellerCredit) +
          " is applied to cash to close.",
      ],
    };
  },
};
