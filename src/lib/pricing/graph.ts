import type { PricingAdapter, PricingInput, PricingQuote } from "./types";

/**
 * Phase 1A.2 — Microsoft Graph (Excel) adapter.
 *
 * Implementation plan (WBS #21–27):
 *   1. Acquire app-only token (Entra client-credentials: GRAPH_* env vars).
 *   2. Open a workbook session on the COMPANY-controlled workbook
 *      (GRAPH_WORKBOOK_DRIVE_ID / GRAPH_WORKBOOK_ITEM_ID) — never Richard's
 *      personal OneDrive.
 *   3. Acquire the per-workbook lock (serialize writes — single calc surface).
 *   4. PATCH the eh_in_* named ranges with this input set.
 *   5. Trigger recalc; read the eh_out_* named ranges.
 *   6. Close the session, release the lock, map cells -> PricingQuote.
 *   Cache by input hash; invalidate on the daily rate update.
 *
 * Blocked until: workbook moved to controlled SharePoint/OneDrive (WBS #20),
 * named-range cell map delivered by Richard (WBS #22), Entra app registered (#4).
 */
export const graphAdapter: PricingAdapter = {
  name: "graph",
  async quote(_input: PricingInput): Promise<PricingQuote> {
    throw new Error(
      "Graph pricing adapter not yet implemented (Phase 1A.2). " +
        "Set PRICING_ADAPTER=stub until the live workbook is wired.",
    );
  },
};
