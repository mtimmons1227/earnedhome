/**
 * R Parry Financial — canonical rate-quote disclosures.
 *
 * Source of truth: "R Parry Financial LLC - Disclosure for Rate Calculation.docx"
 * (R Parry Financial OneDrive → 06 Pathfinder 1A). The wording is Richard's,
 * grouped here into paragraphs so it renders cleanly in the buyer tool's
 * "Disclosures & assumptions" section. Both pricing adapters (stub + graph)
 * import this, so the legal text is maintained in ONE place.
 *
 * Compliance: this language must be reviewed/approved by R Parry (and counsel)
 * via a deploy preview BEFORE any production release. Estimates-only /
 * not-a-credit-decision posture per Reg Z / TILA / RESPA.
 *
 * Multi-tenant note: R Parry Financial is the lender across the current pilot.
 * If other lenders are onboarded, move this to tenant-level branding data.
 */
export const RPARRY_DISCLOSURES: string[] = [
  "This online tool provides interest rate, APR, and fee estimates for informational and educational purposes only. It is an advertisement and does not constitute an offer to lend, a commitment to lock an interest rate, or a formal loan approval. The figures are preliminary estimates based on limited user input and current market conditions. This is NOT a Loan Estimate (LE) as defined by RESPA or TILA — a formal Loan Estimate will only be provided after you submit a complete, official mortgage application and your credit and property details are verified.",
  "APR (Annual Percentage Rate) reflects the actual annual cost of a loan and includes the loan interest rate, private mortgage insurance, points, and certain fees. The APR includes the approximate cost of prepaid finance charges, points associated with the rate displayed, and some third-party fees; it does not include other closing costs. Actual APRs for individual loans may differ.",
  "Estimated rates, APRs, and loan fees fluctuate daily based on market conditions. Your actual interest rate and APR will depend on comprehensive underwriting factors, including but not limited to your verified credit score, debt-to-income (DTI) ratio, loan-to-value (LTV) ratio, property type, and final loan program selection, and on the specific characteristics of your transaction and your credit profile up to the time of closing.",
  "If your down payment or equity is less than 20%, mortgage insurance will be required, which will increase the monthly payment. The information provided assumes no other loans or liens on the subject property. Payments shown for property taxes and insurance premiums are estimated and do not include amounts for flood insurance; actual payments may be higher. Hazard insurance is required, and flood insurance may be required if the property is located in a flood zone. Maximum loan limits may apply.",
  "This potential mortgage loan rate/product/parameters quote is not a credit decision or a commitment to lend. All loan applications are subject to credit and property approval and normal underwriting qualifications. Rates and product availability may vary based on the state or region in which the property is located, your debt ratio, credit history, income and asset structure, property condition, your number of other financed properties, and other factors. Additional rates and programs are available. Consult your tax advisor regarding the deductibility of interest. Some restrictions may apply.",
  "Any nontraditional mortgage products or reduced-documentation mortgage loans (for example, limited-documentation, reduced-documentation, or no-documentation loans) may have higher interest rates, more points, or more fees than products requiring full documentation.",
  "R Parry Financial LLC — licensed Mortgage Loan Originator, NMLS ID #1924318. Richard Parry McHargue — NMLS ID #927662. Equal Housing Lender. Loan programs are subject to change without notice; all loans are subject to credit approval.",
];
