# Environment Architecture Playbook
**A reusable blueprint for standing up the three-tier environment — Local → GitHub → Netlify — for any web application.**

> **How to use this document.** This is a *template*, not a one-off. When starting a new app, copy this file into the new repo and work through the **New-Project Setup Checklist** (Section 9). Replace the placeholders (`<project>`, `<sitename>`, domain names) with the new app's values. The EarnedHome values appear in Section 11 as a worked example. Extend this doc as you learn — it's meant to grow with each project.

---

## 1. The architecture at a glance

Three tiers, each with one job. Code flows left to right; nothing skips a tier.

```
┌──────────────────────┐      ┌───────────────────────┐      ┌────────────────────────────┐
│  TIER 1 — LOCAL       │ git  │  TIER 2 — GITHUB       │ web- │  TIER 3 — NETLIFY           │
│  your machine          │ push │  source of record      │ hook │  build + host               │
│                        │ ───▶ │                        │ ───▶ │                            │
│  • write & run code    │      │  • the truth: branches │      │  • builds each branch       │
│  • test locally        │      │  • history & review    │      │  • serves the live sites    │
│  • .env.local (secrets)│      │  • branch protection   │      │  • env vars per context     │
└──────────────────────┘      └───────────────────────┘      └────────────────────────────┘
        DEV / QA                     REVIEW / HISTORY                 STAGING + PRODUCTION
```

**One-line summary:** you *write* code on the **Local** tier, *store and protect* it on **GitHub**, and **Netlify** *builds and serves* it automatically whenever GitHub changes.

---

## 2. Tier 1 — Local machine (where you build)

**Role:** the workshop. You write code, run it, and test it before anyone else sees it.

**What lives here**
- The full project (cloned from GitHub).
- `node_modules/` (installed dependencies — never committed).
- **`.env.local`** — your secrets and config for local runs. **Never committed** (git-ignored).

**How to set it up (per machine / per project)**
```bash
git clone https://github.com/<owner>/<project>.git
cd <project>
npm install                     # install dependencies
cp .env.example .env.local      # then fill in real values
npm run dev                     # run locally (e.g. http://localhost:3000)
```

**Conventions**
- Keep a committed **`.env.example`** listing every variable name with blank/placeholder values, so a new machine knows what to fill in.
- Run the quality gates locally before pushing: `npm run typecheck`, `npm run lint`, the project's test scripts.
- Real secret values live only in `.env.local` and never leave the machine.

---

## 3. Tier 2 — GitHub (the source of record)

**Role:** the single source of truth. Every line of code, its full history, and the rules that protect it.

**What lives here**
- All branches (see the branch model below).
- Commit history and pull requests (the review trail).
- `.gitignore` (keeps secrets and build junk out) and `.env.example`.
- **No secrets, ever.** `.gitignore` must include `.env*.local`, `node_modules`, build output.

**Branch model (the standard three-lane setup)**
| Branch | Purpose | Maps to |
|---|---|---|
| `main` | **Production.** Protected. Only tested code lands here. | Production site |
| `dev` | **QA / staging.** Integration + testing before release. | QA site |
| `feature/*` | One change at a time; opens a PR. | Per-PR preview |

**How to set it up (per project)**
1. Create the repo (private for proprietary work; public only if fully sanitized).
2. Push the initial code to `main`, then create `dev` from `main`.
3. **Protect `main`:** Settings → Branches → add a rule for `main` (require PRs / prevent force-push). This is what makes "only tested code reaches production" real.
4. Fill in the **About** panel (description, live URL, topics) — the repo's front door.
5. Add reviewers as read-only collaborators when sharing.

**Golden rules**
- Never commit secrets. If one slips in, rotate it and scrub history.
- Never push straight to `main` — go through `dev` and/or a PR so there's always a build to verify and a review step.

---

## 4. Tier 3 — Netlify (build + host)

**Role:** the automatic factory and storefront. It watches GitHub, builds whatever changed, and serves it at a URL. No manual deploys.

**The three deploy contexts** (Netlify builds each branch/PR into its own environment)
| Context | Trigger | URL pattern |
|---|---|---|
| **Production** | push to `main` | `<sitename>.netlify.app` (+ custom domain) |
| **Branch deploy** | push to `dev` | `dev--<sitename>.netlify.app` |
| **Deploy Preview** | open/update a PR | unique per-PR URL |

**How to set it up (per project)**
1. **Connect the repo:** New site → import from GitHub → pick the repo. Netlify auto-detects the framework (build command + publish dir).
2. **Production branch** = `main` (default).
3. **Enable the QA environment:** Site config → Build & deploy → Continuous deployment → **Branches and deploy contexts** → Configure → **"Let me add individual branches"** → add `dev` → Save. This creates the persistent `dev--<sitename>.netlify.app` QA URL.
4. **Environment variables, scoped per context:** Site config → Environment variables. Each variable can hold a **different value per context** (Production vs Branch deploys vs Deploy Previews) — this is how QA and production run different settings from one codebase.
5. **Custom domain (production):** Domain management → add domain → point DNS at Netlify.

**Operations**
- **Rollback:** Deploys → pick an older green Production deploy → **Publish deploy**. Instant.
- **Trigger a build manually:** push a commit (even `git commit --allow-empty`) or use *Trigger deploy*.
- Older deploys are retained, so every release is reversible.

