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

### 6. Performance instrumentation & benchmark — *partly shipped (June 24)*
- **Done:** the graph adapter now reports `quote.meta` (`tookMs` / `graphCalls`), and **request batching** (`/$batch`) cut a quote from a measured **~6–9s to ~2s** on QA (~90 round-trips → ~6). This is the *real, measured* delta — cite this, not any unmeasured "throughput lift."
- **Remaining (to ~1s):** "block reads" — read each product's outputs as one contiguous named range instead of ~13 cells. Needs a workbook layout change by the loan officer. Spec: [`../specs/graph-block-reads.md`](../specs/graph-block-reads.md).

### 7. White-label scaling — *foundation built; scaling work planned*
- **Today:** multi-tenant by host with per-tenant branding + RLS is built (one shared Supabase + Netlify). Workbook identity is still a **global env var** (one engine), and onboarding a builder is manual.
- **Plan:** move per-tenant workbook drive/item ids into the `tenants` row; an "onboard a builder" admin flow; custom-domain + redirect-allowlist automation; per-LO eligibility overlays; decide auth-email branding. Full model + phased checklist: [`../WHITE_LABEL_ARCHITECTURE.md`](../WHITE_LABEL_ARCHITECTURE.md).

### 8. Buyer estimate email + resume ("magic") link — *not built*
- **Today:** the buyer gets no email; the estimate isn't reopenable.
- **Plan:** on lead submit, email the buyer their estimate summary + disclosures (Resend) and a tokenized **resume link** to reopen a read-only saved estimate (~30-day, no PII in the URL). Researched; parked until forgot-password is finished. Spec: [`../specs/buyer-email-resume-link.md`](../specs/buyer-email-resume-link.md).

---

## Already built and worth noting: Rate Workbook Tool
The admin-only **Rate Workbook tool** (download → edit → upload/replace, guarded so a non-technical admin can't break the file linkage) is **built on `dev`**. It is documented as a spec at [`../specs/workbook-swap-tool.md`](../specs/workbook-swap-tool.md) and is part of the operational story in [06-deployment.md](06-deployment.md) and [07-maintenance.md](07-maintenance.md).

## Suggested phasing
- **Phase II:** #4 lead fan-out (closes the LO-notification gap), #5 default-LO routing, #2 readiness plan (rules-based), #6 instrument + benchmark.
- **Phase III:** #1 Azure OpenAI layer, #3 LLM scenario explanations, LLM-enhanced readiness plan, agentic assistant.

## AI's role in this phase
**Maturity: AI-Assisted.** AI maintains this ledger, maps each planned item to its insertion point in the current architecture, and enforces the "planned ≠ shipped" honesty rule. Humans decide phasing and own every go/no-go.

## Key artifacts
- [`../ROADMAP_PHASE_2_3.md`](../ROADMAP_PHASE_2_3.md) — the full Phase II/III roadmap & honesty ledger.
- [`../specs/multi-loan-officer-routing.md`](../specs/multi-loan-officer-routing.md), [`../specs/workbook-swap-tool.md`](../specs/workbook-swap-tool.md) — feature specs.
- `Agentic_AI_Roadmap.md` (internal workspace) — the AI/agentic maturity path.
