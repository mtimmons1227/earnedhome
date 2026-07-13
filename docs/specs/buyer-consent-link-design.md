# Buyer Self-Service Consent Link — Design (Option B, v2)

**Status:** Draft for Richard / compliance review · not yet built
**Owner:** Marvin · **Product:** EarnedHome

## 1. Goal

Make agent status-sharing consent a **separate, buyer-initiated, always-editable**
decision instead of a checkbox during signup. After a buyer connects, EarnedHome
emails them a dedicated consent link; they **Allow** or **Don't allow** there, and the
same link stays live so they can toggle it on or off anytime. Every change is recorded.

Scope note: this controls **status visibility only** — the friendly stages
(Connected → In process → Closed). No financial, credit, income, or loan detail is
ever shared with an agent. That is unchanged and not part of this consent.

## 2. What changes vs. today

- **Remove** the "authorize my agent to see loan status" checkbox from the connect
  screen. At submission the buyer now deals only with the required **TCPA** contact
  consent — simpler at that moment.
- Consent now **starts off** (declined) for every agent-referred lead until the buyer
  actively opts in from the consent email/page.
- A **dedicated consent email** is sent to the buyer right after they connect (only
  for agent-referred leads — there's nothing to share otherwise).

Trade-off to accept: the agent sees only **"Connected"** until the buyer opts in — which
they may never do if they don't open the email. That's the cost of a clean, explicit
opt-in (and it's the safer default).

## 3. Buyer experience

1. Buyer runs an estimate on an agent's link and connects (TCPA consent only).
2. They receive two emails: their **estimate**, and a **"Share your progress with
   [Agent]?"** consent email.
3. They open the consent email → the consent page shows their first name, the agent's
   name, the lender, plain-language on what's shared (stages only, no financial detail),
   that it's optional and revocable, and one control: **Allow** / **Don't allow**.
4. Whatever they choose takes effect immediately on the agent's status page.
5. The link is **permanent** — they can return anytime to turn it on or off. Bookmarkable.

## 4. Data model (migration 0018 — additive)

On `leads`:
- `consent_token uuid` — unique, `default gen_random_uuid()`. The credential in the
  buyer's private link (a dedicated random token, not the lead id, so nothing is
  guessable/enumerable).
- `agent_status_consent_at timestamptz` — when the current setting was last changed.
- `agent_status_consent_source text` — `buyer_link` for this page (reserved: `signup`
  for legacy rows, `lo` if an admin path is ever added).

Keep `agent_status_consent boolean` as the **current** value; its default stays
**false** (off).

Backfill existing rows: generate `consent_token`; leave current consent values as-is,
setting `source = 'signup'` and `_at = coalesce(consent_at, created_at)` where true.

History uses the existing `events` table: each change emits `consent_changed`
`{ leadId, agentId, from, to, source, at }` — an append-only record of every grant/revoke.

## 5. The consent link + page

- **URL:** `/consent/<consent_token>` — public, no login (token is the credential),
  server-rendered `no-store` so it's always current.
- Looks up the lead by token. If the lead has **no agent**, the page explains there's
  nothing to share.
- Shows the current setting and one clear toggle (Allow / Don't allow).
- **POST** (token-scoped) updates `agent_status_consent`, stamps `_at` + `_source`,
  emits the `consent_changed` event, and shows a confirmation.

## 6. The consent email (sent automatically on connect)

- Trigger: on lead submit, if the lead has an agent, send a consent email to the buyer.
- Subject (draft): **"Share your loan progress with [Agent]?"**
- Body (draft): who's asking, exactly what's shared (stages only), that it's optional and
  revocable, and two buttons — **Allow** and **Don't allow** — both pointing at
  `/consent/<token>` (Allow can pre-set the intent; the page still confirms).
- Sent via Resend, same as the estimate email; safe no-op if email isn't configured.
- The LO can also **copy or re-send** the consent link from the lead detail if the buyer
  loses it — the buyer still clicks it, so the action remains the buyer's.

## 6b. "Request access" button on the agent's status page

The agent never copies or holds a link. On their status portal, each buyer row has a
**"Request access"** button — exactly like the "Email link" button when you add an
agent. Clicking it **sends the consent request email (§6) to that buyer**; the buyer
opens it from their own inbox and chooses Allow / Don't allow. The agent never sees the
buyer's link or token, so the agent can't self-approve — the buyer is always the actor,
and no one-time code is needed (email delivery to the buyer is the verification).

**Button state (per buyer row):**
- **Buyer is already sharing (opted in):** button **disabled** (e.g. shows "Sharing ✓") —
  nothing to request.
- **Buyer hasn't opted in, or has opted out:** button **enabled** ("Request access") —
  the agent can send (or re-send) the request.
- After a click it briefly shows **"Sent ✓,"** then returns to enabled so the agent can
  nudge again later.

The button appears right on the buyer's row, next to their current stage.

## 6c. Build for consistency (reuse existing patterns)

Everything new should look and behave like what's already in the app — no new styles or
flows where an existing one fits:

- **"Request access" button** → mirror the existing **"Email link"** button on the Agents
  page: same `smallBtn` styling and the same send → **"Sent ✓"** → re-enable behavior
  (the `sendingId` / `sentId` pattern in `AgentsManager`).
- **Consent request email** → add `sendBuyerConsentRequest(...)` in `src/lib/email.ts`
  built exactly like `sendLoLoginInvite` / `sendAgentLinkInvite` (Resend, HTML template,
  safe no-op if email isn't configured).
- **Consent page** (`/consent/<token>`) → same token-page pattern as the agent status
  portal: server-rendered, service-role read, **`no-store`**, and the same **auto-refresh**
  component; styled with existing classes (`panel`, `leadbtn`, `hint`).
- **API route** → follow the existing invite routes (`.../invite`): POST, stamp a
  `*_sent_at`, return a friendly error shape.
- **Migration** → additive, numbered `0018_...` like the prior ones.
- **Manuals** → update the three .docx afterward via the existing `build_manuals.js`.

## 7. LO / broker touch points

- Lead detail shows current consent + **"last changed [when] via [source]"** and can
  expand to the `consent_changed` history.
- The **Agent updates: Yes/No** badge on the leads table stays, reflecting the current value.
- Agent status portal logic is **unchanged** (already consent-gated) — it just responds to
  buyer changes immediately (no-store + auto-refresh).

## 8. Audit trail (compliance)

Each change records new value, previous value, source, timestamp, and (optionally) request
IP / user-agent — a defensible record of when the buyer granted or revoked, and how.

## 9. Security & privacy

- `consent_token` is unguessable (UUID), private to the buyer.
- The page exposes only the buyer's first name, agent name, and lender — no other buyer's
  data, no financial detail. The endpoint flips one boolean for the one identified lead.
- Revocation is immediate; the agent drops back to "Connected."

## 10. Edge cases

- No agent on the lead → nothing to share; page says so; no consent email sent.
- Agent/LO turned off → portal already blocked; the buyer can still set their preference.
- Repeated changes → all logged; column holds the latest.
- Lost link → LO re-sends from the lead detail.

## 11. Open questions for Richard / compliance

1. **Wording** — approve the consent page copy and the consent email copy (what's shared,
   optional, revocable).
2. **Default off** — confirm consent starts off and requires the buyer's explicit opt-in.
3. **Extra email** — OK to send buyers a second (consent) email right after the estimate,
   or fold the link into the estimate email instead of a separate one?
4. **Audit depth** — timestamp + source + value enough, or also capture IP / user-agent?
5. **Legacy leads** — leave existing consent values as-is (recommended), or reset all to
   off and let buyers re-opt-in via the new link?
6. **Agent re-requests** — OK for the agent's "Request access" button to re-send the
   consent email when a buyer hasn't responded, and should we cap the frequency
   (e.g. at most once per day per buyer) to avoid over-emailing?
