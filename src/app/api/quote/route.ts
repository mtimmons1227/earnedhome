import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getPricingAdapter } from "@/lib/pricing";
import type { PricingInput } from "@/lib/pricing/types";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  let body: { tenantId?: string; input?: PricingInput };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { tenantId, input } = body;
  if (!tenantId || !input) {
    return NextResponse.json({ error: "Missing tenantId or input" }, { status: 400 });
  }

  // Pricing is local + instant. The tenant was already resolved server-side on
  // page load, so we trust tenantId here and skip a DB lookup. RLS still gates
  // the insert (tenant must be active).
  const adapter = getPricingAdapter();
  const quote = await adapter.quote(input);

  // Generate the id server-side (no read-back: anon has INSERT, not SELECT).
  const quoteId = randomUUID();
  const supabase = createSupabaseServer();
  const [quoteRes] = await Promise.all([
    supabase.from("quotes").insert({
      id: quoteId,
      tenant_id: tenantId,
      inputs: input,
      outputs: quote,
      rates_as_of: quote.ratesAsOf,
    }),
    supabase.from("events").insert({
      tenant_id: tenantId,
      type: "quote_created",
      payload: { engine: quote.engine, quoteId },
    }),
  ]);
  if (quoteRes.error) console.error("quote insert failed:", quoteRes.error.message);

  return NextResponse.json({ quote, quoteId: quoteRes.error ? null : quoteId });
}
