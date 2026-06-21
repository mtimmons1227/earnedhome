# Development & Deployment Workflow

How code moves from a local machine to production. This is a standard **git-based continuous-deployment** flow: develop locally → push to GitHub → Netlify builds and deploys automatically.

## The flow

```
┌─────────────────────┐   git push    ┌──────────────────────┐   merge → main   ┌────────────────────────┐
│ 1. LOCAL MACHINE     │ ────────────▶ │ 2. GITHUB REPO       │ ──────────────▶ │ 3. NETLIFY              │
│  develop + test       │  feature/dev  │  pull request +       │                 │  build + deploy          │
│  npm run dev          │  branch       │  Netlify Deploy       │                 │  • Preview (per PR)      │
│  typecheck + tests    │               │  Preview auto-builds  │                 │  • Production (from main)│
└─────────────────────┘               └──────────────────────┘                 └────────────────────────┘
        DEV/QA                              REVIEW / STAGING                           PRODUCTION
```

| Stage | Where | Branch | What happens |
|---|---|---|---|
| **1. Local machine** | `localhost:3000` (`npm run dev`) | feature branch or `dev` | Write code, run `npm run typecheck` / `lint` / the `test:*` scripts, click through the change. |
| **2. GitHub** | the repo | push branch → open **Pull Request** into `main` | Netlify auto-builds a **Deploy Preview** at a unique URL so the change is verified in a real cloud build before it lands. `main` is branch-protected. |
| **3. Netlify** | `earnedhome.netlify.app` (+ custom domain) | `main` | Merging the PR to `main` triggers a **production** build and deploy. Older deploys stay available for one-click rollback. |

## Step by step

```powershell
# 1. Start from an up-to-date main and branch off
git checkout main
git pull
git checkout -b feature/my-change

# 2. Develop & verify locally
npm run dev          # http://localhost:3000
npm run typecheck    # types clean
npm run lint         # lint clean
npm run test:tags    # (and test:va if VA was touched)

# 3. Push and open a PR into main
git add -A
git commit -m "Describe the change"
git push origin feature/my-change
#   → open the PR on GitHub; Netlify posts a Deploy Preview URL on it

# 4. Verify the preview, then merge the PR → main
#   → Netlify auto-deploys main to production
```

## Branch model
- **`main`** = production. Protected. Every push to it deploys to Netlify production.
- **`dev`** = QA / staging. Pushes here update the persistent QA site (`dev--earnedhome.netlify.app`) for testing before release.
- **feature branches** = work in progress. They open PRs and get an ephemeral Netlify Deploy Preview.
- Never push straight to `main`; go through `dev` and/or a PR so there's always a build to verify and a review step.

## Where the pricing engine fits
Netlify serves the app and its API routes. Behind Netlify sit **Supabase** (database/auth) and the partner's **SharePoint-hosted Excel workbook** (the pricing engine, reached via the Microsoft Graph API). Switching production from the demo `stub` to the live engine is a **configuration** change, not a deploy change: set `PRICING_ADAPTER=graph` + the `GRAPH_*` env vars in Netlify.

## Environments

The project runs **two persistent live environments off one repo** — a QA/staging site and production — plus ephemeral per-PR previews. Each environment builds the code on its own branch and uses its own configuration, so QA and production can differ in both code and settings at the same time.

| Environment | Branch | URL | Engine / config |
|---|---|---|---|
| **Local** | working copy | `localhost:3000` (`npm run dev`) | `.env.local` (git-ignored); `stub` or `graph` |
| **PR Preview** | any feature branch (on a PR) | auto, unique per PR | Netlify "Deploy Preview" context |
| **QA / Staging** | `dev` | `dev--earnedhome.netlify.app` | Netlify "Branch deploys" context — test here before release |
| **Production** | `main` | `earnedhome.netlify.app` (+ custom domain) | Netlify "Production" context; `PRICING_ADAPTER=graph` at go-live |

Promotion is just a merge: **local → push `dev` (QA site updates, test there) → merge `dev → main` (production updates).**

### Setting up the QA (staging) environment on Netlify
One-time setup so the `dev` branch gets its own stable URL:

1. **Enable the branch deploy.** Netlify → *Site configuration → Build & deploy → Branches and deploy contexts* → set **Branch deploys** to include `dev` (either "Let me add individual branches" → `dev`, or "All branches"). This gives `dev` a persistent URL like `dev--earnedhome.netlify.app`.
2. **Scope environment variables per context.** Netlify → *Site configuration → Environment variables*. For each variable you can set a **different value per deploy context** (Production vs Branch deploys vs Deploy Previews). Example: production `PRICING_ADAPTER=graph`; the `dev`/branch-deploy context can use its own value and its own `GRAPH_*` / Supabase keys.
3. **Verify** by pushing to `dev` and opening the `dev--…` URL; run `npm run test:tags` against whatever workbook that context points at.

### ⚠ Data separation (plan for this)
Code and env vars separate cleanly by branch/context, but data does **not** unless you make it so. If QA and production share the **same Supabase project** and the **same pricing workbook**, then QA test leads and edits land in **production data**. For real isolation, give the QA (`dev`) context its **own Supabase project** (or schema) and its **own workbook copy**, and set those URLs/keys on the branch-deploy context. For the Phase 1A pilot, shared data may be acceptable short-term — just know that test submissions hit live data until the environments are split.

## Secrets
Secrets live only in `.env.local` (local) and the Netlify environment store — **never committed**. `.env*.local` is git-ignored.

## Recommended next step (not yet in place)
Add **GitHub Actions CI** to run `typecheck` + `lint` + tests on every PR, so a failing change can't be merged to `main`. This complements the Netlify build with an explicit, visible pass/fail check on each pull request.

---
*Full QA test cases are in [`docs/sdlc/05a-qa-test-plan.md`](docs/sdlc/05a-qa-test-plan.md); deployment/operations detail is in [`docs/sdlc/06-implementation.md`](docs/sdlc/06-implementation.md).*
