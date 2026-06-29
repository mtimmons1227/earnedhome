import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createSupabaseServer } from "@/lib/supabase/server";
import { sendBuyerEstimateEmail, type EstimateEmailProduct } from "@/lib/email";

interface QuoteSummary {
  ratesAsOf: string;
  cashToClose: number;
  products: EstimateEmailProduct[];
  disclosures: string[];
  homePrice?: number;
  downAmount?: number;
  downPct?: number;
  creditBand?: string;
  occupancy?: string;
  propertyType?: string;
}

export async function POST(req: Request) {
  let body: {
    tenantId?: string; loName?: string; fullName?: string; email?: string;
    phone?: string; consentTcpa?: boolean; consentText?: string;
    quoteId?: string | null; idempotencyKey?: string | null;
    quoteSummary?: QuoteSummary | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    tenantId, loName, fullName, email, phone, consentTcpa, consentText,
    quoteId, idempotencyKey, quoteSummary,
  } = body;
  if (!tenantId) {
    return NextResponse.json({ error: "Missing tenantId" }, { status: 400 });
  }
  // TCPA gate: never store/route a lead without explicit consent.
  if (!consentTcpa) {
    return NextResponse.json({ error: "TCPA consent required" }, { status: 422 });
  }

  // Generate the id server-side and insert directly (no read-back: the anon
  // buyer role has INSERT but no SELECT on leads by design).
  const leadId = randomUUID();
  const supabase = createSupabaseServer();
  const { error } = await supabase.from("leads").insert({
    id: leadId,
    tenant_id: tenantId,
    quote_id: quoteId ?? null,
    idempotency_key: idempotencyKey ?? null,
    full_name: fullName ?? null,
    email: email ?? null,
    phone: phone ?? null,
    consent_tcpa: true,
    consent_text: consentText ?? null,
    consent_at: new Date().toISOString(),
    source: "pathfinder",
    routed_to: loName ?? null,
    status: "new",
  });

  if (error) {
    // 23505 = unique_violation on (tenant_id, idempotency_key): this exact
    // submission was already captured. Treat as success, but don't create a
    // duplicate row or a duplicate event.
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, deduped: true, routedTo: loName ?? null });
    }
    console.error("lead insert failed:", error.message);
    return NextResponse.json({ error: "Could not save lead" }, { status: 500 });
  }

  // New lead only: log the event without blocking the response.
  void supabase.from("events").insert({
    tenant_id: tenantId,
    type: "lead_captured",
    payload: { leadId, routedTo: loName ?? null, quoteId: quoteId ?? null },
  });

  // Buyer estimate email (best-effort, non-blocking). No-ops if Resend isn't
  // configured, so a missing email setup never affects lead capture.
  if (email && quoteSummary) {
    void sendBuyerEstimateEmail({
      to: email,
      buyerName: fullName ?? null,
      loName: loName ?? "your loan officer",
      ratesAsOf: quoteSummary.ratesAsOf,
      homePrice: quoteSummary.homePrice,
      downAmount: quoteSummary.downAmount,
      downPct: quoteSummary.downPct,
      creditBand: quoteSummary.creditBand,
      occupancy: quoteSummary.occupancy,
      propertyType: quoteSummary.propertyType,
      cashToClose: quoteSummary.cashToClose,
      products: quoteSummary.products ?? [],
      disclosures: quoteSummary.disclosures ?? [],
    }).then((r) => { if (!r.sent) console.log("[lead] buyer estimate email not sent:", r.reason); });
  }

  // TODO (WBS #17): notify the LO via email + SMS (Resend/SendGrid + Twilio).
  return NextResponse.json({ ok: true, deduped: false, leadId, routedTo: loName ?? null });
}
