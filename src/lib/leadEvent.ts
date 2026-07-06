// Vendor-neutral lead-event seam.
//
// SAFE BY DESIGN: if LEAD_EVENT_WEBHOOK_URL isn't set, this no-ops. The lead is
// already saved to Supabase before this runs, so a missing or failing webhook
// never affects lead capture. This is the single seam for pushing leads
// downstream — today a Power Automate flow that maps + posts into the partner's
// CRM (Follow Up Boss / Lasso); tomorrow it can point at our own backend with no
// change to the app. See docs: EarnedHome_LeadPush_PowerAutomate_Design.

export interface LeadEventCrm {
  type: string; // "followupboss" | "lasso" | "boldtrail" | "other" | "none"
  apiKey?: string | null;
  source?: string | null;
  config?: Record<string, unknown> | null;
}

export interface LeadCreatedEvent {
  leadId: string; // idempotency key
  tenant: string | null;
  crm: LeadEventCrm;
  buyer: {
    fullName: string | null;
    email: string | null;
    phone: string | null;
    consentTcpa: boolean;
  };
  scenario: {
    homePrice?: number;
    downAmount?: number;
    downPct?: number;
    creditBand?: string;
    occupancy?: string;
    propertyType?: string;
  };
  action: string | null;
  createdAt: string;
}

export async function emitLeadCreated(
  ev: LeadCreatedEvent,
): Promise<{ sent: boolean; reason?: string }> {
  const url = process.env.LEAD_EVENT_WEBHOOK_URL;
  if (!url) {
    return { sent: false, reason: "lead event webhook not configured (LEAD_EVENT_WEBHOOK_URL)" };
  }
  const secret = process.env.LEAD_EVENT_SECRET ?? "";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-eh-secret": secret },
      body: JSON.stringify({ event: "lead.created", ...ev }),
    });
    if (!res.ok) return { sent: false, reason: `webhook returned ${res.status}` };
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: (e as Error).message };
  }
}
