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

## Process enhancements (later releases) — *added June 25*

### 11. Compliance / QA agent (internal) — *Phase II, elevated* — **NOT built**
- **What it is:** an internal AI reviewer that checks every customer-facing change — disclosures, info-panel/tooltip copy, email text, button labels, the readiness plan — against a codified checklist (RESPA §8, Reg Z/TILA, TCPA, UDAAP, ECOA/fair-lending) **plus** EarnedHome's own rules (estimates-only, no advice, not-a-commitment, NMLS + Equal Housing present, consent captured).
- **Output:** pass/fail with the **specific flagged lines**, the rule each trips, and a suggested **compliant rewrite** (catches advice language like "best loan for you," rate commitments, steering, missing disclosures, unsubstantiated superlatives).
- **How:** server-side LLM grounded (RAG) on the approved disclosure language + a reg checklist; a pre-merge check or dashboard tool, behind a flag, **internal only**.
- **Why elevate:** compliance gates *every* customer-facing change and is today a manual Richard/counsel bottleneck. A pre-screen catches issues early, standardizes review, and creates an **audit trail**. It does **not** replace counsel — first-pass filter + drafting aid. Internal → no consumer sees it → low regulatory risk itself.

### 12. Reverse affordability ("what can I afford?") — *Phase II* — **NOT built**
Flip the engine: buyer enters budget/income → price range they fit. Mostly deterministic; high buyer pull; natural extension of the existing engine. Educational, not an approval.

### 13. LO pipeline analytics + speed-to-lead SLA — *Phase II* — **NOT built**
Funnel, source attribution, time-to-contact metrics, and an escalation if a lead isn't contacted within N minutes. Turns lead data into management insight; protects deals where speed wins.

### 14. Builder / partner portal + analytics — *Phase III* — **NOT built**
A branded dashboard giving each builder their own lead funnel + analytics. White-label expansion + a sales point (builder ownership). New surface; see [`WHITE_LABEL_ARCHITECTURE.md`](WHITE_LABEL_ARCHITECTURE.md).

### 15. Community / inventory data integration (ATTOM / MLS) — *Phase III* — **NOT built**
Auto-pull county tax rate, HOA, and available homes per community. Removes manual onboarding setup; enables accurate per-community pricing. Foundation for builder white-label (pairs with the community-onboarding agent in the Agentic doc).

### 16. Buyer rate-watch / readiness alerts (opt-in) — *Phase III* — **NOT built**
Notify a buyer when rates move or they cross a readiness milestone — turns one-time visitors into a nurtured pipeline; the delivery vehicle for the predictive re-engagement score (#9). Needs notification infra + opt-in consent.

### 17. Multilingual education (Spanish first) — *Phase III* — **NOT built**
Generative translation of the educational content — broadens the buyer base in many builder markets; low-risk for *educational* copy with review.

---

## Master phased plan (1A / II / III)

**Phase 1A — built / finishing.** Live Graph engine (6 products incl. Jumbo/VA), **batched ~7s→~2s**; buyer tool with **eligibility edit checks** (jumbo/VA tiers, greyed cards) + **Property Type**; lead capture + TCPA; LO dashboard (leads, status, notes, filter); admin Rate Workbook tool; **forgot-password (LO-only, flag-gated)**; multi-tenant + RLS; two-env deploy. *Finishing:* Richard's engine validation + VA-15 fix, RESPA copy sign-off, flip prod to live engine, domain + first builder, **Resend SMTP before forgot-password ships**.

**Phase II — near-term (value, lower risk; internal-first AI).**
- #4 Lead fan-out (LO email/SMS notification — speed-to-lead)
- #6 **LO copilot** (internal generative — *start here*)
- #11 **Compliance/QA agent** (internal — de-risks everything)
- #2 Readiness plan (rules-based) · #3 scenario explanations (templated/reviewed)
- #5 Default-LO routing (multi-LO 2a)
- #12 Reverse affordability · #13 LO analytics + speed-to-lead SLA
- Buyer estimate email + resume link ([`specs/buyer-email-resume-link.md`](specs/buyer-email-resume-link.md))
- White-label foundation: **per-tenant workbook ids** + onboarding flow ([`WHITE_LABEL_ARCHITECTURE.md`](WHITE_LABEL_ARCHITECTURE.md))

**Phase III — later (AI layer, buyer-facing, scale; counsel-gated).**
- #1 Azure OpenAI / `AIAdapter` layer (foundation) → LLM-enhanced #2/#3
- #7 Predictive lead scoring (fair-lending: outreach only) · #8 qualification score · #9 re-engagement timing
- #10 Constrained buyer education assistant (RAG, guardrailed) → conversational concierge (last)
- #14 Builder portal · #15 community/inventory data · #16 rate-watch alerts · #17 multilingual
- White-label scaling: custom-domain automation, SSO, billing

> **Guardrail rail (all phases):** AI stays educational or internal, human-in-the-loop, pricing in the workbook; predictive scoring is **outreach prioritization only — not credit/pricing** (ECOA); buyer-facing AI needs **counsel sign-off**. Internal agents before buyer-facing ones.

## Honesty rule
When describing EarnedHome (resume, pitch, demo): claim only what's in **"What IS built today"** above. Everything in the gap list is **roadmap** — describe it as planned, not delivered, until it ships and (for #5) is measured.
