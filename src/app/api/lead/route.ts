import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createSupabaseServer } from "@/lib/supabase/server";
import { sendBuyerEstimateEmail, sendLoLeadAlert, sendAgentLeadAlert, type EstimateEmailProduct } from "@/lib/email";
import { emitLeadCreated } from "@/lib/leadEvent";

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
    tenantId?: string; loName?: string; loPhone?: string | null; bookingUrl?: string | null;
    fullName?: string; email?: string;
    phone?: string; consentTcpa?: boolean; consentText?: string;
    quoteId?: string | null; idempotencyKey?: string | null; agentId?: string | null;
    quoteSummary?: QuoteSummary | null;
    action?: string | null; // "apply" | "call" | "book" | "reach-out"
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    tenantId, loName, loPhone, bookingUrl, fullName, email, phone, consentTcpa, consentText,
    quoteId, idempotencyKey, quoteSummary, action, agentId,
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
    agent_id: agentId ?? null,
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

  // Best-effort side effects. IMPORTANT: on serverless (Netlify Functions) the
  // execution context is frozen the instant the response returns, so plain
  // fire-and-forget (`void`) promises get cut off and emails send only
  // intermittently. We collect them and `await Promise.allSettled` before
  // returning so they reliably complete. Each is wrapped so a failure never
  // blocks lead capture (the lead is already saved above).
  const sideEffects: Promise<unknown>[] = [];

  // Event log
  sideEffects.push(
    (async () => {
      try {
        await supabase.from("events").insert({
          tenant_id: tenantId,
          type: "lead_captured",
          payload: { leadId, routedTo: loName ?? null, quoteId: quoteId ?? null },
        });
      } catch {
        /* best-effort */
      }
    })(),
  );

  // Buyer estimate email. No-ops if Resend isn't configured.
  if (email && quoteSummary) {
    sideEffects.push(
      sendBuyerEstimateEmail({
        to: email,
        buyerName: fullName ?? null,
        loName: loName ?? "your loan officer",
        loPhone: loPhone ?? null,
        bookingUrl: bookingUrl ?? null,
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
      })
        .then((r) => { if (!r.sent) console.log("[lead] buyer estimate email not sent:", r.reason); })
        .catch((e) => console.log("[lead] buyer estimate email error:", (e as Error).message)),
    );
  }

  // LO lead alert (+ agent copy). Looks up the tenant's notify_email/lo_name and,
  // if the estimate came through an agent link, that agent's name/email.
  // (Cast: notify_email is a new 0006 column not yet in generated DB types.)
  sideEffects.push(
    (async () => {
      try {
        // Attribution: the realtor agent who ran the estimate, if any.
        let agentName: string | null = null;
        let agentEmail: string | null = null;
        if (agentId) {
          const aRes = await supabase.from("agents").select("name, email").eq("id", agentId).maybeSingle();
          agentName = aRes.data?.name ?? null;
          agentEmail = aRes.data?.email ?? null;
        }

        const tRes = await (supabase.from("tenants") as unknown as {
          select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { notify_email?: string | null; lo_name?: string | null } | null }> } };
        }).select("notify_email, lo_name").eq("id", tenantId).maybeSingle();
        const loDisplay = tRes.data?.lo_name ?? loName ?? "your loan officer";
        // Per-environment override: the DB notify_email is shared across all
        // Netlify contexts (one Supabase project). Setting LEAD_NOTIFY_OVERRIDE
        // on the QA / local contexts routes test alerts to a test inbox while
        // Production (no override) uses the real DB value (the LO).
        const notify = process.env.LEAD_NOTIFY_OVERRIDE || tRes.data?.notify_email || null;

        // The loan officer's alert (names the agent it came through).
        if (notify) {
          const r = await sendLoLeadAlert({
            to: notify,
            loName: loDisplay,
            agentName,
            buyerName: fullName ?? null,
            buyerEmail: email ?? null,
            buyerPhone: phone ?? null,
            action: action ?? null,
            homePrice: quoteSummary?.homePrice,
            downAmount: quoteSummary?.downAmount,
            downPct: quoteSummary?.downPct,
            creditBand: quoteSummary?.creditBand,
            occupancy: quoteSummary?.occupancy,
            propertyType: quoteSummary?.propertyType,
            leadId,
          });
          if (!r.sent) console.log("[lead] LO alert not sent:", r.reason);
        }

        // The agent's own copy ("your buyer just signed up").
        if (agentEmail) {
          const ar = await sendAgentLeadAlert({
            to: agentEmail,
            agentName,
            loName: loDisplay,
            buyerName: fullName ?? null,
            buyerEmail: email ?? null,
            buyerPhone: phone ?? null,
            homePrice: quoteSummary?.homePrice,
            downAmount: quoteSummary?.downAmount,
            downPct: quoteSummary?.downPct,
            creditBand: quoteSummary?.creditBand,
            occupancy: quoteSummary?.occupancy,
            propertyType: quoteSummary?.propertyType,
            leadId,
          });
          if (!ar.sent) console.log("[lead] agent copy not sent:", ar.reason);
        }
      } catch (e) {
        console.log("[lead] LO/agent alert error:", (e as Error).message);
      }
    })(),
  );

  // Lead-event webhook (vendor-neutral seam) → downstream flow (Power Automate /
  // own backend) → partner CRM. No-ops if LEAD_EVENT_WEBHOOK_URL is unset; skips
  // when the tenant has no CRM configured.
  // (Cast: tenant_integrations isn't in the generated DB types yet.)
  sideEffects.push(
    (async () => {
      try {
        const iRes = await (supabase.from("tenant_integrations") as unknown as {
          select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { crm_type?: string | null; crm_api_key?: string | null; crm_config?: Record<string, unknown> | null } | null }> } };
        }).select("crm_type, crm_api_key, crm_config").eq("tenant_id", tenantId).maybeSingle();
        const crmType = iRes.data?.crm_type ?? "none";
        if (crmType === "none") return; // no CRM to push to — dashboard + email alert are enough
        const r = await emitLeadCreated({
          leadId,
          tenant: tenantId,
          crm: {
            type: crmType,
            apiKey: iRes.data?.crm_api_key ?? null,
            source: "EarnedHome",
            config: iRes.data?.crm_config ?? null,
          },
          buyer: { fullName: fullName ?? null, email: email ?? null, phone: phone ?? null, consentTcpa: true },
          scenario: {
            homePrice: quoteSummary?.homePrice,
            downAmount: quoteSummary?.downAmount,
            downPct: quoteSummary?.downPct,
            creditBand: quoteSummary?.creditBand,
            occupancy: quoteSummary?.occupancy,
            propertyType: quoteSummary?.propertyType,
          },
          action: action ?? null,
          createdAt: new Date().toISOString(),
        });
        if (!r.sent) console.log("[lead] lead.created webhook not sent:", r.reason);
      } catch (e) {
        console.log("[lead] webhook error:", (e as Error).message);
      }
    })(),
  );

  // Wait for all best-effort work to finish before the serverless function
  // freezes — this is what makes emails reliable on Netlify (vs fire-and-forget).
  await Promise.allSettled(sideEffects);

  return NextResponse.json({ ok: true, deduped: false, leadId, routedTo: loName ?? null });
}
