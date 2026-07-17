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
  loPhone?: string | null;
  bookingUrl?: string | null;
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
  shareUrl?: string | null; // Flow B: the buyer's own "share with a friend" /r link
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
  rootClientName?: string | null;   // the agent's own client at the top of the referral tree
  referredByName?: string | null;   // the person who directly shared it with this buyer
}

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

// Flow B — the buyer's own "share with a friend" block, appended to their estimate
// email so they can forward it from their inbox anytime (no need to re-run numbers).
function shareSection(shareUrl?: string | null): string {
  if (!shareUrl) return "";
  const safe = escapeHtml(shareUrl);
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:18px 0 0;padding:16px;border:1px solid #dbe4ee;background:#f4f8fc;border-radius:10px;">
    <p style="margin:0 0 6px;font-weight:700;color:#1F3864;font-size:15px;">Know someone else house-hunting?</p>
    <p style="margin:0 0 12px;font-size:14px;color:#374151;">Share this with a friend or family member so they can see what they can afford too — same quick estimate, no obligation.</p>
    <a href="${safe}" style="background:#1F3864;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;display:inline-block;">Share with a friend</a>
    <p style="font-size:12px;color:#6b7280;word-break:break-all;margin:10px 0 0;">${safe}</p>
  </div>`;
}

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
  // Referral framing: anchor on the agent's own client (root of the tree), and
  // note the direct sharer when it's a deeper (friend-of-a-friend) referral.
  const isReferral = !!d.rootClientName;
  const root = d.rootClientName ? escapeHtml(d.rootClientName) : "";
  const immediate = d.referredByName ? escapeHtml(d.referredByName) : "";
  const heading = isReferral ? "A referral in your network — EarnedHome" : "Your buyer just signed up — EarnedHome";
  const leadLine = isReferral
    ? `<p><strong>${name}</strong> just ran the numbers and connected with <strong>${escapeHtml(d.loName)}</strong>.</p>
       <p style="background:#eef3fb;border:1px solid #d6e2f3;border-radius:8px;padding:10px 12px;">This came from your client <strong>${root}</strong>'s referral network${immediate && immediate !== root ? ` — shared to them by <strong>${immediate}</strong>` : ""}.</p>`
    : `<p>Your buyer <strong>${name}</strong> just ran the numbers and connected with <strong>${escapeHtml(d.loName)}</strong>.</p>`;
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;max-width:560px;">
    <h2 style="color:#1F3864;margin:0 0 8px;">${heading}</h2>
    <p>${hi}</p>
    ${leadLine}
    <div style="background:#f3f4f6;border-radius:8px;padding:12px 14px;margin:8px 0;font-size:14px;line-height:1.7;">
      ${rows.map((r) => `<div>${r}</div>`).join("")}
    </div>
    <p style="font-size:12px;color:#6b7280;">Captured with TCPA consent via your EarnedHome link${d.leadId ? ` (lead ${escapeHtml(d.leadId)})` : ""}.</p>
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: d.to, subject: isReferral ? `A referral in your network — ${name}` : `Your buyer ${name} just signed up`, html }),
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
  link: string;          // the agent's /a/<slug> share URL
  statusLink?: string | null; // the agent's private /agent/<token> status portal URL
  guideUrl?: string | null;   // link to the Referral Partner Guide (PDF)
}

