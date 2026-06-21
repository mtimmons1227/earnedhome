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
- **`dev` / feature branches** = work in progress. They open PRs into `main` and get their own Netlify Deploy Preview.
- Never push straight to `main`; go through a PR so there's always a preview build and a review step.

## Where the pricing engine fits
Netlify serves the app and its API routes. Behind Netlify sit **Supabase** (database/auth) and the partner's **SharePoint-hosted Excel workbook** (the pricing engine, reached via the Microsoft Graph API). Switching production from the demo `stub` to the live engine is a **configuration** change, not a deploy change: set `PRICING_ADAPTER=graph` + the `GRAPH_*` env vars in Netlify.

## Environments & secrets
| Environment | URL | Engine | Config source |
|---|---|---|---|
| Local | `localhost:3000` | `stub` or `graph` | `.env.local` (git-ignored) |
| Preview | per-PR Netlify URL | as configured | Netlify env (deploy-preview scope) |
| Production | `earnedhome.netlify.app` | `graph` at go-live | Netlify env (production scope) |

Secrets live only in `.env.local` (local) and the Netlify environment store — **never committed**.

## Recommended next step (not yet in place)
Add **GitHub Actions CI** to run `typecheck` + `lint` + tests on every PR, so a failing change can't be merged to `main`. This complements the Netlify build with an explicit, visible pass/fail check on each pull request.

---
*Full QA test cases are in [`docs/sdlc/05a-qa-test-plan.md`](docs/sdlc/05a-qa-test-plan.md); deployment/operations detail is in [`docs/sdlc/06-implementation.md`](docs/sdlc/06-implementation.md).*
