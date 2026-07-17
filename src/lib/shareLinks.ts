import { createSupabaseAdmin } from "@/lib/supabase/admin";

// share_links powers (A) agent->buyer invites and (B) buyer->friend referrals.
// It holds the invite/referral lifecycle (a per-recipient token + on/off switch
// + who-referred-whom) so the `leads` table stays "real buyers who engaged".
// Access is service-role only (RLS blocks anon/authenticated) — every helper
// here runs through the admin client from trusted server code.

export type ShareKind = "agent_invite" | "buyer_referral";

export interface ShareLinkRow {
  id: string;
  tenant_id: string;
  agent_id: string | null;
  lo_id: string | null;
  kind: ShareKind;
  recipient_name: string | null;
  recipient_email: string | null;
  token: string;
  active: boolean;
  referrer_lead_id: string | null;
  lead_id: string | null;
  suggested_agent_name: string | null;
  suggested_agent_email: string | null;
  created_at: string;
  sent_at: string | null;
}

export interface PortalAgent {
  id: string;
  tenant_id: string;
  lo_id: string | null;
  name: string;
  slug: string;
  active: boolean;
}

// Resolve an agent by their status_token — the credential for the no-login agent
// portal and its actions (invite / disable). Returns null when unknown.
export async function getAgentByStatusToken(token: string): Promise<PortalAgent | null> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("agents")
    .select("id, tenant_id, lo_id, name, slug, active")
    .eq("status_token", token)
    .maybeSingle();
  return (data as PortalAgent | null) ?? null;
}

// Create an agent->buyer invite. Returns the row (with its token) or null.
export async function createAgentInvite(args: {
  tenantId: string;
  agentId: string;
  loId: string | null;
  recipientName?: string | null;
  recipientEmail: string;
}): Promise<ShareLinkRow | null> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("share_links")
    .insert({
      tenant_id: args.tenantId,
      agent_id: args.agentId,
      lo_id: args.loId,
      kind: "agent_invite",
      recipient_name: args.recipientName ?? null,
      recipient_email: args.recipientEmail,
      sent_at: new Date().toISOString(),
    })
    .select("*")
    .maybeSingle();
  return (data as ShareLinkRow | null) ?? null;
}

// Toggle a share link on/off. Scoped to agent_id so one agent can never touch
// another agent's links. Returns true on success.
export async function setShareActiveForAgent(shareId: string, agentId: string, active: boolean): Promise<boolean> {
  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("share_links")
    .update({ active })
    .eq("id", shareId)
    .eq("agent_id", agentId);
  return !error;
}

// All of the agent's share links (active AND turned-off), so the portal can show
// a real on/off toggle on every buyer and keep turned-off ones visible.
export async function listAllAgentShares(agentId: string): Promise<ShareLinkRow[]> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("share_links")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });
  return (data as ShareLinkRow[] | null) ?? [];
}

// All of an agent's ACTIVE share links (invites + referrals), so the portal can
// offer a "turn off" on any buyer — pending or already connected. Maps a
// converted buyer's lead back to the share link that can be disabled.
export async function listActiveAgentShares(agentId: string): Promise<{ id: string; lead_id: string | null }[]> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("share_links")
    .select("id, lead_id")
    .eq("agent_id", agentId)
    .eq("active", true)
    .order("created_at", { ascending: false });
  return (data as { id: string; lead_id: string | null }[] | null) ?? [];
}

// The agent's invites that haven't converted to a lead yet ("pending / invited").
export async function listPendingInvites(agentId: string): Promise<ShareLinkRow[]> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("share_links")
    .select("*")
    .eq("agent_id", agentId)
    .eq("kind", "agent_invite")
    .is("lead_id", null)
    .order("created_at", { ascending: false });
  return (data as ShareLinkRow[] | null) ?? [];
}

