// Buyer estimate email via Resend.
//
// SAFE BY DESIGN: if RESEND_API_KEY / RESEND_FROM aren't set, this no-ops and
// returns { sent:false } — the lead-capture flow never breaks on a missing email
// config. So the code can ship dormant and "turn on" once Resend is configured
// (a verified from-domain + API key in the env store).

export interface EstimateEmailProduct {
  name: string;          // displayName, e.g. "30 Year Fixed"
  rate: number;          // percent, e.g. 6.125
  totalPayment: number;  // monthly total
  cashToClose: number;   // estimated cash to close for THIS product
}

export interface BuyerEstimateEmail {
  to: string;
  buyerName?: string | null;
  loName: string;
  ratesAsOf: string;
  // The buyer's scenario (so the numbers have context).
  homePrice?: number;
  downAmount?: number;
  downPct?: number;
  creditBand?: string;
  occupancy?: string;
  propertyType?: string;
  cashToClose: number;
  products: EstimateEmailProduct[];
  disclosures: string[];
}

// Alert emailed to the loan officer the moment a buyer connects.
export interface LoLeadAlert {
  to: string;            // tenant.notify_email
  loName: string;
  agentName?: string | null; // the realtor who ran the estimate, if any
  buyerName?: string | null;
  buyerEmail?: string | null;
  buyerPhone?: string | null;
  action?: string | null; // "apply" | "call" | "book" | "reach-out"
  homePrice?: number;
  downAmount?: number;
  downPct?: number;
  creditBand?: string;
  occupancy?: string;
  propertyType?: string;
  leadId?: string;
}

// Copy of the lead alert emailed to the realtor agent who ran the estimate.
export interface AgentLeadAlert {
  to: string;            // agent.email
  agentName?: string | null;
  loName: string;        // the lender the buyer connects with, e.g. "R Parry Financial"
  buyerName?: string | null;
  buyerEmail?: string | null;
  buyerPhone?: string | null;
  homePrice?: number;
  downAmount?: number;
  downPct?: number;
  creditBand?: string;
  occupancy?: string;
  propertyType?: string;
  leadId?: string;
}

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

export async function sendBuyerEstimateEmail(data: BuyerEstimateEmail): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) return { sent: false, reason: "email not configured (RESEND_API_KEY / RESEND_FROM)" };
  if (!data.to) return { sent: false, reason: "no recipient email" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to: data.to,
        subject: "Your home payment estimate",
        html: renderHtml(data),
      }),
    });
    if (!res.ok) return { sent: false, reason: `resend ${res.status}: ${(await res.text()).slice(0, 140)}` };
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: (e as Error).message };
  }
}

// Loan-officer lead alert via Resend. Same safe-by-design no-op if unset.
export async function sendLoLeadAlert(d: LoLeadAlert): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) return { sent: false, reason: "email not configured (RESEND_API_KEY / RESEND_FROM)" };
  if (!d.to) return { sent: false, reason: "no LO notify email" };

  const actionLabel =
    d.action === "apply" ? "start an application" :
    d.action === "call" ? "call you now" :
    d.action === "book" ? "book a time with you" :
    "have you reach out";
  const name = d.buyerName ? escapeHtml(d.buyerName) : "A buyer";
  const rows: string[] = [];
  if (d.agentName) rows.push(`<strong>Agent:</strong> ${escapeHtml(d.agentName)}`);
  if (d.buyerPhone) rows.push(`<strong>Phone:</strong> ${escapeHtml(d.buyerPhone)}`);
  if (d.buyerEmail) rows.push(`<strong>Email:</strong> ${escapeHtml(d.buyerEmail)}`);
  if (d.homePrice != null) rows.push(`<strong>Home price:</strong> ${money(d.homePrice)}`);
  if (d.downAmount != null) rows.push(`<strong>Down:</strong> ${money(d.downAmount)}${d.downPct != null ? ` (${d.downPct}%)` : ""}`);
  if (d.creditBand) rows.push(`<strong>Credit:</strong> ${escapeHtml(d.creditBand)}`);
  const use = [d.occupancy, d.propertyType].filter(Boolean).map((x) => escapeHtml(x as string));
  if (use.length) rows.push(`<strong>Use:</strong> ${use.join(" · ")}`);

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;max-width:560px;">
    <h2 style="color:#1F3864;margin:0 0 8px;">New buyer lead — EarnedHome</h2>
    <p><strong>${name}</strong>${d.agentName ? ` (via ${escapeHtml(d.agentName)})` : ""} just ran the numbers and chose to <strong>${actionLabel}</strong>.</p>
    <div style="background:#f3f4f6;border-radius:8px;padding:12px 14px;margin:8px 0;font-size:14px;line-height:1.7;">
      ${rows.map((r) => `<div>${r}</div>`).join("")}
    </div>
    <p style="font-size:12px;color:#6b7280;">Captured with TCPA consent via your EarnedHome page${d.leadId ? ` (lead ${escapeHtml(d.leadId)})` : ""}.</p>
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: d.to, subject: `New buyer lead — ${name}`, html }),
    });
    if (!res.ok) return { sent: false, reason: `resend ${res.status}: ${(await res.text()).slice(0, 140)}` };
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: (e as Error).message };
  }
}

