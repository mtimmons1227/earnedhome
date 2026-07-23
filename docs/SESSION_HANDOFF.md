# Session Handoff — Start Here

**Purpose:** the single "pick up where we left off" doc. Read this first when starting a new session. Last updated **2026-07-22** (Phase II multi-LO, buyer referral/share system, buyer-form + eligibility polish).

> **Branch model (current):** `rel` (Phase II dev) → `test` (QA → `test--earnedhome.netlify.app`) → `main` (Prod → `home.rparryfinancial.com`). The older "`dev`" references below are historical.

---

## 1. Where things stand right now

**As of 2026-07-22:** `rel` = `origin/rel` = `origin/test` = **`41b8416`** (QA, working tree clean). Prod `main` = **`32ef248`** — intentionally held behind QA. Migration **0019** (`share_links` + `leads.referred_by`) applied to **QA only** — must be applied to the Prod DB before promoting. `LEAD_NOTIFY_OVERRIDE` must be **unset** on the Prod context before real buyers.

| Environment | Branch | State |
|---|---|---|
| **Production** | `main` @ `32ef248` | The tested connect flow + rparry sender + Phase II baseline. **Does NOT yet have** the share/referral system or today's buyer-form + eligibility polish. Live pricing. At **`home.rparryfinancial.com`** (SSL). |
| **QA** | `rel`/`test` @ `41b8416` | Everything in Production **plus** Phase II (multi-LO + role-aware per-LO RLS, LO management, agent status portal, DashHeader), the **buyer referral/share system** (Flow A agent-invite + Flow B share-with-a-friend), and today's polish (invited-buyer email line, centered share button, named-sender referral email, **FHA/VA = primary-residence only**, Military/Veteran ↔ occupancy lock). At `test--earnedhome.netlify.app`. |

**Live URLs:** Prod = **https://home.rparryfinancial.com** (branded, SSL). QA = **https://test--earnedhome.netlify.app**.

**One shared Supabase project** (`azfesppisxniclnntrmc`) and **one Netlify site** serve both QA and Prod. So DB rows, migrations, and `notify_email` are shared across environments; only the **code** differs by branch.

