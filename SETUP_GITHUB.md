# Push this to GitHub

The full source is here and was verified locally (typecheck + production build
pass; the Supabase schema/RLS is already live). Initialize git on your machine
and push to a new GitHub repo.

## Option A — fresh init (simplest)
1. Create an **empty** repo on GitHub (no README/license), e.g. `earnedhome`.
2. In this folder:

       npm install
       git init
       git add -A
       git commit -m "Phase 1A foundation"
       git branch -M main
       git remote add origin https://github.com/<you>/earnedhome.git
       git push -u origin main

## Option B — keep the prepared commit history
A ready-made commit is in `earnedhome-initial.bundle`. From the *parent* folder:

       git clone earnedhome-initial.bundle earnedhome-git
       # then copy your working files in, set the remote, and push
       # (Option A is usually easier — the bundle is just a safety copy.)

Delete `earnedhome-initial.bundle` once you've pushed.

## Then run it
    cp .env.example .env.local   # values for the live project are in .env.local already
    npm run dev                  # http://localhost:3000

`.env.local` already has the EarnedHome Supabase URL + publishable key. Add
`SUPABASE_SERVICE_ROLE_KEY` (from Supabase dashboard → Project Settings → API)
only if/when you want server writes to bypass RLS; the app works without it.

## Deploy (Vercel) — Phase 1A.0 remaining
- Import the GitHub repo into Vercel; set the same env vars in the project.
- Add the wildcard domain `*.earnedhome.com` (and `earnedhome.com`) in Vercel,
  plus the matching DNS records, to activate per-tenant subdomains.