// Agent's copy of the lead alert. Same safe-by-design no-op if Resend or the
// agent's email is unset.
export async function sendAgentLeadAlert(d: AgentLeadAlert): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) return { sent: false, reason: "email not configured (RESEND_API_KEY / RESEND_FROM)" };
  if (!d.to) return { sent: false, reason: "no agent email" };

  const name = d.buyerName ? escapeHtml(d.buyerName) : "A buyer";
  const rows: string[] = [];
  if (d.buyerPhone) rows.push(`<strong>Phone:</strong> ${escapeHtml(d.buyerPhone)}`);
  if (d.buyerEmail) rows.push(`<strong>Email:</strong> ${escapeHtml(d.buyerEmail)}`);
  if (d.homePrice != null) rows.push(`<strong>Home price:</strong> ${money(d.homePrice)}`);
  if (d.downAmount != null) rows.push(`<strong>Down:</strong> ${money(d.downAmount)}${d.downPct != null ? ` (${d.downPct}%)` : ""}`);
  if (d.creditBand) rows.push(`<strong>Credit:</strong> ${escapeHtml(d.creditBand)}`);
  const use = [d.occupancy, d.propertyType].filter(Boolean).map((x) => escapeHtml(x as string));
  if (use.length) rows.push(`<strong>Use:</strong> ${use.join(" · ")}`);

  const hi = d.agentName ? `Hi ${escapeHtml(d.agentName.split(" ")[0])},` : "Hi,";
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;max-width:560px;">
    <h2 style="color:#1F3864;margin:0 0 8px;">Your buyer just signed up — EarnedHome</h2>
    <p>${hi}</p>
    <p>Your buyer <strong>${name}</strong> just ran the numbers and connected with <strong>${escapeHtml(d.loName)}</strong>.</p>
    <div style="background:#f3f4f6;border-radius:8px;padding:12px 14px;margin:8px 0;font-size:14px;line-height:1.7;">
      ${rows.map((r) => `<div>${r}</div>`).join("")}
    </div>
    <p style="font-size:12px;color:#6b7280;">Captured with TCPA consent via your EarnedHome link${d.leadId ? ` (lead ${escapeHtml(d.leadId)})` : ""}.</p>
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: d.to, subject: `Your buyer ${name} just signed up`, html }),
    });
    if (!res.ok) return { sent: false, reason: `resend ${res.status}: ${(await res.text()).slice(0, 140)}` };
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: (e as Error).message };
  }
}

// "Here's your EarnedHome link" — emailed to a realtor agent so they can start
// sharing it with buyers. Same safe-by-design no-op if Resend / email unset.
export interface AgentLinkInvite {
  to: string;            // agent.email
  agentName?: string | null;
  loName: string;        // the lender, e.g. "R Parry Financial"
  link: string;          // the agent's /a/<slug> URL
}

