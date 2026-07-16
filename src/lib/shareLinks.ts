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

// Soft-disable a share link the agent owns. Scoped to agent_id so one agent can
// never switch off another agent's links. Returns true on success.
export async function disableShareLinkForAgent(shareId: string, agentId: string): Promise<boolean> {
  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("share_links")
    .update({ active: false })
    .eq("id", shareId)
    .eq("agent_id", agentId);
  return !error;
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