### Email / domain — LIVE (2026-07-08)
- **`rparryfinancial.com` is a verified Resend sending domain** (DKIM/SPF/MX green). `thetimmonsfoundation.org` was removed (free tier = 1 domain).
- **`RESEND_FROM` = `R Parry Financial <no-reply@rparryfinancial.com>`** on all Netlify contexts + `.env.local`.
- **Recipient routing:** local → `LEAD_NOTIFY_OVERRIDE` (Marvin's inbox); QA + Prod → DB `notify_email` = **Richard** (`richard@rparryfinancial.com`).
- **`home.rparryfinancial.com`** → Netlify production, SSL issued. DNS at **Network Solutions** (managed by Dominika / Raise Your Media). To have local send *from* Timmons while Prod uses rparry would require Resend **Pro** (2 verified domains) — deferred.

---

## 2. What shipped to QA this session (all on `dev`, not yet on Prod)

**Phase 1A Agent (Realtor) Attribution — complete and tested end-to-end on QA:**
- Per-agent share links `/a/<slug>` — a buyer who runs an estimate from an agent's link is tagged to that agent.
- Buyer sees **"Your agent: {name}"**; the lead stores `agent_id`; the LO alert says "(via {agent})"; the agent gets their own copy email.
- **Dashboard → Agents page:** add, **edit** (name/email/phone in place), **copy link**, **Email link** (sends the agent their link via Resend, with a "Link sent {time}" stamp), colored **on/off toggle** (red = turn off / green = turn on), and an **All / Active / Turned off filter**.
- **Revoke = real:** a turned-off agent's `/a/<slug>` link is **blocked** ("This link is no longer active") — no estimate, no self-serve button.
- **Leads table:** new **Agent** column; a disabled agent shows a red **DISABLED** badge on their past leads.
- **Buyer self-correct:** after connecting, an **"Update my info"** button reopens the contact form and updates the **same** lead (no duplicate).
- **Required fields:** name + email (+ format) + phone required to connect and to update.
- **Buyer email CTA:** confirmation email now ends with a **"Book a time"** button + LO phone.
- **Connected screen** shows the **LO phone** next to the name + a **Calendly reschedule** note.
- Header **NMLS = 1924318** (company); phone formatting `(XXX) XXX-XXXX` on the agents list.

**Added 2026-07-08 (also on QA):**
- **Closed / Funded production tracking** — the "Closed" status is now **"Closed / Funded"**; a `closed_at` timestamp is stamped on close (`0011`); the dashboard shows **Closed / Funded**, **Closed this month**, **Lead → Closed %**, and **Close rate (this month)**, organized into a **counts row + rates row** in funnel order. Metric cards **refresh live** on a status change.
- **Email/domain go-live** — rparry verified, sender flipped to `no-reply@rparryfinancial.com`, `home.rparryfinancial.com` live with SSL (see §1).
- **Native pricing engine — workbook DECODED.** The RateStream workbook was reverse-engineered (rate/price ladder + LLPAs + `PMT` + PMI/MIP/VA factor tables). Spec + findings: [`specs/native-pricing-engine.md`](specs/native-pricing-engine.md). Ready to build the code engine (validated to the penny against the workbook's cached values).

**Docs written this session (in `docs/`, uncommitted unless you ran the commit):**
`SESSION_HANDOFF.md` (this file), `TENANT_ONBOARDING.md` (the run script), `TENANT_ONBOARDING_CHECKLIST.md`, `TENANT_TEMPLATE_AND_CLONE.md`, `AGENT_ATTRIBUTION_QA_TEST.md`, `specs/per-tenant-pricing.md`, plus updates to `CHANGE_SIGNOFF_LOG.md`, `RELEASE_MANIFEST_QA.md`, `sdlc/08-future-releases.md`.

---

## 3. Database changes made this session (shared DB — already applied)

- **`0008_agents.sql`** — `agents` table + `leads.agent_id` + RLS (service-role).
- **`0009_agents_member_read.sql`** — RLS policy so signed-in staff can read agents in their tenant (fixes the dashboard Agent column).
- **`0010_agents_invite_sent_at.sql`** — `agents.invite_sent_at` (Email-link timestamp).
- **`0011_lead_closed_at.sql`** — `leads.closed_at` (+ index) for closed/funded period metrics.
- **Data edits (SQL run in editor):** `tenants.nmls` = `1924318`; `tenants.branding.tag` = "Powered by R Parry Financial · NMLS 1924318".

> Migrations 0005–0010 were run as **raw SQL in the editor**, so the Supabase dashboard "Last migration" tracker shows an older number — cosmetic only; the tables exist.

## 4. Env / config changes this session
- **`SUPABASE_SERVICE_ROLE_KEY`** added to **all** Netlify contexts (the agents CRUD + invite routes need it). This is what unblocked "Add agent" on QA.
- **`LEAD_NOTIFY_OVERRIDE`** (designed, in code): set on QA/local to route test lead alerts to a test inbox while Prod uses the DB `notify_email`. Not yet set in Netlify.

---

## 5. Open items / next steps (roughly in priority order)

1. **Promote the agent feature + closed/funded metrics QA → Prod** once Richard signs off — working tree clean, so: `git checkout main` → `git pull` → `git merge dev` → `git push origin main` → `git checkout dev`. `SUPABASE_SERVICE_ROLE_KEY` + migrations 0009/0010/0011 are already on the shared infra, so Prod is prepped. (Richard tests on the **QA** URL for now.)
2. ✅ **Done:** `notify_email` = Richard; `LEAD_NOTIFY_OVERRIDE` on local → Marvin's inbox; `RESEND_FROM` = rparry everywhere; rparry verified; `home.rparryfinancial.com` live.
3. **Per-tenant pricing** — spec: `docs/specs/per-tenant-pricing.md`. **Related and higher-leverage: the native pricing engine** — the workbook is now fully decoded; build the code engine (`docs/specs/native-pricing-engine.md`) to remove the Graph dependency + concurrency ceiling and enable true multi-tenant/sub-second pricing. Validate to the penny against the workbook.
4. **Per-tenant disclosures** — move the shared R Parry disclosure module to tenant data (needed before a 2nd live LO). No spec yet.
5. **Buyer resume link** (`/r/<token>`) — reopen a saved estimate; still not built. The in-session "Update my info" partly covers it.
6. **Super-admin Tenants page** — form wrapper around the onboarding clone script (see `TENANT_ONBOARDING.md`). Needs a new cross-tenant super-admin role.
7. **Footer NMLS decision** — footer still reads Richard's individual `927662`; header shows company `1924318`. Decide which the EHO footer should show (one SQL either way).
8. **Resend SMTP → Supabase Auth** so self-serve "Forgot password" works (currently no link; reset via Supabase dashboard). Then add the login-page link + URL allowlist.
9. ✅ **Done:** `rparryfinancial.com` verified in Resend; Prod `RESEND_FROM` = `no-reply@rparryfinancial.com`. (Timmons domain removed.)
10. **Compliance:** Richard/counsel sign-off on disclosures + eligibility before real buyers (Section A of the release manifest).

---

## 6. Working constraints (persist across sessions)
- **User runs all git + npm** in PowerShell; provide the commands. `npm run typecheck` is the real gate (the sandbox mount can corrupt `PathfinderTool.tsx` — always use Read/Edit tools on it, never bash).
- **User runs SQL** in the Supabase editor; provide the SQL. (Read-only introspection via the Supabase MCP is OK; writes go to the user.)
- **Never touch `.env.local`** or paste secrets — the user puts keys straight into Netlify/`.env.local`.
- Don't keep the RateStream workbook open in Excel during pricing tests.
- Web content only via `web_fetch` / `WebSearch` (no curl/wget workarounds).

## 7. Key file map
- Buyer tool: `src/components/PathfinderTool.tsx` (fragile). Buyer page `src/app/page.tsx`; agent page `src/app/a/[slug]/page.tsx`.
- Pricing: `src/lib/pricing/{index,graph,stub,types,disclosures}.ts`.
- Lead capture: `src/app/api/lead/route.ts` (+ `/contact` for buyer self-edit). Email: `src/lib/email.ts`.
- Agents: `src/lib/agents.ts`, `src/app/api/admin/agents/**`, dashboard `src/app/dashboard/agents/**`.
- Dashboard leads: `src/app/dashboard/page.tsx` + `LeadsTable.tsx`. Tenant loader: `src/lib/tenant.ts`. Admin gate: `src/lib/auth-admin.ts`.
- Onboarding: `docs/TENANT_ONBOARDING.md` (run script).

## 8. First moves in a new session
1. `git checkout dev && git pull` — confirm you're on the latest QA.
2. Skim §2 and §5 above for state + next steps.
3. If continuing the build, the next high-value work is **per-tenant pricing** (§5.3, spec ready).
