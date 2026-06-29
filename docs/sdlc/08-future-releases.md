# Phase 8 — Future Releases
**Also known as (AI-era): Roadmap & Honesty Ledger**
**Status: 🗺️ Planned (not built) — recorded so "planned" is never mistaken for "shipped."**

## Purpose
Capture what is planned but **not yet in the codebase**, where each future item plugs into the current architecture, and what it depends on — so nothing is lost between phases and no roadmap item is ever claimed as delivered.

> **Honesty rule.** When describing EarnedHome (resume, pitch, demo), claim only what's in "What is built today." Everything below is **roadmap** — describe it as planned, not delivered, until it ships and is verified. (Full ledger: [`../ROADMAP_PHASE_2_3.md`](../ROADMAP_PHASE_2_3.md).)

## What is built today (Phase 1A) — for contrast
Live Graph pricing engine (6 products incl. Jumbo/VA) — now **batched (~7s → ~2s)**; buyer Pathfinder tool with **loan-eligibility edit checks** (jumbo/VA tiers, greyed-out ineligible cards) and a **Property Type** input; lead capture with TCPA consent; the loan-officer dashboard (leads, status, attributed notes thread, filter); the admin Rate Workbook tool; **flag-gated forgot-password (loan-officer only)**; multi-tenant Supabase + RLS; and a two-environment deploy (QA/prod). See [`../INFRASTRUCTURE.md`](../INFRASTRUCTURE.md).

---

## Planned items (Phase II / III)

### 1. Azure OpenAI / LLM integration — *not built*
- **Today:** zero AI/LLM references in the code; no Azure OpenAI resource, keys, or service.
- **Plan:** add an AI layer behind an interface (mirror the `PricingAdapter` pattern → `AIAdapter`: `stub` vs `azure-openai`), called server-side from API routes. Powers items #2 and #3 and a possible buyer Q&A assistant.
- **Plugs in at:** new `src/lib/ai/` module + API route(s); Azure OpenAI resource; server-only env vars.
- **Guardrails:** no personalized financial/legal advice (general/educational only — RESPA/UDAAP); reviewed output copy; cost controls.

### 2. 60-day mortgage-readiness plan generator — *not built*
- **Today:** a **demo** only (`src/components/ReadinessDemo.tsx` + `/readiness`) — a mockup, not a real generator.
- **Plan:** generate a personalized plan from buyer inputs (credit band, down-payment gap, DTI signals) → timed steps to improve credit, save, and reduce debt, then route to the loan officer. **Rules-based first**, optionally LLM-enhanced via #1.
- **Guardrails:** educational/general, not personalized advice (same posture as "Ways to Lower Your Payment").

