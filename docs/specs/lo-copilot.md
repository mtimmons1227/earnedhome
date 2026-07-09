# Spec — LO Copilot (Phase III, AI)

**Generative AI assistant for the loan officer. Internal, review-gated, human-approved. The safest, highest-adoption first AI feature.**

## Goal
Give the LO a copilot inside the dashboard that (1) **summarizes** a lead + their quote, (2) **drafts** a follow-up email/text, and (3) generates a **daily pipeline digest** — all reviewed by the LO before anything is sent. No auto-send, no decisions. Ships behind an `AIAdapter` so it starts on a deterministic stub and swaps to Azure OpenAI with zero front-end change.

## Why this first
- **Lowest regulatory risk:** internal tool, LO reviews/edits everything before a consumer sees it. Not automated advice, not a decision.
- **Highest ROI/adoption:** kills the LO's most tedious work (writing follow-ups, prepping for calls, planning the day).
- **Rides the data moat:** uses data we already have (leads, quotes, statuses, notes, `closed_at`).

## The seam — `AIAdapter` (mirror of `PricingAdapter`)
```ts
// src/lib/ai/types.ts
export interface AIAdapter {
  readonly name: "stub" | "azure-openai";
  complete(req: AIRequest): Promise<AIResult>;   // one guarded text-generation call
}
export interface AIRequest {
  task: "lead_summary" | "draft_follow_up" | "daily_digest";
  system: string;          // guardrail system prompt (server-built, never user-supplied)
  input: Record<string, unknown>; // structured, PII-minimized context
  maxTokens?: number;
}
export interface AIResult { text: string; tokens?: number; blocked?: boolean; reason?: string; }
```
```ts
// src/lib/ai/index.ts
export function getAIAdapter(): AIAdapter {
  return process.env.AI_ADAPTER === "azure-openai" ? azureAdapter : stubAdapter;
}
```
- `stub` returns deterministic, template-based text (no network) — build/test/offline safe, like the pricing stub.
- `azure-openai` calls Azure OpenAI server-side (`AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`, `AZURE_OPENAI_DEPLOYMENT`), app-only, no PII in logs.
- Selected by `AI_ADAPTER`. Ships **off/stub** so it's dormant until configured — same safe-by-default pattern as Resend/Graph.

## The three functions (v1)
1. **`lead_summary(leadId)`** → 2–4 sentence brief: who they are, their scenario (price/down/credit/product), status, days since contact, agent (if any), last note. Shown in the expanded lead row ("Summarize with AI").
2. **`draft_follow_up(leadId, channel: "email" | "text", tone?)`** → a ready-to-edit draft in the LO's voice referencing the buyer's scenario, with a clear CTA (book a time / call). **Rendered into an editable box; the LO edits + sends via their own tools.** Never auto-sent.
3. **`daily_digest()`** → a short prioritized list: "Top leads to work today and why" (stale-but-warm, new-this-week, price-sensitive when rates moved), plus the day's production snapshot. Shown as a dashboard panel / optional scheduled email to the LO.

## Guardrails (built into every system prompt + enforced server-side)
- **Never send** — output is always a draft the LO reviews. No send integration in v1.
- **No decisions / no advice** — never state approval, guarantee a rate/payment, or give personalized financial/legal advice. General + scenario-descriptive only (RESPA/UDAAP/ECOA).
- **No fabrication** — only use the structured `input` we pass; if data is missing, say so, don't invent.
- **Compliance-clean language** — include the estimates-only framing where numbers appear; no steering.
- **PII-minimized** — pass only what's needed; never log prompt bodies with PII.
- **Human-in-the-loop everywhere.** LO edits before anything reaches a consumer.

## API routes (server-only, tenant-gated via `requireTenantAdmin`)
- `POST /api/ai/lead-summary` `{ leadId }`
- `POST /api/ai/draft-follow-up` `{ leadId, channel, tone? }`
- `POST /api/ai/daily-digest`
Each: gate → load the lead/quote/notes (RLS-scoped) → build the guarded system prompt server-side → `getAIAdapter().complete(...)` → return text. Dormant no-op when `AI_ADAPTER` unset.

## UI touchpoints (dashboard)
- **Expanded lead row:** "Summarize with AI" + "Draft follow-up (email / text)" → fills an **editable** box with a copy button. Nothing sends automatically.
- **Top of dashboard:** "Today's focus" digest panel (collapsible).
- Optional later: a scheduled **morning digest email** to the LO (reuses the scheduled-task pattern).

## Data used
`leads` (name, scenario via `quotes`, status, `created_at`, `closed_at`, agent), `events` (notes / activity), tenant `lo_name`. All already captured; no new schema for v1.

## Rollout
1. Build `AIAdapter` + `stub` + the 3 routes + UI, shipped **dormant** (`AI_ADAPTER` unset → stub/no-op). Typecheck → QA.
2. Add the `azure-openai` adapter; set env on QA; test outputs against the guardrails.
3. Per-tenant enable (a tenant flag) — **premium tier**.
4. Only after trust: add scheduled digest email, then predictive lead scoring (separate spec), then agentic actions with approval gates.

## Monetization
LO Copilot is a **premium/upsell tier** — it justifies higher per-seat pricing and raises stickiness. Gate it per tenant.

## Out of scope (v1)
Auto-send; predictive lead scoring; buyer-facing generation; agentic actions. All are later phases (see [`ai-opportunity-map.md`](ai-opportunity-map.md)).
