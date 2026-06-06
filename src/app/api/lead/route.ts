import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  let body: {
    tenantId?: string; loName?: string; fullName?: string; email?: string;
    phone?: string; consentTcpa?: boolean; consentText?: string;
    quoteId?: string | null; idempotencyKey?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    tenantId, loName, fullName, email, phone, consentTcpa, consentText,
    quoteId, idempotencyKey,
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

  // TODO (WBS #17): notify the LO via email + SMS (Resend/SendGrid + Twilio).
  return NextResponse.json({ ok: true, deduped: false, leadId, routedTo: loName ?? null });
}