### 3. LLM-generated scenario explanations — *not built*
- **Today:** cards show numbers; the "Understanding your estimate" panel is **static** copy.
- **Plan:** use the AI layer (#1) to generate plain-language explanations of the buyer's own scenario.
- **Guardrails:** general/educational, reviewed, no steering/advice.

### 4. Lead fan-out automation from `/api/lead` — *not built*
- **Today:** `/api/lead` is a clean Supabase insert + a logged event. No webhook, LO notification, CRM push, or follow-up (the LO email/SMS is a `// TODO`).
- **Plan:** add lead-handoff automation — either **in-code** (Resend email + Twilio SMS in the route) or **Power Automate** (the route or a Supabase DB webhook POSTs to an HTTP-triggered flow that notifies the LO, adds to CRM, sends follow-ups, logs the referral).
- **Plugs in at:** `src/app/api/lead/route.ts` and/or a Supabase DB webhook.
- **Decision pending:** in-code (simplest) vs. Power Automate (non-dev-editable M365/CRM fan-out).

### 5. Multi-loan-officer routing — *proposed (Phase 2)*
- **Today:** one loan officer per white-label; the buyer UI shows a single `tenants.lo_name` string and `leads.routed_to` is free text.
- **Plan:** support N loan officers per tenant; promote `app_users` (role `lo`) to the source of truth; add a `lo_routing` strategy (`default` → `community` → `round_robin` → `buyer_choice`); link each lead to a specific LO via `assigned_lo_id`; drive NMLS in disclosures from the resolved LO. Full spec: [`../specs/multi-loan-officer-routing.md`](../specs/multi-loan-officer-routing.md).
- **Phasing:** 2a default LO → 2b community routing → 2c round-robin / buyer-choice.

### 6. Performance instrumentation & benchmark — ✅ *shipped (June 24–25)*
- **Batching:** `quote.meta` telemetry + `/$batch` cut a quote from **~6–9s to ~2s** on QA (~90 round-trips → ~6). Real, measured — cite this, not any unmeasured "throughput lift."
- **Block reads (done):** the `EH_Out` reference tab + `GRAPH_OUTPUT_MODE=grid` reads the whole output block in one call → **~1s, ~3 Graph round-trips**, numbers verified to the dollar. Flag-gated; on QA. Specs: [`../specs/graph-block-reads.md`](../specs/graph-block-reads.md), [`../specs/eh-out-tab-spec.md`](../specs/eh-out-tab-spec.md).
- Full latency story: **~7s → ~2s (batching) → ~1s (block reads).**

### 7. White-label scaling — *foundation built; scaling work planned*
- **Today:** multi-tenant by host with per-tenant branding + RLS is built (one shared Supabase + Netlify). Workbook identity is still a **global env var** (one engine), and onboarding a builder is manual.
- **Plan:** move per-tenant workbook drive/item ids into the `tenants` row; an "onboard a builder" admin flow; custom-domain + redirect-allowlist automation; per-LO eligibility overlays; decide auth-email branding. Full model + phased checklist: [`../WHITE_LABEL_ARCHITECTURE.md`](../WHITE_LABEL_ARCHITECTURE.md).

### 8. Buyer estimate email + resume ("magic") link — *not built*
- **Today:** the buyer gets no email; the estimate isn't reopenable.
- **Plan:** on lead submit, email the buyer their estimate summary + disclosures (Resend) and a tokenized **resume link** to reopen a read-only saved estimate (~30-day, no PII in the URL). Researched; parked until forgot-password is finished. Spec: [`../specs/buyer-email-resume-link.md`](../specs/buyer-email-resume-link.md).

### 9. AI layer — generative + predictive — *not built (Phase II/III)*
- Beyond items #1–3 (AI layer, readiness plan, scenario explanations): **LO copilot** (internal generative — draft follow-ups, summarize a lead + their quote, daily pipeline digest; LO reviews → **lowest risk, start here**); **predictive lead scoring & prioritization** (outreach triage); **readiness / qualification score**; **re-engagement timing**; and a **constrained buyer education assistant** (RAG over compliance-approved content, guardrailed, hands off to the LO — a free-form chatbot is deliberately out of scope).
- **Rail / guardrails:** educational or internal only, human-in-the-loop, pricing stays in the workbook; predictive scoring is **outreach prioritization only — not credit/pricing decisions** (ECOA / fair-lending). Full breakdown per item + phasing: [`../ROADMAP_PHASE_2_3.md`](../ROADMAP_PHASE_2_3.md) (AI solutions section).

### 10. Pricing-engine concurrency & scale — *known Phase 1 ceiling; swap planned*
The current engine prices every quote by driving **one shared Excel workbook** through Microsoft Graph: write the buyer's inputs into the sheet, recalc, read the outputs. This was the right Phase 1 choice — Richard owns and updates pricing in a tool he knows — but it has a **hard concurrency ceiling** that must be addressed before high-traffic / multi-tenant scale.

- **Where the limit lives (today's code):**
  - `withLock` in `src/lib/pricing/graph.ts` **serializes quotes** — the shared workbook is a single mutable surface, so two quotes cannot run on it at once (parallel access returns mixed/partial numbers; that exact bug was hit and reverted, June 24).
  - That lock is **per serverless instance**, not global. Under load Netlify spins up multiple instances that **do not coordinate**, so several instances can hit the *same* workbook simultaneously — re-creating the partial/mixed-quote race. **This is a correctness risk, not just latency.**
  - The result cache (`Map`, 5-min TTL) is **per instance** — already flagged in-code as "replace with Redis keyed on inputs+rateVersion at scale."

- **Measured behavior (June 25, QA, grid mode, `graphCalls: 3`):**
  - Warm, sequential, uncontended: **~1.4–1.8s** per real quote (steady).
  - Interactive / real use: **~1.7–5.9s**, highly variable.
  - The variance is driven mainly by **Microsoft Graph round-trip latency** against the shared cloud workbook (each quote = 3 Graph calls incl. a per-request `createSession`), plus a cold-start tail on freshly-spun instances. Container idle-warmth on Netlify/Lambda is **not a fixed, reliable number** (minutes, reclaimed unpredictably), so a short idle can still produce a slow quote — i.e. **keep-warm pings reduce the cold tail but do not fix the Graph-side variance.**

- **Failure modes at high concurrency (e.g., ~1,000 simultaneous):** cross-instance races on the shared workbook (wrong/partial quotes) · throughput cap (one workbook, serialized, ~1.5s ≈ **~40 quotes/min**) → queueing · Microsoft Graph **throttling (429s)** at volume.

- **Plan (stepping stones → real fix):**
  1. **Shared cache** (Redis/KV) keyed on `inputs + ratesAsOf`, replacing the per-instance `Map` — absorbs repeat scenarios across all instances.
  2. **Cross-instance serialization** (a global queue/lock, or a single dedicated pricing worker) so the shared workbook is **never** hit concurrently — closes the correctness gap as an interim measure.
  3. **The real fix — swap the engine to native code.** Port the workbook's pricing formulas into a code `PricingAdapter` (or a small pricing service) behind the **existing `stub` / `graph` adapter interface**, so the app doesn't change. This removes the single-workbook bottleneck entirely, enables **true parallel** pricing, and gives **predictable sub-second** latency (no Graph round-trips). Keep the workbook as Richard's **source of truth for rate inputs** (exported/synced into the engine), not the per-request calculator.

- **Pilot reality:** at R Parry pilot concurrency (a handful of buyers at a time) the current engine is fine. This item is the **scale gate** — do the engine swap before onboarding many tenants or marketing-driven traffic spikes.

---

## Already built and worth noting: Rate Workbook Tool
The admin-only **Rate Workbook tool** (download → edit → upload/replace, guarded so a non-technical admin can't break the file linkage) is **built on `dev`**. It is documented as a spec at [`../specs/workbook-swap-tool.md`](../specs/workbook-swap-tool.md) and is part of the operational story in [06-deployment.md](06-deployment.md) and [07-maintenance.md](07-maintenance.md).

## Suggested phasing
- **Phase II:** #4 lead fan-out (closes the LO-notification gap), #5 default-LO routing, #2 readiness plan (rules-based), #6 instrument + benchmark.
- **Phase III:** #1 Azure OpenAI layer, #3 LLM scenario explanations, LLM-enhanced readiness plan, agentic assistant.
- **Scale gate (before high traffic / many tenants):** #10 pricing-engine concurrency — shared cache, then cross-instance serialization, then the native-engine swap. Required before the single shared workbook is exposed to high concurrency.

## AI's role in this phase
**Maturity: AI-Assisted.** AI maintains this ledger, maps each planned item to its insertion point in the current architecture, and enforces the "planned ≠ shipped" honesty rule. Humans decide phasing and own every go/no-go.

## Key artifacts
- [`../ROADMAP_PHASE_2_3.md`](../ROADMAP_PHASE_2_3.md) — the full Phase II/III roadmap & honesty ledger.
- [`../specs/multi-loan-officer-routing.md`](../specs/multi-loan-officer-routing.md), [`../specs/workbook-swap-tool.md`](../specs/workbook-swap-tool.md) — feature specs.
- `Agentic_AI_Roadmap.md` (internal workspace) — the AI/agentic maturity path.
