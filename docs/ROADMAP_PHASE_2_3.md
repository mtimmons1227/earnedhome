# EarnedHome — Phase II / III Roadmap & Honesty Ledger
**Features that are planned but NOT yet in the codebase. Recorded so they aren't lost — and so "planned" is never mistaken for "shipped."**
_Created June 21, 2026._

> **Why this doc exists.** A few capabilities have been described in pitches/conversations that do **not** exist in the repo today. This ledger states, plainly, what is **built (Phase 1A)** vs. **planned (Phase II/III)**, where each future item would plug into the current architecture, and what it depends on. Use Phase-1A claims freely; treat everything below as roadmap, not fact, until it ships and is verified.

## What IS built today (Phase 1A) — for contrast
Live Graph pricing engine (6 products incl. Jumbo/VA), buyer Pathfinder tool, lead capture with TCPA consent, the LO dashboard (leads, status, attributed notes thread, filter), the admin Rate Workbook tool, multi-tenant Supabase + RLS, two-environment deploy (QA/prod). See [`INFRASTRUCTURE.md`](INFRASTRUCTURE.md).

---

## Gap items (NOT in the repo — Phase II/III)

### 1. Azure OpenAI / LLM integration — **NOT built**
- **Reality today:** zero AI/LLM references in the code. No Azure OpenAI resource, keys, or service.
- **Phase II plan:** add an AI layer behind an interface (mirror the `PricingAdapter` pattern → `AIAdapter`: `stub` vs `azure-openai`), called server-side from API routes. It powers items #2 and #3 below, and a possible buyer Q&A assistant.
- **Plugs in at:** new `src/lib/ai/` module + API route(s); Azure OpenAI resource in the InCRyptable Azure/M365 tenant; server-only env vars.
- **Dependencies / guardrails:** prompt design; **no personalized financial/legal advice** (general/educational only — RESPA/UDAAP); reviewed output copy; cost controls. Ties to the **Agentic AI Roadmap** note (OneDrive `06 Pathfinder 1A/Agentic_AI_Roadmap.md`).