export async function sendAgentLinkInvite(d: AgentLinkInvite): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) return { sent: false, reason: "email not configured (RESEND_API_KEY / RESEND_FROM)" };
  if (!d.to) return { sent: false, reason: "no agent email" };

  const hi = d.agentName ? `Hi ${escapeHtml(d.agentName.split(" ")[0])},` : "Hi,";
  const safeLink = escapeHtml(d.link);
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;max-width:560px;">
    <h2 style="color:#1F3864;margin:0 0 8px;">Here's your EarnedHome link</h2>
    <p>${hi}</p>
    <p>This is your personal EarnedHome link. Keep it handy on your phone or tablet when you're
       out showing homes — you and your buyer can run real monthly-payment numbers together, right
       there at the property, so they can picture the true cost before they fall for a home.</p>
    <p>Every buyer who runs the numbers from your link is automatically tied to you, and you'll get
       a copy of the lead — while <strong>${escapeHtml(d.loName)}</strong> handles the financing.</p>
    <p style="margin:16px 0;">
      <a href="${safeLink}" style="background:#1F3864;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block;">Open your link</a>
    </p>
    <p style="font-size:13px;color:#6b7280;word-break:break-all;">${safeLink}</p>
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: d.to, subject: "Your EarnedHome estimate link", html }),
    });
    if (!res.ok) return { sent: false, reason: `resend ${res.status}: ${(await res.text()).slice(0, 140)}` };
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: (e as Error).message };
  }
}

function renderHtml(d: BuyerEstimateEmail): string {
  const greeting = d.buyerName ? `Hi ${escapeHtml(d.buyerName.split(" ")[0])},` : "Hi there,";

  // "Your scenario" box — the inputs the estimate is based on.
  const scen: string[] = [];
  if (d.homePrice != null) scen.push(`<strong>Home price:</strong> ${money(d.homePrice)}`);
  if (d.downAmount != null) scen.push(`<strong>Down payment:</strong> ${money(d.downAmount)}${d.downPct != null ? ` (${d.downPct}%)` : ""}`);
  if (d.creditBand) scen.push(`<strong>Credit score:</strong> ${escapeHtml(d.creditBand)}`);
  const use = [d.occupancy, d.propertyType].filter(Boolean).map((x) => escapeHtml(x as string));
  if (use.length) scen.push(`<strong>Use:</strong> ${use.join(" · ")}`);
  const scenarioHtml = scen.length
    ? `<div style="background:#f3f4f6;border-radius:8px;padding:12px 14px;margin:0 0 16px;font-size:13px;line-height:1.7;">${scen.map((r) => `<div>${r}</div>`).join("")}</div>`
    : "";

  const rows = d.products.map((p) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(p.name)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${p.rate.toFixed(3)}%</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${money(p.totalPayment)}/mo</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${money(p.cashToClose)}</td>
    </tr>`).join("");
  const disc = d.disclosures.map((x) => `<p style="margin:0 0 8px;">${escapeHtml(x)}</p>`).join("");
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;max-width:560px;margin:0 auto;padding:8px;">
    <h2 style="color:#1F3864;margin:0 0 4px;">Your home payment estimate</h2>
    <p style="color:#6b7280;margin:0 0 16px;font-size:13px;">Rates as of ${escapeHtml(d.ratesAsOf)}</p>
    <p>${greeting}</p>
    <p>Here's the estimate you ran. No pressure — your loan officer, <strong>${escapeHtml(d.loName)}</strong>, will reach out to talk through your options.</p>
    ${scenarioHtml}
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <thead><tr>
        <th style="text-align:left;padding:8px 12px;border-bottom:2px solid #1F3864;">Loan</th>
        <th style="text-align:right;padding:8px 12px;border-bottom:2px solid #1F3864;">Rate</th>
        <th style="text-align:right;padding:8px 12px;border-bottom:2px solid #1F3864;">Total payment</th>
        <th style="text-align:right;padding:8px 12px;border-bottom:2px solid #1F3864;">Cash to close</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="font-size:12px;color:#6b7280;margin:0 0 4px;">Cash to close and payment are estimates per loan option above.</p>
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#6b7280;line-height:1.5;">
      ${disc}
    </div>
  </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
