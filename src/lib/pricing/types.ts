// The fixed Pricing contract. The app ALWAYS talks to this interface.
// Today it is backed by a stub; in Phase 1A.2 a Microsoft Graph adapter
// drives Richard's live workbook behind the same contract — zero front-end change.
// Field names mirror the workbook's named ranges (eh_in_* / eh_out_*).

export type CreditBand =
  | "780+" | "740–759" | "720–739" | "700–719"
  | "680–699" | "660–679" | "640–659";

export type Occupancy = "Primary" | "Second Home" | "Investment";
export type Buydown = "None" | "1-0" | "2-1" | "3-2-1";

// eh_in_*
export interface PricingInput {
  homePrice: number;      // eh_in_home_price
  downAmount: number;     // eh_in_down_amount
  downPct: number;        // eh_in_down_pct
  creditBand: CreditBand; // eh_in_credit_band
  occupancy: Occupancy;   // eh_in_occupancy
  sellerCredit: number;   // eh_in_seller_credit
  buydown: Buydown;       // eh_in_buydown
  veteran: boolean;       // eh_in_veteran
  firstTime: boolean;     // eh_in_first_time
}

export type ProductName =
  | "30-yr Fixed" | "30-yr FHA" | "15-yr Fixed" | "15-yr FHA";

// eh_out_* (per product)
export interface PricingProduct {
  product: ProductName;
  termYears: 15 | 30;
  isFha: boolean;
  rate: number;
  apr: number;
  principalAndInterest: number;
  taxes: number;
  insurance: number;
  mortgageInsurance: number;
  totalPayment: number;
}

export interface PricingQuote {
  ratesAsOf: string;       // eh_out_rates_as_of (YYYY-MM-DD)
  cashToClose: number;     // eh_out_cash_to_close
  products: PricingProduct[];
  disclosures: string[];
  engine: "stub" | "graph";
}

export interface PricingAdapter {
  readonly name: "stub" | "graph";
  quote(input: PricingInput): Promise<PricingQuote>;
}