export async function sendAgentLinkInvite(d: AgentLinkInvite): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) return { sent: false, reason: "email not configured (RESEND_API_KEY / RESEND_FROM)" };
  if (!d.to) return { sent: false, reason: "no agent email" };

  const hi = d.agentName ? `Hi ${escapeHtml(d.agentName.split(" ")[0])},` : "Hi,";
  const safeLink = escapeHtml(d.link);
  const safeStatus = d.statusLink ? escapeHtml(d.statusLink) : null;
  const statusBlock = safeStatus
    ? `
    <div style="margin:22px 0 6px;border-top:1px solid #eee;padding-top:18px;">
      <h3 style="color:#1F3864;margin:0 0 6px;font-size:16px;">2) Track your buyers</h3>
      <p style="margin:0 0 12px;">This private link shows the status of the buyers you referred
         (connected, in process, closed). <strong>Bookmark it — and keep it private</strong>
         (don't forward it; it shows your buyers' status).</p>
      <p style="margin:0 0 8px;">
        <a href="${safeStatus}" style="background:#1F3864;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block;">See my buyers' status</a>
      </p>
      <p style="font-size:13px;color:#6b7280;word-break:break-all;">${safeStatus}</p>
    </div>`
    : "";
  const safeGuide = d.guideUrl ? escapeHtml(d.guideUrl) : null;
  const guideBlock = safeGuide
    ? `
    <div style="margin:24px 0 4px;border:1px solid #FCE8A6;background:#FFF8E1;border-radius:8px;padding:14px 16px;">
      <p style="margin:0 0 6px;font-weight:700;color:#8a5a00;font-size:15px;">📘 Your Referral Partner guide — save it for later</p>
      <p style="margin:0 0 12px;font-size:14px;color:#374151;">A quick step-by-step on running numbers with buyers and tracking your referrals. <strong>Download and save it now</strong> so it's handy when you need it.</p>
      <a href="${safeGuide}" style="background:#1F3864;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:700;display:inline-block;">⬇&nbsp; Download the guide (PDF)</a>
    </div>`
    : "";
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;max-width:560px;">
    <h2 style="color:#1F3864;margin:0 0 8px;">Your EarnedHome links</h2>
    <p>${hi}</p>
    <p><strong>Bookmark both links below</strong> — they're how you'll use EarnedHome (no login needed).</p>
    <h3 style="color:#1F3864;margin:18px 0 6px;font-size:16px;">1) Run buyers' numbers</h3>
    <p style="margin:0 0 12px;">Keep this link handy on your phone or tablet when you're out showing homes —
       you and your buyer can run real monthly-payment numbers together at the property. Every buyer who
       runs the numbers from it is automatically tied to you, and you'll get a copy of the lead —
       while <strong>${escapeHtml(d.loName)}</strong> handles the financing. Share this one with your buyers.</p>
    <p style="margin:0 0 8px;">
      <a href="${safeLink}" style="background:#1F3864;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block;">Open my estimate link</a>
    </p>
    <p style="font-size:13px;color:#6b7280;word-break:break-all;">${safeLink}</p>
    ${statusBlock}
    ${guideBlock}
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

// "See what you can afford" — emailed to a buyer by their agent, carrying the
// agent's estimate link (with a share token so the resulting lead links back to
// the invite). Same safe-by-design no-op if Resend / email unset.
export interface BuyerInviteEmail {
  to: string;                 // buyer email
  buyerName?: string | null;
  agentName?: string | null;  // the referring agent
  loName: string;             // financing by …
  link: string;               // /a/<slug>?st=<token>
}

export async function sendBuyerInviteEmail(d: BuyerInviteEmail): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) return { sent: false, reason: "email not configured (RESEND_API_KEY / RESEND_FROM)" };
  if (!d.to) return { sent: false, reason: "no buyer email" };

  const hi = d.buyerName ? `Hi ${escapeHtml(d.buyerName.split(" ")[0])},` : "Hi,";
  const safeLink = escapeHtml(d.link);
  const who = d.agentName ? escapeHtml(d.agentName) : "Your agent";
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;max-width:560px;">
    <h2 style="color:#1F3864;margin:0 0 8px;">See what you can afford</h2>
    <p>${hi}</p>
    <p>${who} put together a quick way for you to see real monthly-payment and
       cash-to-close estimates — no credit pull, no obligation. It takes about a minute.</p>
    <p style="margin:16px 0 8px;">
      <a href="${safeLink}" style="background:#1F3864;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block;">Run my numbers</a>
    </p>
    <p style="font-size:13px;color:#6b7280;word-break:break-all;">${safeLink}</p>
    <p style="font-size:13px;color:#6b7280;margin-top:18px;">Financing by ${escapeHtml(d.loName)}.
       This is an estimate for educational purposes only — not a loan approval or a commitment to lend.</p>
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: d.to, subject: "See what you can afford — a quick estimate", html }),
    });
    if (!res.ok) return { sent: false, reason: `resend ${res.status}: ${(await res.text()).slice(0, 140)}` };
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: (e as Error).message };
  }
}

