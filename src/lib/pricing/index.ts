import type { PricingAdapter } from "./types";
import { stubAdapter } from "./stub";
import { graphAdapter } from "./graph";

export * from "./types";

export function getPricingAdapter(): PricingAdapter {
  return process.env.PRICING_ADAPTER === "graph" ? graphAdapter : stubAdapter;
}
