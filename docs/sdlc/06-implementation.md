# Phase 6 — Implementation
**AI-era name: Deployment & Operations (LLMOps / MLOps)**
**Status: 🔄 In progress** — app is deployed on Netlify running the stub; go-live = setting `PRICING_ADAPTER=graph` + `GRAPH_*` env vars in Netlify, then `test:tags` against the deployed config.

## Purpose
Ship the system to where users reach it, and run it reliably day to day — including the recurring data updates the product depends on.

## Process (repeatable)
1. **Choose hosting & CI/CD** and connect it to the repo.
2. **Configure environment** — every secret and toggle the app needs, set in the host (never committed).
3. **Promote through environments** — preview/deploy, then production.
4. **Define the operational runbook** — the recurring tasks that keep it healthy.
5. **Plan monitoring, rollback, and versioning.**

## What we did on EarnedHome (Phase 1A)

### Hosting & CI/CD
- **Netlify**, building from the GitHub repo (push to branch → deploy preview; production deploy on the release branch). The site currently runs on the **stub**; going live on real pricing is a configuration flip, not a code change.

### Environment configuration (the go-live switch)
The single most important deployment step is environment config, because the app is **stub vs. live by env var**. On Netlify, set:
- `PRICING_ADAPTER=graph`
- `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`
- `GRAPH_WORKBOOK_DRIVE_ID`, `GRAPH_WORKBOOK_ITEM_ID` (the SharePoint EarnedHome workbook)
- Supabase URL + keys

Secrets live **only** in the host's env store and `.env.local` (git-ignored) — never in the repo. After setting them, run `test:tags` against the deployed config to confirm the connection before announcing.

### Source-of-record operations (the daily runbook)
The product's "model" is refreshed daily by the loan officer:
1. He updates rates in the **RateStream** workbook.
2. He saves it back to SharePoint via **Upload → Replace**, which **keeps the same Graph item id** — so the app picks up new numbers with **no env change and no redeploy**.
3. The app's 5-minute cache means new rates appear within the TTL (or immediately on a changed input).
4. The **"rates as of"** stamp on the GUI reflects the sheet's own date, giving buyers (and us) a freshness signal.

### Versioning, rollback, monitoring
- **Workbook:** SharePoint versioning + require-checkout + content approval → any bad rate update can be rolled back to a prior version.
- **App:** Netlify keeps prior deploys → one-click rollback; all code changes flow through Git on `dev`.
- **Resilience built into the adapter:** token refresh, 429/503 backoff, the concurrency lock, and tolerant reads keep a single shared workbook stable under real traffic.
- **Lead flow:** captured leads route to the loan officer (the operational payoff of the whole pipeline).

### Go-live checklist
- [ ] Netlify env vars set (`PRICING_ADAPTER=graph` + all `GRAPH_*` + Supabase).
- [ ] `test:tags` passes against the deployed config.
- [ ] Loan officer's info-panel / disclosure copy RESPA-reviewed and swapped in.
- [ ] Production deploy verified on desktop and mobile.
- [ ] Rollback path confirmed (Netlify deploy history + SharePoint version history).

## AI's role in this phase
**Maturity: AI-Assisted, trending Agentic.** AI produced the deployment runbook, the go-live checklist, and the partner's daily-ops guide, and can help optimize the pipeline and predict/monitor failures. Money-touching and config-changing actions stay with the human by policy — AI never sets production secrets or flips the live engine on its own. Scheduled monitoring (rates/leads) is the agentic edge, run under human-approved guardrails.

## Key artifacts
- Netlify project + environment configuration.
- The daily rate-update guide handed to the loan officer (Replace-keeps-the-id workflow).
- SharePoint library settings (versioning, check-out, approval).
- `test:tags` as the post-deploy smoke check.
