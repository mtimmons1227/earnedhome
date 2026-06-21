# How to Deploy — the simple version

A plain-English recipe for getting a change from your computer to the live site. For the full detail, see [`CONTRIBUTING.md`](../CONTRIBUTING.md).

## The mental picture — two lanes

- 🛠️ **`dev` = the practice stage.** Try things here. If it breaks, no one important sees it. This is the **QA site**: `https://dev--earnedhome.netlify.app`
- 🎬 **`main` = the real show.** Only tested, working code goes here. This is **production**: `https://earnedhome.netlify.app`

**Golden rule:** every change goes to the practice stage first, and only moves to the real show after you've checked it.

---

## PHASE 1 — Local → `dev` → QA site (test your change)

```powershell
cd C:\Users\marv_\projects\earnedhome

git checkout dev            # stand in the practice lane (may say "Already on 'dev'")
git status                  # shows your change in red — proof git sees it
git add -A                  # bundle up your changes
git commit -m "Short note about what you changed"
git push origin dev         # send it to GitHub's dev branch
```

Then **wait ~1 minute.** Netlify rebuilds the QA site automatically. On the Netlify **Deploys** page a new **"Branch deploy: dev@…"** turns green. Open **https://dev--earnedhome.netlify.app** and **test your change there.**

👉 If something's wrong, fix it locally and repeat Phase 1. Production never saw it — that's the point.

---

## PHASE 2 — `dev` → `main` → Production (go live)

**Only do this once the QA site looks good.**

```powershell
git checkout main           # step into the real-show lane
git merge dev               # copy your tested dev code into main
git push origin main        # send to GitHub main → Netlify rebuilds PRODUCTION
git checkout dev            # hop back to the practice lane for your next change
```

**Wait ~1 minute,** then open **https://earnedhome.netlify.app** and confirm your change is live. Done. 🎉

---

## Cheat-sheet (copy/paste)

```powershell
# 1. TEST IT (local → QA)
git checkout dev
git add -A
git commit -m "what I changed"
git push origin dev
#   → check https://dev--earnedhome.netlify.app

# 2. SHIP IT (QA → production)
git checkout main
git merge dev
git push origin main
git checkout dev
#   → check https://earnedhome.netlify.app
```

## Two rules and you'll never get confused
1. **Start every change with `git checkout dev`.** Always begin in the practice lane.
2. **Only run Phase 2 after the QA site looks right.** Testing is the gate between practice and the real show.

## If something looks off
- **`git push` rejected / "updates were rejected":** someone/something changed the branch on GitHub. Run `git pull` on that branch, then push again.
- **A `.git\HEAD.lock` error:** run `Remove-Item .git\HEAD.lock`, then retry the command.
- **QA site didn't rebuild:** make sure you pushed to `dev` (not just committed). Check the Netlify Deploys page for a `dev` entry.
- **Rollback production:** Netlify → Deploys → click an older green Production deploy → **Publish deploy**.
