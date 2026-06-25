// The fixed Pricing contract. The app ALWAYS talks to this interface.
// Today it is backed by a stub; in Phase 1A.2 a Microsoft Graph adapter
// drives Richard's live workbook behind the same contract — zero front-end change.
// Field names mirror the workbook's named ranges (eh_in_* / eh_out_*).

export type CreditBand =
  | "780+" | "760–779" | "740–759" | "720–739" | "700–719"
  | "680–699" | "660–679" | "640–659" | "620–639";

export type Occupancy = "Primary" | "Second Home" | "Investment";
export type PropertyType = "Single Family" | "2-4 Unit" | "Condo" | "Manufactured";

// eh_in_*
export interface PricingInput {
  homePrice: number;      // eh_in_home_price
  downAmount: number;     // eh_in_down_amount
  downPct: number;        // eh_in_down_pct
  creditBand: CreditBand; // eh_in_credit_band
  occupancy: Occupancy;   // eh_in_occupancy
  sellerCredit: number;   // eh_in_seller_credit
  propertyType: PropertyType; // eh_in_propertyType (1=Single Family, 2=2-4 Unit, 3=Condo, 4=Manufactured)
  veteran: boolean;       // eh_in_veteran
  firstTime: boolean;     // eh_in_first_time
  vaPriorLoan: boolean;     // eh_in_vaPriorLoan
  vaDisability: boolean;    // eh_in_vaDisability
  vaFundingFee: boolean;    // eh_in_vaFundingFee
}

export type ProductName =
  | "30-yr Fixed" | "30-yr FHA" | "15-yr Fixed" | "15-yr FHA"
  | "30-yr VA" | "15-yr VA";

// eh_out_* (per product)
export interface PricingProduct {
  product: ProductName;       // internal key (slot identity)
  displayName: string;        // eh_out_<prefix>_name — heading from the sheet ("Jumbo 30 Year Fixed", etc.)
  termYears: 15 | 30;
  isFha: boolean;
  isVa: boolean;
  rate: number;
  apr: number;
  principalAndInterest: number;
  taxes: number;
  insurance: number;
  mortgageInsurance: number;
  totalPayment: number;
  // Estimated Funds breakdown (eh_out_<prefix>_*); these sum to cashToClose.
  loanFees: number;
  prepaids: number;
  downPayment: number;
  lessSeller: number;
  cashToClose: number;     // eh_out_<prefix>_cashToClose = "Estimated Total"
}

export interface PricingQuote {
  ratesAsOf: string;       // eh_out_rates_as_of (YYYY-MM-DD)
  cashToClose: number;     // eh_out_cash_to_close
  products: PricingProduct[];
  disclosures: string[];
  engine: "stub" | "graph";
  // Optional perf telemetry (graph adapter only) for latency before/after testing.
  meta?: { tookMs: number; graphCalls: number; cached: boolean };
}

export interface PricingAdapter {
  readonly name: "stub" | "graph";
  quote(input: PricingInput): Promise<PricingQuote>;
}
