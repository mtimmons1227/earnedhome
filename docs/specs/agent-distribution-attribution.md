# Spec — Realtor Agent Distribution & Attribution

**Status: 📐 Designed, ready to build.** The core new capability for the real distribution model.

## The model (clarified)
EarnedHome runs under a **loan officer** (tenant = R Parry). The LO recruits **5–10 realtor agents** as referral partners. Those agents use the tool **on-site with buyers while showing houses** — the agent has the page up on a phone/tablet, runs the estimate with the buyer present, and hits "Connect me with a loan officer."

**Hierarchy:** Tenant (LO / R Parry) → **Agents** (realtors) → **Leads** (buyers, each tagged to the agent who brought them).

**The gap to close:** every buyer must be **attributed to the agent** who ran the estimate, so the LO knows *whose* buyer it is (and can credit/route the referral) and the agent knows their buyer came in.

## What's already built vs. new
- ✅ Built: the estimate tool, pricing, buyer estimate email, Calendly, LO alert, dashboard.
- 🆕 New: the **agent layer** — per-agent links, agent tag on the lead, agent shown in the alert + dashboard.

---

## How attribution works — a unique link per agent (recommended)
- Each agent gets a personal link: **`https://<tenant-host>/a/<agent-slug>`** (e.g. `…/a/jane-smith`).
- The LO sends each agent their link. The agent **bookmarks it / saves it to their home screen** and uses it on-site.
- **Every buyer who submits through that link is automatically tagged with that agent** — no login, nothing to select, nothing to forget.

**Why this over the alternatives:**
- *Agent login* → too heavy to onboard 10 realtors, friction on-site.
- *"Pick your name" dropdown* → error-prone; the agent (or buyer) picks the wrong name.
- *Per-agent link* → zero friction, works on any device, and attribution is automatic and correct.

## Data model
- New **`agents`** table: `id, tenant_id, name, email, phone, slug (unique per tenant), active, created_at`.
- **`leads`**: add `agent_id` (nullable — a direct/LO lead has none).
- Resolve the agent from the slug server-side (same pattern as tenant resolution).

## The end-to-end flow
1. **LO adds agents** in the dashboard → each gets a unique link.
2. **LO sends links** to the 5–10 agents.
3. **Agent** opens *their* link on-site → runs the estimate with the buyer → "Connect me with a loan officer" + buyer info.
4. **Lead saved, tagged `agent_id`.**
5. **Emails:**
   - **Buyer** → estimate + Calendly (unchanged).
   - **LO** → *"New buyer lead **from Jane Smith**: {Buyer}…"* — the agent name is front and center.
   - **Agent (optional)** → *"Your buyer {name} just submitted with R Parry"* — keeps the agent in the loop and feeling credited.

## Notifications & dashboard (answers "what realtor does this buyer belong to")
- **LO alert** shows the **agent name** prominently.
- **Dashboard** gets an **Agent column**, a **filter by agent**, and **per-agent counts** — so the LO sees at a glance whose buyer each lead is and which agents are producing.

## Reconnect without re-entering an estimate
- **Same session (now):** after connecting, keep the connect actions (📞 Call · 📅 Book · 📝 Apply) **live in the success state**, so the buyer/agent can take another action without redoing the estimate.
- **Cross-session (later):** the buyer resume/magic link (`buyer-email-resume-link.md`) — **deferred per Marvin** ("maybe later"). Until then, the LO/agent works the saved lead from the dashboard.

## Agent management (LO dashboard)
- An **"Agents"** section: LO enters an agent (name, email) → system generates the slug + link → LO **copies the link to send**.
- Toggle **active/inactive** (deactivating disables the link).
- Later: agents self-serve a small view of *their own* buyers (Phase 3).

## Branding / trust touch
- The agent link stays on the **tenant's brand** (R Parry). Optionally show **"Your agent: Jane Smith"** on the page so the buyer sees continuity with the realtor helping them.

## Build pieces
1. Migration: `agents` table + `leads.agent_id`.
2. Agent resolution from slug (lib/middleware), mirroring tenant resolution.
3. Route `/a/[slug]` (or `?agent=`) → sets agent context → PathfinderTool carries `agent_id` into the lead submit.
4. Lead route: store `agent_id`; look up the agent for the alert; (optional) send the agent a copy.
5. Email lib: LO alert shows agent name; optional agent-notification template.
6. Dashboard: agents-management UI + agent column/filter/counts.
7. Keep the connect actions live in the connected state.

## Decisions (confirmed Jul 6 — all shipping in Phase 1A)
1. **Agent setup: build the dashboard UI now.** The LO adds/edits agents in the dashboard and copies each agent's link himself — self-serve on day one.
2. **Agent gets a copy of the alert: yes.** When their buyer submits, the agent is emailed too (*"Your buyer {name} just submitted with R Parry"*), using the agent's email.
3. **Show "Your agent: {name}" to the buyer: yes.** On the estimate page for continuity/trust; the page stays R Parry-branded overall.
4. Agent self-view of their own buyers + per-agent conversion analytics → later.

## Phasing
- **Phase 1A (this build):** `agents` table + `leads.agent_id`; per-agent link (`/a/<slug>`); `agent_id` on the lead; **agent name in the LO alert + a copy emailed to the agent**; **"Your agent: {name}" on the page**; **dashboard: Agents-management UI (add/edit/copy link/active) + Agent column & filter**.
- **Later:** agent self-view of their own buyers; per-agent conversion analytics; buyer resume/magic link.