### 2. 60-day mortgage-readiness plan generator — **NOT built**
- **Reality today:** there is a **demo** only — `src/components/ReadinessDemo.tsx` + `/readiness` route — a mockup, not a real generator. No logic produces a personalized plan. (The old README's "next: a 60-day get-ready plan" was aspirational.)
- **Phase II plan:** generate a personalized plan from the buyer's inputs (credit band, down-payment gap, DTI signals) → timed steps to improve credit, save, and reduce debt, then route to the LO. **Rules-based first**, optionally LLM-enhanced via #1.
- **Plugs in at:** new generator module + a real results UI replacing the demo; reuses buyer inputs already captured.
- **Guardrails:** educational/general, not personalized advice (same posture as the "Ways to Lower Your Payment" panel).

### 3. LLM-generated scenario explanations — **NOT built**
- **Reality today:** cards show numbers; the "Understanding your estimate" panel is **static** copy. Nothing dynamically explains *this* buyer's specific results.
- **Phase II/III plan:** use the AI layer (#1) to generate plain-language explanations of the buyer's own scenario ("your FHA payment is higher because mortgage insurance applies at this LTV…").
- **Guardrails:** general/educational, reviewed, no steering/advice.

### 4. Power Automate (or in-code) fan-out from `/api/lead` — **NOT built**
- **Reality today:** `/api/lead` is a **clean Supabase insert + a logged event**. There is **no webhook, no LO notification, no CRM push, no follow-up.** The LO email/SMS is a `// TODO` in the route.
- **Phase II plan:** add the lead-handoff automation. Two options:
  - **In-code:** Resend (email) + Twilio (SMS) directly in `/api/lead`. Simplest, cheapest, one codebase.
  - **Power Automate:** the app's `/api/lead` route (or a **Supabase database webhook** on `leads` insert) POSTs the lead to a Power Automate "When an HTTP request is received" flow that fans out → notify Richard (Teams/Outlook), add to CRM, follow-up email/SMS, log referral, update a Power BI dashboard. Fits because the org is already on Microsoft 365; premium connectors/license required.
- **Plugs in at:** `src/app/api/lead/route.ts` (add a webhook POST or direct send) and/or a Supabase DB webhook.
- **Decision pending:** in-code vs Power Automate (see the head-to-head — in-code for simple notify; Power Automate for non-dev-editable M365/CRM fan-out; hybrid is common).

### 5. "18% throughput lift" — **NOT measured / NOT documented**
- **Reality today:** no benchmark, metric, or measurement of this exists anywhere in the repo. It is an **unverified claim** and must not be stated as fact.
- **Phase II plan:** if this refers to a target benefit of an optimization (e.g., the input-hash cache, an output-contract-tab single-read, or request batching — see `PRICING_ENGINE.md`), it has to be **instrumented and benchmarked**: establish a baseline quote latency/throughput (the "round-trip budget"), apply the optimization, and measure the **real** delta. Document the actual number; don't quote 18% until it's measured.
- **Plugs in at:** add timing/throughput instrumentation around the graph adapter; a small load test.

---

## AI solutions — generative vs predictive (Phase II/III)

**The rail (applies to every AI item):** EarnedHome **educates and routes** — it is not an underwriter, and the pricing logic stays in the LO's auditable workbook. So AI here is **educational or internal**, keeps a **human in the loop**, and never gives personalized financial advice or anything resembling a credit decision (RESPA / UDAAP / ECOA). Two families: **generative** (explain / draft / converse) and **predictive** (score / rank / time).

### 6. LO copilot (internal, generative) — **NOT built** — *best near-term AI win*
- **Plan:** draft the follow-up email/SMS to a new lead, summarize a lead's notes + the exact quote they saw, suggest talking points, and produce a daily "your pipeline" digest. **LO reviews before anything sends.**
- **Why first:** internal-facing → **lowest compliance risk**, fastest ROI; pairs directly with the lead fan-out (#4) and routing (#5/Phase II).
- **Plugs in at:** the AI layer (#1) called from dashboard actions + a scheduled digest task.

### 7. Predictive lead scoring & prioritization — **NOT built**
- **Plan:** a conversion-likelihood score so the LO works the hottest leads first (speed-to-lead is where deals are won).
- **⚠️ Fair-lending guardrail:** for **outreach prioritization only** — must **not** influence who is offered credit or pricing, and must avoid protected-class proxies (ECOA / disparate-impact). Prioritization ≠ underwriting.

### 8. Readiness / qualification score (predictive) — **NOT built**
- **Plan:** predict how mortgage-ready a buyer is and **time-to-ready** (credit band, down-payment gap, debt signals). Doubles as buyer motivation ("you're ~2 months away") and LO triage. Complements the #2 plan *generator* (this is the *score*; #2 is the *steps*).
- **Guardrail:** educational/motivational, **not** a credit decision or approval.

### 9. Re-engagement timing (predictive) — **NOT built**
- **Plan:** predict when a warm-but-quiet buyer is likely ready to act and nudge the LO — turns saved-quote data into a follow-up engine. Runs as a scheduled, human-approved trigger (agentic edge).

### 10. Constrained buyer education assistant / "the bot" — **NOT built** — *Phase III, cautious*
- **Decision:** a **free-form** buyer chatbot is **too much / too risky** now (hallucination liability; edges toward advice + fair-lending exposure). A **narrow, grounded** assistant is viable later.
- **Plan (if built):** scoped to a **curated, compliance-approved knowledge base** (RAG — answers only from vetted content), with hard guardrails: educational only, no rate commitments, no "should you" recommendations, and an explicit **hand-off to the loan officer** the moment a question gets personal or complex. "Guided explainer that knows when to say *let's get your LO on this*," not a general chatbot.

---

## Suggested phasing
- **Phase II:** #4 lead fan-out (closes the LO-notification gap), **#6 LO copilot (internal — start here)**, #2 readiness plan (rules-based), #3 scenario explanations (templated/reviewed), #5 instrument + benchmark (batching already measured ~7s→~2s).
- **Phase III:** #1 Azure OpenAI layer (the shared `AIAdapter` seam), #7 predictive lead scoring (with fair-lending care), #8 qualification score, #9 re-engagement timing, **#10 constrained education assistant**, LLM-enhanced readiness plan — the agentic layer, under human-approved guardrails.

## Honesty rule
When describing EarnedHome (resume, pitch, demo): claim only what's in **"What IS built today"** above. Everything in the gap list is **roadmap** — describe it as planned, not delivered, until it ships and (for #5) is measured.
