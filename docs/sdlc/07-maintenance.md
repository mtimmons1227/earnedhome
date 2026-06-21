# Phase 7 — Maintenance
**AI-era name: Continuous Operations & Assurance**
**Status: ⏳ Begins at go-live** — the daily rate-update workflow is defined and proven; continuous operations start when the live engine is in production.

## Purpose
Keep the system correct, secure, and current after launch — the data refreshes, dependency and security upkeep, monitoring, and the steady stream of small improvements.

## Process (repeatable)
1. **Run the recurring data updates** the product depends on.
2. **Monitor** health, errors, and anomalies; respond to incidents.
3. **Patch and update** dependencies and fix security findings.
4. **Triage and ship** small enhancements and bug fixes through the same Git → CI/CD path.
5. **Keep docs and runbooks current** as the system changes.

## What we did / plan on EarnedHome (Phase 1A)

### Recurring data operations (the heartbeat)
The product's "model" is refreshed daily: the loan officer updates rates in the RateStream workbook and saves via **Replace** (same item id → no redeploy). The app's short cache and the **"rates as of"** stamp keep buyers on current numbers. SharePoint **versioning + check-out + content approval** mean a bad update is a one-click rollback.

### Monitoring & incident response
- Adapter resilience (token refresh, 429/503 backoff, concurrency lock, tolerant reads) keeps a single shared workbook stable.
- Connection health is verifiable on demand with `test:tags`; the same check is the post-change smoke test.
- Netlify deploy history gives instant app-level rollback.

### Security & dependency upkeep
- Secrets stay in env stores; `.env*.local` is git-ignored.
- Dependencies (Next.js, Supabase client, etc.) are updated on a regular cadence; security findings are patched and re-deployed through the normal branch → preview → production flow.

### Enhancements
Small changes (copy, labels, new products, additional disclosures) follow the same SDLC in miniature — and the partner's RESPA review gates any customer-facing copy before it ships.

## AI's role in this phase
**Maturity: AI-Assisted, trending Agentic (under guardrails).**
- **Vulnerability & anomaly scanning** — AI assists in reviewing dependency advisories and flagging unusual rate values or quote results.
- **Incident triage** — AI drafts root-cause notes and fixes (as it did for the live defects in Phase 5), with a human approving every change.
- **Doc upkeep** — this documentation set is AI-maintained; updates are regenerated as the system changes.
- **Toward agentic ops** — scheduled tasks can watch rates/leads and surface digests automatically; these run on a fixed schedule with human-approved actions, never autonomous money-touching or config changes.

## Key artifacts
- The daily rate-update guide (Replace-keeps-the-id workflow).
- `test:tags` as the standing connection/health check.
- SharePoint version history + Netlify deploy history (dual rollback).
- This SDLC doc set, kept current.
