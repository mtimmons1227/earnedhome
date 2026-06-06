/**
 * Calc-validation harness (WBS #26).
 *
 * Runs a scenario matrix through the active pricing engine and compares each
 * output to known-good ("golden") values captured from Richard's workbook,
 * within a $ tolerance. Fill scripts/engine-golden.json with the workbook's
 * numbers; any null is skipped and printed in "capture" mode so you can fill it.
 *
 * Run:   npm run validate:engine                 (stub — sanity-checks the harness)
 *        PRICING_ADAPTER=graph npm run validate:engine   (real engine, needs GRAPH_* env)
 *
 * Exits non-zero if any field is outside tolerance — so it can gate a deploy.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { getPricingAdapter } from "../src/lib/pricing";
import type { PricingInput, PricingProduct, PricingQuote } from "../src/lib/pricing/types";

type Num = number | null;
interface Golden {
  tolerance: number;
  scenarios: {
    name: string;
    input: PricingInput;
    expected: { cashToClose: Num; products: Record<string, Record<string, Num>> };
  }[];
}
const FIELDS = ["rate", "apr", "principalAndInterest", "taxes", "insurance", "mortgageInsurance", "totalPayment"] as const;

async function main(): Promise<void> {
  const golden = JSON.parse(
    readFileSync(resolve(process.cwd(), "scripts", "engine-golden.json"), "utf8"),
  ) as Golden;
  const tol = golden.tolerance ?? 1;
  const adapter = getPricingAdapter();

  let pass = 0, fail = 0, capture = 0;
  const failures: string[] = [];
  console.log(`\nCalc-validation — engine: ${adapter.name} · tolerance: $${tol}\n`);

  for (const sc of golden.scenarios) {
    console.log(`■ ${sc.name}`);
    let q: PricingQuote;
    try {
      q = await adapter.quote(sc.input);
    } catch (e) {
      console.log(`   ENGINE ERROR: ${(e as Error).message}`);
      fail++; failures.push(sc.name); console.log(""); continue;
    }

    const check = (label: string, actual: number, expected: Num): void => {
      if (expected == null) {
        capture++;
        console.log(`   [capture] ${label}: ${actual}   (fill golden from workbook)`);
        return;
      }
      const ok = Math.abs(actual - expected) <= tol;
      ok ? pass++ : (fail++, failures.push(`${sc.name} / ${label}`));
      console.log(`   ${ok ? "PASS" : "FAIL"} ${label}: expected ${expected}, got ${actual} (Δ ${(actual - expected).toFixed(2)})`);
    };

    check("cashToClose", q.cashToClose, sc.expected?.cashToClose ?? null);
    for (const p of q.products) {
      const exp = sc.expected?.products?.[p.product] ?? {};
      const row = p as unknown as Record<string, number>;
      for (const f of FIELDS) check(`${p.product}.${f}`, row[f], exp[f] ?? null);
    }
    console.log("");
  }

  console.log(`Summary: ${pass} pass · ${fail} fail · ${capture} awaiting golden values`);
  if (fail > 0) {
    console.log("\nFailures:\n - " + failures.join("\n - "));
    process.exit(1);
  }
}
void main();
