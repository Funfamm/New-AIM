# Error Monitoring (in-house)

Sentry-class error tracking with no third-party service. Admin UI at `/admin/errors`.

## Capture
Errors funnel into `captureError()` (`lib/monitoring/capture-error.ts`) from:
- **Server** render / route / action errors — `instrumentation.ts` `onRequestError` (Node runtime).
- **Client** uncaught errors + promise rejections — `components/client-error-reporter.tsx` → `POST /api/monitoring/client-error`.
- **Render boundary** errors — `app/error.tsx` beacon → same ingest route.

Capture is fire-and-forget and never throws. Each occurrence is **scrubbed** (`lib/monitoring/scrub.ts`: emails, JWTs, Bearer/Basic, AWS/Stripe/Google keys, `secret=…` assignments, sensitive JSON keys), then **normalized** (ids/numbers/uuids collapsed) and **fingerprinted** (SHA over level|source|route|message). New fingerprint → INSERT; repeat → INCREMENT `count` + refresh. A per-instance 10s throttle drops repeat writes during a storm.

## Grouping & history
- One `ErrorLog` row per fingerprint (the group). Similar errors aggregate.
- `error_event_buckets` — one row per (fingerprint, hour). Powers the 24h/7d sparklines (`lib/monitoring/buckets.ts`) and spike detection. **Never** a row per event.

## Triage workflow
`status`: `NEW → ACKNOWLEDGED → RESOLVED`, plus `IGNORED` / `MUTED` (snooze via `mutedUntil`). Actions in `app/admin/errors/error-actions.ts` (`requireAdmin()` + `writeAudit()`): resolve/reopen, `setErrorStatus`, `muteError`, `assignError`, `addErrorNote`. Notes live in `error_notes`.
- The legacy `resolved` boolean is **dual-written** alongside `status` and will be dropped in a later two-step migration once nothing reads it.
- A `RESOLVED` group that recurs is flagged **`regressed`**, reopened, and alerted. `IGNORED`/`MUTED` are not reopened.

## Release tagging
Every error tagged with `firstRelease`/`lastRelease` (`VERCEL_GIT_COMMIT_SHA` → `VERCEL_DEPLOYMENT_ID`) and `environment` (`VERCEL_ENV`) via `lib/monitoring/release.ts` — so you can see which deploy introduced or last saw an issue.

## Alerting (`lib/monitoring/alert.ts`)
DB-backed per-fingerprint dedupe (`lastAlertedAt`, atomic `updateMany`) — correct across all serverless instances. Three signals: **new**, **regression**, **spike** (hourly bucket ≥ `ERROR_SPIKE_PER_HOUR`). Delivery: email (to `ADMIN_ALERT_EMAIL` / admin-settings) + optional Slack-compatible webhook.

## Crons (`vercel.json`, Bearer `CRON_SECRET`)
- `GET /api/cron/error-digest` (09:00 UTC) — open totals, new-in-24h, regressions, top-by-volume → email. Skips when all-clear.
- `GET /api/cron/error-retention` (03:00 UTC) — deletes resolved/ignored groups older than `ERROR_RETENTION_DAYS` (30) and buckets older than `ERROR_BUCKET_RETENTION_DAYS` (90).

## Config (env, all optional)
| Var | Default | Purpose |
|---|---|---|
| `ERROR_SPIKE_PER_HOUR` | 50 | Hourly count that triggers a spike alert |
| `ERROR_ALERT_COOLDOWN_MIN` | 30 | Per-fingerprint alert dedupe window |
| `ERROR_ALERT_WEBHOOK_URL` | — | Slack-compatible webhook (no-op if unset) |
| `ERROR_RETENTION_DAYS` | 30 | Age to prune resolved/ignored groups |
| `ERROR_BUCKET_RETENTION_DAYS` | 90 | Age to prune occurrence buckets |

## UI
Light **neumorphic** theme (`app/admin/errors/errors-admin.css`) — a light soft-UI panel on the dark admin shell. List: status/level filters, source/time-range/sort, search, per-row 24h sparkline, copy. Detail (`/admin/errors/[id]`): triage toolbar, 24h+7d sparklines (inline SVG, no chart lib), stack/context, notes, copy report.