---

## 5. The pipeline (how the three connect)

```
Edit locally  ──▶  git push dev  ──▶  Netlify builds QA  ──▶  test on dev--<site>
                                                                      │  looks good?
                                                                      ▼
                              merge dev → main  ──▶  git push main  ──▶  Netlify builds PRODUCTION
```

The everyday loop: **develop local → push `dev` (QA rebuilds, test there) → merge `dev → main` (production rebuilds).** See [`HOW_TO_DEPLOY.md`](HOW_TO_DEPLOY.md) for the exact commands.

---

## 6. Environments & configuration matrix

Fill this in per project. It's the at-a-glance "what runs where."

| Environment | Branch | URL | Config source | Notes |
|---|---|---|---|---|
| Local | working copy | `localhost:<port>` | `.env.local` | full secrets; never committed |
| QA / Staging | `dev` | `dev--<sitename>.netlify.app` | Netlify (branch-deploy context) | test before release |
| Production | `main` | `<sitename>.netlify.app` (+ domain) | Netlify (production context) | live users |

---

## 7. Data & secrets architecture (decide this per app)

- **Secrets** live in exactly two places: each developer's `.env.local`, and the Netlify environment store (scoped per context). Never in GitHub.
- **Data separation is a deliberate choice.** Code and env vars separate cleanly by branch/context — **data does not.** If QA and production point at the *same* database/backend, QA test data lands in production. For real isolation, give QA its **own** backend project (or schema) and set those keys on the branch-deploy context. For small pilots, shared data may be acceptable short-term — just decide it on purpose.
- **Backend tiers to consider** (DB, auth, third-party APIs, file/engine sources): for each, decide "shared QA+prod" vs "separate," and record it in Section 6.

---

## 8. Quality gates (recommended for every project)

- **Local:** `typecheck`, `lint`, tests run before pushing.
- **CI (GitHub Actions):** a workflow that runs `typecheck` + `lint` + tests on every PR, so a failing change can't merge to `main`. This is the automated guard that complements the Netlify build.
- **Branch protection on `main`:** require the PR (and, once CI exists, require the check to pass).

---

## 9. New-Project Setup Checklist (do this for each new app)

**Tier 1 — Local**
- [ ] `git clone` (or `git init` for a brand-new project)
- [ ] `npm install`
- [ ] Create `.env.example` (names only) and `.env.local` (real values, git-ignored)
- [ ] Confirm `npm run dev` runs

**Tier 2 — GitHub**
- [ ] Create the repo (private unless fully sanitized)
- [ ] `.gitignore` covers `.env*.local`, `node_modules`, build output
- [ ] Push to `main`; create `dev` from `main`
- [ ] Protect `main` (require PRs)
- [ ] Fill in the About panel (description, URL, topics)

**Tier 3 — Netlify**
- [ ] Connect the repo; confirm build command + publish dir
- [ ] Production branch = `main`
- [ ] Enable branch deploy for `dev` (QA URL)
- [ ] Set environment variables, scoped per context
- [ ] (At go-live) attach the custom domain to production

**Cross-cutting**
- [ ] Decide data separation (shared vs. separate QA backend)
- [ ] Add CI (GitHub Actions) for typecheck/lint/tests on PRs
- [ ] Copy `HOW_TO_DEPLOY.md` into the repo for the team

---

## 10. How to extend this playbook
Add a new section whenever you adopt a new capability so the next project inherits it: e.g., a **preview-database** strategy, **feature-flagging**, a **staging custom domain**, **monitoring/alerts**, or **infrastructure-as-code**. Keep the structure (role → what lives here → how to set up → conventions) so each tier stays easy to scan.

---

## 11. Worked example — EarnedHome

| Tier | Value |
|---|---|
| **Project** | `earnedhome` |
| **Local** | `C:\Users\<user>\projects\earnedhome`; `npm run dev` → `localhost:3000`; `.env.local` holds Supabase + `GRAPH_*` + `PRICING_ADAPTER` |
| **GitHub** | `github.com/mtimmons1227/earnedhome` (private); branches `main` (prod), `dev` (QA); `main` protected |
| **Netlify** | site `earnedhome`; **Production** `earnedhome.netlify.app` (← `main`); **QA** `dev--earnedhome.netlify.app` (← `dev`) |
| **Stack** | Next.js 14 + Supabase + Microsoft Graph (Excel pricing engine) |
| **Config switch** | `PRICING_ADAPTER` = `stub` (demo) or `graph` (live) — set **per context**: `graph` on Branch deploys (QA), `stub` on Production. `GRAPH_WORKBOOK_*` (which file) is separate from `PRICING_ADAPTER` (whether the buyer page reads it). |
| **Data note** | QA + Production **share one Supabase database** (free-tier 2-project limit; "Option B"). Data isolated by tenant/RLS but not by environment; test with a `QA TEST` marker + cleanup query. Separate QA Supabase project deferred to launch. See [`INFRASTRUCTURE.md`](INFRASTRUCTURE.md). |

---
*Related docs: [`CONTRIBUTING.md`](../CONTRIBUTING.md) (workflow detail) · [`HOW_TO_DEPLOY.md`](HOW_TO_DEPLOY.md) (the deploy recipe) · [`docs/sdlc/`](sdlc/README.md) (the full lifecycle).*