// Buyer-initiated "email a friend" — the buyer typed a friend's address and we
// send that friend the estimate link. A single, buyer-driven referral (not a
// marketing list); the friend can forward it to anyone. No-op if Resend unset.
export interface ReferralToFriendEmail {
  to: string;                // the friend's email
  friendName?: string | null;
  loName: string;            // financing by …
  link: string;              // /r/<token> estimate link
}

export async function sendReferralToFriendEmail(d: ReferralToFriendEmail): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) return { sent: false, reason: "email not configured (RESEND_API_KEY / RESEND_FROM)" };
  if (!d.to) return { sent: false, reason: "no friend email" };

  const hi = d.friendName ? `Hi ${escapeHtml(d.friendName.split(" ")[0])},` : "Hi,";
  const safeLink = escapeHtml(d.link);
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;max-width:560px;">
    <h2 style="color:#1F3864;margin:0 0 8px;">A friend thought you'd want to see this</h2>
    <p>${hi}</p>
    <p>Someone you know just used EarnedHome to see what they can afford — and thought you might
       want to run your own numbers too. It takes about a minute — no credit pull, no obligation.</p>
    <p style="margin:16px 0 8px;">
      <a href="${safeLink}" style="background:#1F3864;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block;">See what I can afford</a>
    </p>
    <p style="font-size:13px;color:#6b7280;word-break:break-all;">${safeLink}</p>
    <p style="font-size:13px;color:#6b7280;margin-top:18px;">Financing by ${escapeHtml(d.loName)}. This is an
       estimate for educational purposes only — not a loan approval or a commitment to lend. Feel free to forward it to anyone.</p>
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: d.to, subject: "A friend thought you'd want to see this", html }),
    });
    if (!res.ok) return { sent: false, reason: `resend ${res.status}: ${(await res.text()).slice(0, 140)}` };
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: (e as Error).message };
  }
}

// "Set up your EarnedHome sign-in" — emailed to a loan officer so they can set
// their password and access their dashboard. Same safe-by-design no-op if unset.
export interface LoLoginInvite {
  to: string;            // the LO's email
  loName?: string | null;
  companyName?: string | null; // the broker, e.g. "R Parry Financial"
  link: string;          // the ONE-TIME set-password / recovery action link
  loginLink: string;     // the PERMANENT sign-in page URL (to bookmark)
  guideUrl?: string | null;   // link to the role-appropriate manual (PDF)
  guideLabel?: string | null; // e.g. "the Loan Officer Manual" / "the Broker Administrator Manual"
}

export async function sendLoLoginInvite(d: LoLoginInvite): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) return { sent: false, reason: "email not configured (RESEND_API_KEY / RESEND_FROM)" };
  if (!d.to) return { sent: false, reason: "no LO email" };

  const hi = d.loName ? `Hi ${escapeHtml(d.loName.split(" ")[0])},` : "Hi,";
  const safeLink = escapeHtml(d.link);
  const safeLogin = escapeHtml(d.loginLink);
  const company = d.companyName ? escapeHtml(d.companyName) : "your team";
  const safeGuide = d.guideUrl ? escapeHtml(d.guideUrl) : null;
  const guideLabel = d.guideLabel ? escapeHtml(d.guideLabel) : "your EarnedHome guide";
  const guideBlock = safeGuide
    ? `
    <div style="margin:22px 0 4px;border:1px solid #FCE8A6;background:#FFF8E1;border-radius:8px;padding:14px 16px;">
      <p style="margin:0 0 6px;font-weight:700;color:#8a5a00;font-size:15px;">📘 Your EarnedHome guide — save it for later</p>
      <p style="margin:0 0 12px;font-size:14px;color:#374151;">We've included ${guideLabel} (PDF). It walks you through everything step by step — <strong>download and save it now</strong> so you can review it whenever you like.</p>
      <a href="${safeGuide}" style="background:#1F3864;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:700;display:inline-block;">⬇&nbsp; Download the guide (PDF)</a>
    </div>`
    : "";
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;max-width:560px;">
    <h2 style="color:#1F3864;margin:0 0 8px;">Set up your EarnedHome sign-in</h2>
    <p>${hi}</p>
    <p>You've been added as a loan officer on <strong>${company}</strong>'s EarnedHome dashboard —
       you'll see your own leads, agents, and pipeline. There are two links below; here's what each does.</p>

    <h3 style="color:#1F3864;margin:20px 0 4px;font-size:15px;">1. First time only — set your password</h3>
    <p style="margin:0 0 10px;">Click this button once to create your password. It's a <strong>single-use link that expires</strong>, so it's only for your very first sign-in.</p>
    <p style="margin:6px 0;">
      <a href="${safeLink}" style="background:#1F3864;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block;">Set password &amp; sign in</a>
    </p>
    <p style="font-size:12px;color:#6b7280;word-break:break-all;">${safeLink}</p>

    <h3 style="color:#1F3864;margin:22px 0 4px;font-size:15px;">2. Every time after — your sign-in page</h3>
    <p style="margin:0 0 6px;">Once your password is set, always sign in here using your email and password:</p>
    <p style="margin:6px 0;">
      <a href="${safeLogin}" style="color:#1F3864;font-weight:600;">${safeLogin}</a>
    </p>
    <p style="font-size:13px;color:#374151;background:#EAF1F8;border-radius:6px;padding:10px 12px;">
      <strong>Please save this sign-in link to your bookmarks / favorites now.</strong>
      From your first sign-in onward, this is the page you'll use. Don't reuse the "Set password" button above — it's one-time only and will stop working.</p>

    <p style="font-size:12px;color:#6b7280;margin-top:14px;">Forgot your password later? Use “Forgot password?” on the sign-in page and we'll email you a reset link.</p>
    ${guideBlock}
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: d.to, subject: "Set up your EarnedHome sign-in", html }),
    });
    if (!res.ok) return { sent: false, reason: `resend ${res.status}: ${(await res.text()).slice(0, 140)}` };
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: (e as Error).message };
  }
}

