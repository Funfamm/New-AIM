# AIM Studio Lite — Incident Response

## What Is an Incident

Any unplanned event that degrades or breaks a production service for users or admins, including:

- Site down or returning 500 errors
- Video playback failure
- Email sending stopped
- Login / registration broken
- Database connection failures
- Data loss or corruption
- Security breach or unauthorized access

## Severity Levels

| Level | Description | Response time |
|---|---|---|
| P1 — Critical | Site down, data loss, security breach, all users affected | Immediate |
| P2 — High | Core feature broken (video, login, email), many users affected | Within 1 hour |
| P3 — Medium | Non-critical feature degraded, workaround exists | Within 24 hours |
| P4 — Low | Minor bug, cosmetic issue, single user affected | Next sprint |

## Response Steps

### 1. Detect

- Check Vercel dashboard for failed deployments or function errors.
- Check Neon dashboard for database connection failures or high query latency.
- Check email queue in admin dashboard for stuck or failed jobs.
- Review Vercel runtime logs for error spikes.

### 2. Contain

- If caused by a bad deploy: revert the PR immediately (GitHub → PR → Revert). Vercel redeploys the previous build.
- If caused by a database issue: check connection pool health; restart pooler if needed; verify `DATABASE_URL` is correct.
- If caused by a third-party service (Graph, R2, ACS): check their status page; activate any fallback (e.g. DEV_LOG email fallback in dev).
- If a security breach is suspected: rotate all secrets immediately; invalidate sessions; notify affected users.

### 3. Diagnose

Answer these four questions:

1. **What failed?** — Which service, feature, or query?
2. **Who was affected?** — All users, logged-in users, admins, specific work/episode?
3. **When did it start?** — Check Vercel deploy timestamps vs. error spike time.
4. **What changed?** — Last deploy, migration, env var change, or third-party outage?

### 4. Fix

- Apply the minimum change needed to restore service.
- Do not add new features during an active incident.
- If the fix requires a migration, test it on a preview database first.
- Deploy, verify, and watch logs for 10 minutes before closing the incident.

### 5. Document

Every P1 and P2 incident must produce a short incident report:

```
Date: YYYY-MM-DD
Severity: P1 / P2
Duration: X hours Y minutes
What failed: [one sentence]
Who was affected: [scope]
Root cause: [one sentence]
Fix applied: [what was changed]
Prevention: [what will stop this from happening again]
```

Store incident reports in a Notion page, GitHub issue, or admin notes.

## Common Runbooks

### Site returning 500 errors

1. Check Vercel functions log for the specific error.
2. If it follows a deploy, revert the PR.
3. If database-related (`P1001`, `P2002`, connection timeout): check Neon dashboard.
4. If env var missing: check Vercel environment variables dashboard.

### Email queue stuck

1. Admin → Email → Queue tab: check for FAILED items.
2. Use bulk retry to re-queue failed items.
3. Check `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `GRAPH_EMAIL_SENDER` are set and valid.
4. If Graph token expired: credentials may need rotating in Azure portal.

### Video not playing

1. Check R2 bucket is accessible (visit the CDN URL directly in browser).
2. Check HLS manifest URL returns 200 with correct `Content-Type: application/vnd.apple.mpegurl`.
3. Check CORS headers on R2 allow the app origin.
4. Check the work's `videoUrl` field is set and points to the correct R2 path.

### Database connection failures

1. Check Neon project dashboard for outage or quota exceeded.
2. Verify `DATABASE_URL` in Vercel uses the connection pooler endpoint.
3. Check if connection pool is exhausted (too many concurrent serverless requests).
4. Restart the Neon pooler from the dashboard if needed.
