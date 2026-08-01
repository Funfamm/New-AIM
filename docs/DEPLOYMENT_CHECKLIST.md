# AIM Studio Lite — Deployment Checklist

Run this checklist before every production merge and release.

## Pre-Merge (Every PR)

- [ ] `npm run build` passes with no errors
- [ ] `npm run lint` passes with no warnings
- [ ] `npx tsc --noEmit` passes with no type errors
- [ ] `npm audit` — no high or critical vulnerabilities
- [ ] All changed files reviewed in the PR diff
- [ ] No hardcoded secrets, tokens, or connection strings in the diff
- [ ] No commented-out debug code or `console.log` left behind
- [ ] Migration files (if any) reviewed and tested on a preview/branch database
- [ ] Vercel preview deployment reviewed in the browser

## Pre-Merge (Feature PRs)

- [ ] Feature works on mobile (tested in browser devtools at 375px minimum)
- [ ] Error states handled (empty data, failed fetch, unauthorized access)
- [ ] Admin-only features protected by `requireAdmin()` in Server Actions
- [ ] User-owned data checks `userId === session.user.id` before read/write
- [ ] No unbounded database queries (every `findMany` has a `take` limit)
- [ ] New environment variables documented in `.env.local.example`

## Database Migrations

- [ ] Migration tested on Neon branch/preview database first
- [ ] Destructive changes (DROP, rename, type change) follow the two-step process
- [ ] Rollback path known: what SQL reverses this migration if needed?
- [ ] `prisma migrate deploy` (not `db:push`) used for production

## Before Major Releases

- [ ] Rollback plan documented: which commit to revert to, which migration to roll back
- [ ] Environment variables verified in Vercel dashboard (no missing keys)
- [ ] Email provider (Graph/ACS) credentials valid and sending confirmed
- [ ] R2 CDN URLs reachable and returning correct content
- [ ] Admin dashboard accessible and showing correct data post-deploy
- [ ] HLS video playback tested on a published work
- [ ] No merge freeze in effect (check with team)

## Post-Deploy Verification

- [ ] Production build deployed without error in Vercel dashboard
- [ ] Home page loads and renders correctly
- [ ] Login and registration flow works
- [ ] Video playback works (HLS stream loads)
- [ ] Admin dashboard accessible and loads data
- [ ] Email queue processor running (check cron logs if applicable)
- [ ] No new errors appearing in Vercel logs within 10 minutes of deploy

## Rollback Procedure

If a production issue is detected after deploy:

1. Revert the PR on GitHub (GitHub → PR → Revert) — Vercel redeploys the previous build automatically.
2. If a migration was deployed, assess whether a rollback migration is needed. Apply via `prisma migrate deploy` on the rollback SQL.
3. Confirm the rollback deploy succeeded and the issue is resolved.
4. Write a short incident report (see `docs/INCIDENT_RESPONSE.md`).