// "Reset your EarnedHome password" — emailed when someone uses "Forgot password?".
// Uses the same own-domain /auth/confirm flow as the LO invite (beats Safe Links,
// sends from the verified domain, respects the Supabase redirect allow-list).
export interface PasswordResetEmail {
  to: string;
  loName?: string | null;
  companyName?: string | null;
  link: string;              // /auth/confirm?token_hash=...&type=recovery&next=/reset-password
}

export async function sendPasswordResetEmail(d: PasswordResetEmail): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) return { sent: false, reason: "email not configured (RESEND_API_KEY / RESEND_FROM)" };
  if (!d.to) return { sent: false, reason: "no email" };

  const hi = d.loName ? `Hi ${escapeHtml(d.loName.split(" ")[0])},` : "Hi,";
  const safeLink = escapeHtml(d.link);
  const company = d.companyName ? escapeHtml(d.companyName) : "EarnedHome";
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;max-width:560px;">
    <h2 style="color:#1F3864;margin:0 0 8px;">Reset your EarnedHome password</h2>
    <p>${hi}</p>
    <p>We received a request to reset the password for your <strong>${company}</strong> EarnedHome sign-in.
       Click below to choose a new password.</p>
    <p style="margin:16px 0;">
      <a href="${safeLink}" style="background:#1F3864;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block;">Reset password</a>
    </p>
    <p style="font-size:12px;color:#6b7280;word-break:break-all;">${safeLink}</p>
    <p style="font-size:12px;color:#6b7280;">This link is single-use and expires shortly. If you didn't request this,
       you can safely ignore this email — your password won't change.</p>
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: d.to, subject: "Reset your EarnedHome password", html }),
    });
    if (!res.ok) return { sent: false, reason: `resend ${res.status}: ${(await res.text()).slice(0, 140)}` };
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: (e as Error).message };
  }
}

// "Your EarnedHome password was changed" — a security notice sent right after a
// successful password reset. Acts as a tripwire: if it wasn't the owner, they
// find out and can act. Best-effort (a send failure never blocks the reset).
export interface PasswordChangedEmail {
  to: string;
  loName?: string | null;
  companyName?: string | null;
}

