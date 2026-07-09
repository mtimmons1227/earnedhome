# AI Opportunity Map — EarnedHome

How AI fits the product we've built, organized by **persona** (Buyer · Agent · LO) × **AI type** (Generative · Agentic · Predictive). Grounded in the data we already capture; scoped to stay compliant.

> Companion to [`../ROADMAP_PHASE_2_3.md`](../ROADMAP_PHASE_2_3.md) and [`../sdlc/08-future-releases.md`](../sdlc/08-future-releases.md) items #1–3, #9. This is the persona-organized, actionable view.

## The model + why AI fits
EarnedHome is **B2B2C vertical SaaS**: we sell to the **LO/lender** (tenant), whose customers are **buyers**, with **realtor agents** as a distribution layer. AI here isn't a bolt-on — it compounds the **data moat** we already collect: every quote scenario (home price, down, credit band, occupancy, product), agent attribution, the lead status pipeline (`new → working → closed/funded`) with timestamps, and `closed_at`. That's the fuel for both predictive models and grounded (RAG) generation.

## Compliance rails (non-negotiable, mortgage)
- **No automated adverse decisions / no credit or pricing decisions by AI** (ECOA / fair lending). Pricing stays in the engine; predictive AI is **outreach prioritization only** — never approval odds framed as a decision, never using protected-class proxies.
- **Educational / general, not personalized financial or legal advice** (RESPA / UDAAP). Buyer-facing generation explains *their own numbers* and general concepts; it hands specifics to the licensed LO.
- **Human-in-the-loop** for anything sent to a consumer. The LO reviews/approves.
- **Reviewed content + audit trail.** Guardrailed prompts, logged outputs.

---

## Buyer (end consumer)
| Type | Idea | Value | Guardrail |
|---|---|---|---|
| **Generative** | **Plain-language scenario explainer** — "here's what your $3,400/mo is made of, and why FHA is lower for you." Explains *their* estimate. | Confidence, education, fewer drop-offs | Explains their own numbers; general education only |
| **Generative** | **Personalized "ways to lower your payment"** narrative (rules-first, LLM phrasing) | Actionable, keeps them engaged | Educational, not advice |
| **Generative** | **Guardrailed buyer Q&A** (RAG over *compliance-approved* content): "what's PMI? escrow? points?" → hands specifics to the LO | Self-serve education, 24/7 | RAG over approved corpus only; no free-form advice |
| **Generative** | **60-day mortgage-readiness plan** (credit/savings/DTI steps), rules-based → LLM-enhanced | Turns "not ready yet" into a nurtured lead | Educational; same posture as the payment tips |
| **Agentic** | **Readiness concierge** — checks in over time, re-runs their saved scenario when rates drop, nudges "your payment dropped $80 — reconnect?" | Re-engagement of dormant buyers (huge in mortgage) | Consent-based; routes to the LO |
| **Predictive** | **Readiness / qualification *indicator*** (how close to mortgage-ready) | Prioritizes nurturing, sets expectations | **Indicator, not a decision**; educational framing |

## Agent (realtor)
| Type | Idea | Value | Guardrail |
|---|---|---|---|
| **Generative** | **Buyer talking-points card** — auto summary of a buyer's scenario for the realtor before a showing/call | Realtor looks sharp, closes faster | From lead data; no PII leakage |
| **Generative** | **Listing → payment marketing** (co-branded flyer/social/text: "est. payment on this home") generated from a property + the LO's rates | Realtor's #1 want; drives more `/a/<slug>` traffic | Disclosures auto-attached; estimates-only |
| **Agentic** | **Share-a-listing assistant** — realtor drops a listing → auto-builds the scenario + their attributed link | Frictionless distribution, more attributed leads | Ties to existing agent attribution |
| **Predictive** | **Which of my buyers to follow up first** (transaction-likelihood triage) | Realtor focus; better lead quality for the LO | Outreach triage only, not credit |

