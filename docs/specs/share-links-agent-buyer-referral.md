# Feature Spec — Agent→Buyer invites & Buyer→Friends referrals (`share_links`)

**Status:** Draft for build on `rel`. Do **not** merge to `main` until QA‑tested on `test` and Marvin approves (standing rule).
**Owner:** Marvin (IT) · **Pilot:** R Parry Financial · **Date:** July 2026

---

## 1. Goals

- Let an **agent email a per‑buyer link** to a buyer, and see their buyers.
- Let a **buyer share the tool with friends & family** (buyer‑initiated).
- Support **disabling a specific buyer's link** — a soft off‑switch, never a delete.
- Preserve **attribution, cascade, and billing integrity** end‑to‑end.

## 2. Non‑goals / deferred

- Agent logins — agents stay **token‑based** (`/agent/<token>`).
- Cross‑LO routing — a friend who wants an agent tied to a *different lender* uses **that agent's own link**; we never move a lead to a different LO mid‑flow.
- **Cash referral incentives** — excluded (RESPA Section 8).
- **Per‑friend tokens** — a buyer gets **one reusable** share link (friends become independent leads, so per‑friend disable isn't needed).

## 3. What already exists (no change needed)

- `leads.agent_id` → agent; `agents.lo_id` → LO. **Seeing an agent's buyers is already a `leads` query** — the agent portal (`/agent/[token]/page.tsx`) does exactly this.
- `agents.active` (disable an agent), `agents.status_token` (portal credential), and the `isAgentOwnerActive` cascade (turning off an LO/agent revokes downstream).

Only the **sending**, **sharing**, **per‑buyer disable**, and **referral chain** are new.

## 4. New table — `share_links`

Rationale: a link/invite exists **before** a person becomes a buyer. Keep `leads` = *real buyers who ran numbers* (clean for pipeline metrics and per‑loan billing); keep the invite/referral lifecycle in `share_links`.

```sql
-- 0019_share_links.sql
-- Per-recipient share links for (A) agent->buyer invites and (B) buyer->friend
-- referrals. Keeps leads = real buyers who engaged; share_links holds the
-- invite/referral lifecycle (token, on/off, who-referred-whom). Additive/idempotent.

create table if not exists public.share_links (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  agent_id          uuid references public.agents(id)    on delete set null,   -- owning agent
  lo_id             uuid references public.app_users(id) on delete set null,   -- routing LO
  kind              text not null check (kind in ('agent_invite','buyer_referral')),
  recipient_name    text,
  recipient_email   text,
  token             uuid not null default gen_random_uuid(),                   -- the link
  active            boolean not null default true,                            -- the on/off switch
  referrer_lead_id  uuid references public.leads(id) on delete set null,       -- buyer who shared (Flow B)
  lead_id           uuid references public.leads(id) on delete set null,       -- set when they convert
  suggested_agent_name  text,   -- friend named an agent not yet on EarnedHome
  suggested_agent_email text,
  created_at        timestamptz not null default now(),
  sent_at           timestamptz
);

create unique index if not exists share_links_token_key    on public.share_links(token);
create index        if not exists share_links_agent_idx    on public.share_links(agent_id) where active;
create index        if not exists share_links_tenant_idx   on public.share_links(tenant_id);
create index        if not exists share_links_referrer_idx on public.share_links(referrer_lead_id);

-- Trace a referred lead back to the buyer who shared (keeps billing/metrics honest).
alter table public.leads add column if not exists referred_by uuid references public.leads(id) on delete set null;
-- NOTE: leads.source already exists — set 'agent_invite' | 'buyer_referral' as appropriate.

-- RLS: service-role only, same posture as agents/tenant_integrations. The agent
-- portal (token) and the buyer share act through server-side API routes; buyers
-- and LOs never query this table directly.
alter table public.share_links enable row level security;
```

## 5. Flows

### 5.1 Flow A — Agent invites a buyer

1. Agent (in `/agent/<token>` portal) enters **buyer name + email**.
2. API creates `share_links` row: `kind='agent_invite'`, `agent_id`, `lo_id` (from agent), `token`, `active=true`, `sent_at=now()`.
3. Resend emails the buyer the link `/r/<token>`.
4. Buyer opens it → runs numbers → normal `leads` row is created with `agent_id`, `source='agent_invite'`; set `share_links.lead_id`.
5. Agent's portal lists buyers = `leads` by `agent_id` (converted) **+** `share_links` without a `lead_id` (still "invited / pending").

### 5.2 Flow B — Buyer shares with friends & family

1. On the buyer's **results page**, a **"Share with a friend"** action creates (or reuses) one `share_links` row: `kind='buyer_referral'`, `referrer_lead_id = buyer's lead`, inheriting `agent_id` + `lo_id` from the buyer's lead, `active=true`.
2. **Buyer sends the link themselves** (copy link / native share / clearly buyer‑initiated email). EarnedHome does **not** cold‑email the friends.
3. Friend opens `/r/<token>` → **"Who's your agent?"** step (see §5.3) → runs numbers → new `leads` row, `source='buyer_referral'`, `referred_by = buyer's lead`.

### 5.3 "Who's your agent?" branch (on referral entry)

Three choices when a friend enters through a referral link (LO is **fixed** to the link's LO — only the agent flexes):

| Friend picks | Result |
|---|---|
| **"[Agent A] — who your friend used"** (default) | `agent_id = A`. |
| **"I have a different agent"** → capture name + email | If that agent **already exists under this LO** → `agent_id = that agent`. If **not on EarnedHome** → `agent_id = null`, store `suggested_agent_name/email`, flag the lead so the LO can **invite** that agent (a recruiting lead). |
| **"I don't have an agent yet"** | `agent_id = null` — LO (or Agent A) can pair them. |

Out of scope for this link: a friend who wants an agent tied to a **different lender** — that agent sends their **own** link.

## 6. Attribution & cascade

- **Friends inherit the sharer's `agent_id` + `lo_id`** (unless re‑pointed in §5.3). `referred_by` always records who shared.
- **Cascade flows down the agent→LO hierarchy, never sideways between buyers:**
  - Disable **LO** → all its agents + their buyers go dark.
  - Disable **agent** → all that agent's buyers go dark.
  - Disable a **buyer's link** (`share_links.active=false`) → stops that link from creating **new** referrals; **already‑converted friends are independent leads and stay active.**
- Converted friends cascade under **whoever they landed with** (re‑pointed agent, or directly the LO if agent is null/pending).

## 7. Permissions — who can disable what

| Who | Can disable | Where |
|---|---|---|
| **Broker admin** | Any agent / any buyer link in the shop | Dashboard (logged in) |
| **LO** | Their own agents; any buyer link in their funnel | Dashboard (logged in) |
| **Agent** | Only buyer links **they** created | Their token portal `/agent/<token>` |
| **Buyer** | Nothing (no account) | — |

Rule: **you can disable anything below you, never beside or above you.** API routes must enforce this scoping.

## 8. API routes

- `POST /api/agent/[token]/invite` — agent invites a buyer (token‑auth; creates `agent_invite` share_link + Resend email). Scope: agent's own tenant/agent_id.
- `POST /api/agent/[token]/buyer/[shareId]/disable` — agent disables one of **their** buyer links (`active=false`). Scope check: `share_links.agent_id` matches token's agent.
- `POST /api/share/create` — buyer creates/reuses their `buyer_referral` link (from results page).
- `GET /r/[token]` — invite/referral landing → "Who's your agent?" → hands into the estimate tool with `share_token` carried through so the resulting lead is stamped + linked.
- LO/admin disable reuses the **existing dashboard agent APIs**, extended to also flip `share_links.active` within the LO's funnel / shop.

Lead‑create path (`/api/lead`) extends to: read the `share_token`, resolve `agent_id`/`lo_id`/`referred_by`/`source`, and set `share_links.lead_id` on convert.

## 9. UI additions

- **Agent portal** (`/agent/[token]`): "Invite a buyer" form; per‑buyer **Disable** button; show **pending/invited** (share_links without lead_id) vs **connected** (converted).
- **Buyer results page**: "Share with a friend" (copy link / share sheet).
- **Referral landing** (`/r/[token]`): "Who's your agent?" step (3 options + capture).
- **Dashboard leads**: show `source = buyer_referral`; surface the **suggested‑agent** flag with an "Invite this agent" CTA.

## 10. Compliance guardrails

- **Buyer‑initiated only** — the buyer sends the link; the friend becomes a lead only when **they** run numbers and consent. No cold auto‑emails to friends (TCPA / CAN‑SPAM).
- **No cash incentive** for referring (RESPA Section 8) — frame as helpful, not a bounty.
- Keep messaging **educational** ("see what you can afford"), consistent with the estimates‑only posture.

## 11. Rollout

- Build on `rel` → deploy to `test` (QA) → verify end‑to‑end → **`main` only after Marvin's OK.**
- Migration is additive/idempotent; safe to run in QA then Prod.
- Suggested test cases: agent invite→convert; agent disable stops the link; buyer share→friend converts under same agent/LO; "different agent already on EH" re‑points; "agent not on EH" creates suggested‑agent flag; disabling the buyer's link leaves converted friends active; disabling the agent cascades to all their buyers.