// Walk the referral chain up from a lead (its `referred_by` parent) to find the
// direct sharer (immediate) and the agent's own client at the top (root). Guards
// against cycles and runaway depth. Used to frame the agent's referral alert.
export async function resolveReferralNames(immediateLeadId: string): Promise<{ immediateName: string | null; rootName: string | null }> {
  const admin = createSupabaseAdmin();
  let currentId: string | null = immediateLeadId;
  let immediateName: string | null = null;
  let rootName: string | null = null;
  const seen = new Set<string>();
  for (let i = 0; currentId && i < 12; i++) {
    if (seen.has(currentId)) break;
    seen.add(currentId);
    const { data } = await admin.from("leads").select("full_name, referred_by").eq("id", currentId).maybeSingle();
    const row = data as { full_name: string | null; referred_by: string | null } | null;
    if (!row) break;
    if (i === 0) immediateName = row.full_name ?? null;
    rootName = row.full_name ?? rootName; // final value = the topmost we reach
    if (!row.referred_by) break;          // reached the agent's direct client
    currentId = row.referred_by;
  }
  return { immediateName, rootName };
}

// The company/broker display name + NMLS for a tenant, for the emailed
// "Financing by …" disclosure footer. Company NMLS lives in branding.company_nmls
// (falls back to the legacy tenant.nmls).
export async function getTenantIdentity(tenantId: string): Promise<{ companyName: string | null; companyNmls: string | null }> {
  const admin = createSupabaseAdmin();
  const { data } = await admin.from("tenants").select("lo_name, nmls, branding").eq("id", tenantId).maybeSingle();
  const t = data as { lo_name: string | null; nmls: string | null; branding: { company_nmls?: string | null } | null } | null;
  if (!t) return { companyName: null, companyNmls: null };
  return { companyName: t.lo_name ?? null, companyNmls: (t.branding?.company_nmls ?? t.nmls) ?? null };
}

// Fetch a single share link the agent owns (for re-sending its invite email).
export async function getShareForAgent(shareId: string, agentId: string): Promise<ShareLinkRow | null> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("share_links")
    .select("*")
    .eq("id", shareId)
    .eq("agent_id", agentId)
    .maybeSingle();
  return (data as ShareLinkRow | null) ?? null;
}

// Resolve an ACTIVE share link by token — used by the lead route to stamp
// attribution (source / referred_by) and link the converted lead back. Returns
// null when the token is unknown or the link has been disabled.
export async function getActiveShareByToken(token: string): Promise<ShareLinkRow | null> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("share_links")
    .select("*")
    .eq("token", token)
    .eq("active", true)
    .maybeSingle();
  return (data as ShareLinkRow | null) ?? null;
}

// After a buyer converts, link the share row to the new lead (idempotent-ish:
// only stamps the first conversion).
export async function attachLeadToShare(token: string, leadId: string): Promise<void> {
  const admin = createSupabaseAdmin();
  await admin
    .from("share_links")
    .update({ lead_id: leadId })
    .eq("token", token)
    .is("lead_id", null);
}

// Flow B: a buyer creates (or reuses) their own referral link from their lead.
// The referral inherits the buyer's agent + LO so a friend who runs the numbers
// lands in the same funnel, tagged buyer_referral with referred_by = this buyer.
// One reusable link per buyer — friends become independent leads, so there's no
// per-friend token to manage.
export async function createBuyerReferral(referrerLeadId: string): Promise<ShareLinkRow | null> {
  const admin = createSupabaseAdmin();
  const { data: lead } = await admin
    .from("leads")
    .select("id, tenant_id, agent_id, assigned_lo_id")
    .eq("id", referrerLeadId)
    .maybeSingle();
  const l = lead as { id: string; tenant_id: string; agent_id: string | null; assigned_lo_id: string | null } | null;
  if (!l) return null;

  const { data: existing } = await admin
    .from("share_links")
    .select("*")
    .eq("referrer_lead_id", l.id)
    .eq("kind", "buyer_referral")
    .eq("active", true)
    .maybeSingle();
  if (existing) return existing as ShareLinkRow;

  const { data } = await admin
    .from("share_links")
    .insert({
      tenant_id: l.tenant_id,
      agent_id: l.agent_id,
      lo_id: l.assigned_lo_id,
      kind: "buyer_referral",
      referrer_lead_id: l.id,
    })
    .select("*")
    .maybeSingle();
  return (data as ShareLinkRow | null) ?? null;
}