## LO / loan officer (the paying customer — start here)
| Type | Idea | Value | Guardrail |
|---|---|---|---|
| **Generative** | **LO Copilot** — draft follow-up emails/texts, summarize a lead + their quote, one-click "next best action," **daily pipeline digest** | Massive time-saver; **lowest-risk, highest-adoption starting point** | LO reviews before send |
| **Generative** | **Rate-change blast drafts** — when rates move, draft a "rates just improved" note to the warm leads it would help | Turns rate moves into re-engagement | LO approves; scenario-accurate |
| **Generative** | **Auto monthly production narrative** from the closed/funded metrics we just built | Reporting for free | From real data |
| **Agentic** | **Pipeline agent** — watches the pipeline, nudges stale leads, re-engages price-sensitive buyers when rates drop, books Calendly, logs to CRM (closes the lead-fan-out loop) | The "self-driving pipeline"; retention driver | Human-approval gates; audit log |
| **Agentic** | **Rate-watch agent** — monitors the daily ratesheet; when a scenario a lead saw improves, flags it | Timely, high-intent outreach | Notify/suggest, not auto-decide |
| **Predictive** | **Lead scoring & prioritization** — rank leads by close-likelihood from engagement signals (multiple quotes, email opens, credit band, timeline) | Focus the LO's day on the right leads | **Prioritization only, never a credit decision**; no protected-class proxies |
| **Predictive** | **Pipeline forecast** — expected funded this month (leverages `closed_at` + stage velocity) | Revenue predictability for the LO | Estimate, clearly labeled |
| **Predictive** | **At-risk / going-cold detection** | Save deals before they die | Prompts outreach, not decisions |

---

## Phase III+ expansion — more AI surfaces
Beyond the persona grid above, AI is a horizontal layer that touches more of the product. ⭐ = highest-leverage next after LO Copilot.

**Documents & data**
- ⭐ **Ratesheet sanity-check** — before the LO's daily rate upload goes live, AI flags outliers ("15-yr FHA jumped 2% vs yesterday — typo?"). Because the *workbook is the engine*, a fat-finger rate would show buyers wrong payments. A **risk reducer**, not a nicety.
- ⭐ **Doc intake → pre-approval** — buyer uploads paystub/W2/bank statement; AI extracts income/assets to *organize the file and gauge readiness*, then hands to the LO. Moves the funnel forward (not a credit decision — prep only).
- **Document checklist automation** — tells the buyer which docs they'll need and checks them off.

**Language & access**
- ⭐ **Spanish / multilingual** — translate the whole buyer experience + emails on the fly (a large underserved mortgage market). Compliance-reviewed templates.
- **Reading-level adaptation** — explain at a 6th-grade level.
- **Voice intake** — buyer calls a number; an AI voice assistant runs the estimate conversationally (accessibility).

**LO knowledge & compliance**
- **"Ask the guidelines"** — LO asks program/eligibility questions, answered from the lender's *own* overlays/guidelines (RAG over R Parry's docs). Internal, not a decision.
- **Compliance copilot** — "is this disclosure language OK?" checked against the approved corpus.

**Risk & quality**
- **Lead-quality / spam filter** — auto-flag junk leads (e.g. the `;asjf;laj;aldsf` test lead). Keeps the pipeline clean.
- **Duplicate-lead detection** — merge suggestions.

**Insight & analytics**
- **"What changed this week"** — AI reads the dashboard metrics and writes two sentences ("closings up 20%, new leads down; Jane is your top source"). Cheap, high delight.
- **Anonymized cross-tenant benchmarking** — "your close rate is above average for your volume."

**Ops / onboarding**
- **AI-assisted tenant onboarding** — parse a new LO's ratesheet + brand assets to auto-fill the tenant config (supercharges the clone script) and map their workbook to the named-range schema (helps per-tenant pricing).

*Same rails apply:* buyer-facing = educational + human-reviewed + no automated decisions; predictive = outreach-only; pricing stays in the engine.

## Recommended sequencing (crawl → walk → run)
1. **Crawl — LO Copilot (generative, internal, human-approved).** Lowest regulatory risk (internal, LO reviews everything), highest adoption, immediate time-savings: lead summaries, draft follow-ups, daily digest, monthly production narrative. **Start here.**
2. **Walk — Predictive lead scoring + buyer scenario explainer.** Scoring is outreach prioritization (fair-lending-safe); the buyer explainer is education. Both ride the data moat.
3. **Run — Agentic pipeline + rate-watch, and the buyer readiness concierge.** Human-approval gates first, then progressively more autonomy as trust builds.

## How AI maps to the SaaS business
- **Premium tiers / upsell:** LO Copilot and predictive scoring are natural **higher-tier features** — they justify higher per-seat pricing and increase stickiness (an LO won't leave a tool that drafts their follow-ups and tells them who to call).
- **Compounding moat:** more tenants → more scenarios/outcomes → better predictions → better product. Classic data-network-effect for vertical SaaS.
- **Infra:** generative via **Azure OpenAI** behind an `AIAdapter` (mirror the `PricingAdapter` seam — `stub` vs `azure-openai`); predictive as a small model/service over the Supabase data; agentic as a guarded action layer with human-approval gates. All server-side.

## One-line summary
Start with the **LO Copilot** (generative, internal, review-gated) — biggest, safest win — then layer **predictive lead scoring** and the **buyer scenario explainer**, then graduate to an **agentic self-driving pipeline**. Every step compounds the data you already collect, and each is a premium tier that raises the value of the seat.