export async function sendPasswordChangedEmail(d: PasswordChangedEmail): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) return { sent: false, reason: "email not configured (RESEND_API_KEY / RESEND_FROM)" };
  if (!d.to) return { sent: false, reason: "no email" };

  const hi = d.loName ? `Hi ${escapeHtml(d.loName.split(" ")[0])},` : "Hi,";
  const company = d.companyName ? escapeHtml(d.companyName) : "EarnedHome";
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;max-width:560px;">
    <h2 style="color:#1F3864;margin:0 0 8px;">Your EarnedHome password was changed</h2>
    <p>${hi}</p>
    <p>The password for your <strong>${company}</strong> EarnedHome sign-in was just changed. If this was you, no action is needed.</p>
    <p style="background:#FFF8E1;border:1px solid #FCE8A6;border-radius:6px;padding:10px 12px;font-size:14px;">
      <strong>If this wasn't you</strong>, contact your broker administrator right away, then use
      <strong>Forgot password?</strong> on the sign-in page to reset it and lock the account back down.</p>
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: d.to, subject: "Your EarnedHome password was changed", html }),
    });
    if (!res.ok) return { sent: false, reason: `resend ${res.status}: ${(await res.text()).slice(0, 140)}` };
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: (e as Error).message };
  }
}

// "Share your loan progress with your agent?" — emailed to the buyer so they can
// grant or decline (and later change) letting their referring agent see their loan
// status. Buyer-initiated, always editable. Same safe-by-design no-op if unset.
export interface BuyerConsentRequest {
  to: string;            // the buyer's email
  buyerName?: string | null;
  agentName?: string | null;   // the referring agent
  companyName?: string | null; // the lender / company
  link: string;          // the buyer's private /consent/<token> page
}

export async function sendBuyerConsentRequest(d: BuyerConsentRequest): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) return { sent: false, reason: "email not configured (RESEND_API_KEY / RESEND_FROM)" };
  if (!d.to) return { sent: false, reason: "no buyer email" };

  const hi = d.buyerName ? `Hi ${escapeHtml(d.buyerName.split(" ")[0])},` : "Hi,";
  const agent = d.agentName ? escapeHtml(d.agentName) : "your agent";
  const company = d.companyName ? escapeHtml(d.companyName) : "your loan officer";
  const safeLink = escapeHtml(d.link);
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;max-width:560px;">
    <h2 style="color:#1F3864;margin:0 0 8px;">Share your loan progress with ${agent}?</h2>
    <p>${hi}</p>
    <p><strong>${agent}</strong> referred you to <strong>${company}</strong>. If you'd like, you can let
       ${agent} see your <strong>loan progress</strong> — simple stages like <em>In process</em> and
       <em>Closed</em>. They will <strong>never</strong> see your finances, credit, income, or loan
       details — those stay between you and ${company}.</p>
    <p>It's completely optional, and you can turn it on or off anytime.</p>
    <p style="margin:16px 0;">
      <a href="${safeLink}" style="background:#1F3864;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block;">Choose your sharing setting</a>
    </p>
    <p style="font-size:13px;color:#6b7280;word-break:break-all;">${safeLink}</p>
    <p style="font-size:12px;color:#6b7280;">Bookmark this link — it's your personal setting and you can
       come back to change it whenever you want.</p>
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: d.to, subject: `Share your loan progress with ${d.agentName ?? "your agent"}?`, html }),
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

  // "Get back to your loan officer" CTA — a booking button and/or phone number so
  // the buyer can always reconnect with the LO directly from the email.
  const ctaParts: string[] = [];
  if (d.bookingUrl) {
    ctaParts.push(`<a href="${escapeHtml(d.bookingUrl)}" style="background:#1F3864;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block;">Book a time with ${escapeHtml(d.loName)}</a>`);
  }
  if (d.loPhone) {
    ctaParts.push(`<p style="margin:10px 0 0;font-size:14px;">Prefer to talk now? Call ${escapeHtml(d.loName)} at <a href="tel:${escapeHtml(d.loPhone.replace(/[^0-9+]/g, ""))}" style="color:#1F3864;font-weight:600;">${escapeHtml(d.loPhone)}</a>.</p>`);
  }
  const ctaHtml = ctaParts.length
    ? `<div style="text-align:center;margin:20px 0;padding:16px;background:#f3f4f6;border-radius:8px;">${ctaParts.join("")}</div>`
    : "";

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
    ${ctaHtml}
    ${shareSection(d.shareUrl)}
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#6b7280;line-height:1.5;">
      ${disc}
    </div>
  </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
