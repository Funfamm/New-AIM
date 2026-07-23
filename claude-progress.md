# AIM Studio Lite — Claude Progress

Read this at the start of every session. Update it after every task.

---

## Platform Status: Production-ready core. Scaling safe.

---

## Completed

### Infrastructure
- Next.js 15 App Router, TypeScript strict, Tailwind v4, Prisma + Neon, Auth.js v5
- Vercel deployment, R2 CDN for media, Microsoft Graph for email
- CI pipeline: `.github/workflows/ci.yml` (lint + tsc + npm audit on every PR)
- Security headers: CSP, HSTS, X-Frame-Options, Permissions-Policy, Referrer-Policy (`next.config.ts`)
- Rate limiting: `lib/rate-limit.ts` — applied to comments (10/min) and notify-me signups (10/hr)
- Login rate limiting: `lib/security.ts` → `checkLoginThrottle` (DB-backed, configurable via AdminSettings)

### Auth & Users
- Credentials + Google OAuth login, JWT session with role (`USER`, `ADMIN`, `SUPER_ADMIN`)
- Password reset (code-based, 30-min expiry)
- Security events, login attempts, device tracking (`lib/security.ts`)
- Welcome email with magic-link auto-login

### Video & Works
- Works with type: FULL_FILM, SHORT_FILM, SERIES, EPISODE, TRAILER, COMMERCIAL, etc.
- HLS video playback (`lib/use-hls-video.ts`, R2 paths, CDN)
- Video player: skip intro, skip credits, playback speed, subtitles
- Episode player: up-next countdown, episode sidebar, season grouping
- Watch progress (saved every 10s, resume on return)
- Subtitles: upload, translation, VTT generation, `<track>` injection
- Preview clips, clip mode (clipStart/clipEnd params)

### Notify Me CTA
- Admin configures per-work CTA (type: RELEASE, MORE, POST_RELEASE)
- Smart gate: only fires on full film (if published) OR last episode OR trailer/preview if no full content yet
- `onEnded` fallback trigger in both players
- Guest email form + logged-in one-click confirm
- Signups stored, suppression checked, deduplication enforced

### Casting System
- Casting roles with requirements (gender, age, voice, score threshold)
- Application flow: submit → AI agent review → admin decision
- AI agent review: `lib/casting/casting-ai-client.ts` via OpenAI
- All 8 casting status emails with project poster image
- Admin decisions audited via `writeAudit()` → `AdminAuditLog`
- Agent review failures logged as `AGENT_REVIEW_FAILED` in audit log
- Admin can manually re-trigger review (`adminRetriggerReview`)

### Email System
- Transactional: Microsoft Graph (`lib/email.ts`)
- Bulk: ACS + Graph with queue (`lib/bulk-email.ts`, `EmailQueue` table)
- Email open tracking (1×1 pixel, `GET /api/email/open`)
- Email click tracking (wrapped links, `GET /api/email/click`, safe redirect)
- Email admin: queue (retry/cancel/bulk), suppression (bulk remove/delete), logs (bulk delete, clear-old), templates, test panel
- Engagement analytics: open rate %, CTR % in Logs tab and Overview tab
- Suppression list enforced on all outgoing

### Admin Dashboard
- Works CRUD, casting admin, email admin, user admin, outreach, analytics overview
- All admin Server Actions call `requireAdmin()` before any data access
- Admin audit log: user actions, casting decisions, system events (`lib/audit.ts`)

### Engineering Docs
- `docs/SOFTWARE_ENGINEERING.md` — master standard
- `docs/SECURITY_STANDARD.md`
- `docs/SCALING_STANDARD.md`
- `docs/DATABASE_SAFETY.md` (includes Neon PITR + pooler setup steps)
- `docs/DEPLOYMENT_CHECKLIST.md`
- `docs/INCIDENT_RESPONSE.md`
- `docs/AI_AGENT_SAFETY.md`
- `docs/TOKEN_SAVING_WORKFLOW.md`

---

## In Progress

_Nothing currently in progress._

---

## Next / Backlog

- Push notifications (users opt-in per work or category)
- Advanced analytics dashboard (retention, drop-off, funnel)
- Payment / subscription system (v2 — out of scope for v1)
- i18n / multilingual (out of scope for v1)
- Watch party (out of scope for v1)

---

## Admin dashboard resilience + env save never landed — 2026-07-23

A `work.count()` pool timeout (**still printing "connection limit: 5"**) crashed `GET /admin` for the admin. Two findings:

1. **The Jul-22 `DATABASE_URL` edit never saved** — `vercel env ls production` shows the var untouched for **47 days**. The pool params are NOT live; the error message printing "timeout: 10, connection limit: 5" is the proof (would read 15/10 if applied). User must redo the dashboard edit (fresh full pooled string + `&pgbouncer=true&connection_limit=10&pool_timeout=15&connect_timeout=15`, Production env) and confirm the var's "created/updated" age changes; then redeploy.
2. **Admin dashboard had zero guards** while fanning out ~30 concurrent queries across 4 loaders (getStats 10, getSystemHealth 17, getNeedsAttention 5, casting 9-with-try/catch) — the heaviest DB page in the app; one transient → whole overview crashed. Applied the homepage pattern in `app/admin/page.tsx`: `safe()` + `withDbRetry` per loader with typed zero/empty fallbacks (casting already degraded internally). A blip now renders a degraded dashboard instead of the digest-error crash.

`tsc` + lint clean.

## Dependency CVEs + audit-gate allowlist — 2026-07-23

CI's `npm audit --audit-level=high` went red (newly-disclosed advisories; the #160 fix made the audit step actually block). NOT introduced by our code. Two classes:
- **Auth.js `@auth/core` CRITICAL** (getToken exception, homoglyph @ bypass, OAuth state cookie binding) — runtime-relevant on an auth-heavy app. **Fixed** cleanly via `npm audit fix` (non-force): `next-auth` beta.31→beta.32, `@auth/core` 0.41.2→0.41.3, `@auth/prisma-adapter`→2.11.3, `jose`→6.2.4. 16-line lock diff; `tsc` clean.
- **PostCSS HIGH** (×2) — reachable only through Next's pinned transitive `postcss@8.4.31`; **build-time only** (postcss runs on our own CSS during `next build`, never runtime input → no runtime attack surface). Not fixable: `npm audit fix --force` wants next@9 (catastrophic), and npm `overrides` can't reach Next's pin.
- **Gate fix:** new `scripts/check-audit.mjs` — fails on any high/critical EXCEPT a documented, justified allowlist (the two postcss GHSAs). Strictly narrower than lowering `--audit-level` — new high/critical runtime vulns still fail CI (verified: fake critical → exit 1). CI `Security audit` step now runs `npm audit --json` → the checker. Remove the allowlist entries when Next bumps its postcss pin.

Process note: PR #171 was merged while this audit check was red (the red was these pre-existing dep CVEs, not #171's code — lint+tsc+Vercel were green). Now that the audit gate is real (#160), verify it green before merging.

## Auth surface hardening (rate limits + kill-switch) — 2026-07-23

Fixes from a multi-agent security audit of the auth/anti-abuse surface (both HIGH findings adversarially confirmed). Baseline was already strong (DB-backed login throttle, bcrypt-12, hashed rotating refresh tokens, tokenVersion revocation, enumeration-safe forgot responses, security headers). Closed the exploitable gaps:

- **New `lib/request-ip.ts`** — `getClientIp()` / `getClientIpHash()` (cf-connecting-ip → x-real-ip → leftmost XFF; SHA-256, raw IP never stored).
- **🔴 Password-reset takeover path** (`lib/actions/auth.ts`): `forgotPassword` now rate-limited per email (3/hr) + per IP (15/hr) BEFORE any DB/email work, with a **neutral redirect on limit** (invisible, preserves anti-enumeration) — kills reset-email bombing + reset-flow DoS. `verifyResetCode` + `resetPassword` (code flow only) rate-limited per IP + email (12 / 15min) to cap 6-digit-code spraying; `resetPassword` now **binds the code to the submitted email** (`record.email === email`); invalid/limited attempts write a `SecurityEvent` (was silent → now alertable).
- **🟠 Registration** (`registerUser`): per-IP limit (5/hr) on all paths + **server-side enforcement of `allowNewRegistrations`** for new accounts (the toggle previously only hid the nav link; `/register` still worked when "off").
- **🟠 Abuse surface**: `/api/analytics` now per-visitor rate-limited (120/min, cookie key) — closes write-DoS + metric poisoning. `contact` and `notify-cta` gained a per-IP key alongside the email key (the email key alone was bypassable by rotation).

Scope note: limiters use the existing in-memory `rateLimit()` (per-instance) — a large improvement + now-visible logging; DB-backed/Upstash + Turnstile-on-forms + the bot-cadence heuristic are the next tier (follow-up). Reset-email copy still says "30 min" vs actual 15 — minor, not fixed here.

`tsc --noEmit` clean; `npm run lint` exit 0.

## Media link checker (admin + daily cron) — 2026-07-23

Born from a real incident: LINE OF SIGHT's `videoUrl` pointed at a deleted R2 object (`…r2.dev/Trailers/LINE OF SIGHT.mp4` → 404, looks like a trailer URL pasted into the wrong field) and `trailerUrl` was empty — a viewer failed playback 15× ("The element has no supported sources") before anyone knew. Broken assets are now caught proactively:

- **`lib/media-check.ts`** — `checkAllWorkMediaLinks()`: HEAD-checks every public work's media URLs (playback: videoUrl/trailerUrl/previewClipUrl/teaserUrl; images: poster/hero/thumbnail), batched ×10, 5s timeout, GET+Range fallback for hosts rejecting HEAD; absolute http(s) URLs only; take 500.
- **`app/api/cron/media-link-check`** (daily 07:30, Bearer CRON_SECRET, registered in vercel.json) — reports broken **playback** links into the error monitor via `captureError` (stable message per work+field → one triageable group per asset, bell rings, regression detection reopens on re-break). Images summarized in the response only (fail soft). 2s settle before return so fire-and-forget writes survive function freeze.
- **`app/admin/works/media-check`** — on-demand live check page (broken-first table, brand-token CSS), linked from the Works header ("Check Media Links"). Reload = re-check.

Verified: check logic tested against good (200/ok), the actual broken R2 URL (404/flagged), and an unreachable host (null/flagged). `tsc` + lint clean.

**Content fix still needed (admin data, user):** repoint LINE OF SIGHT `videoUrl` to its processed HLS (`works/line-of-sight/hls/<jobId>/master.m3u8` — see the work's video-processing job) and restore/decide the trailer.

## DB incident CLOSED: pool params + Neon always-on applied — 2026-07-22

The two long-pending config knobs are now live (user applied; deploy verified):
- **Vercel `DATABASE_URL`** (Production) updated to the Neon `-pooler` host with `?sslmode=require&pgbouncer=true&connection_limit=10&pool_timeout=15&connect_timeout=15` (`channel_binding` removed — psql-only, unsupported over PgBouncer). Production redeployed via CLI (`vercel redeploy`, deploy `dpl_DBJtVmCR…` READY, aliased to impactaistudio.com; homepage + /works 200).
- **Neon primary compute: scale-to-zero DISABLED** ("remains active at all times") — ends the P1001 "Can't reach database server" cold starts. Compute supports 894 direct / 10k pooled connections, so `connection_limit=10` has huge headroom.

Combined with the code side (caching #159/#162/#166, degradation #163, retry #165, build-time DB independence #167), the connection-pool/cold-start error class is fully closed: ceiling raised, demand collapsed, failures contained. If "connection limit" or "can't reach" errors EVER reappear in the monitor, that is genuinely new information.

Note: Vercel production env values are team-policy write-only (`vercel env pull` returns empty values) — future env edits must go through the dashboard with a fresh value; tooling cannot read-modify-write them.

## Prod build failed on build-time DB prerender — 2026-07-22

The #166 production build FAILED (`PrismaClientKnownRequestError`, exit 1) while its identical preview build succeeded: during `next build` static generation, Next attempted to **prerender `/admin`**, whose dashboard queries (`visitorSession.count()`) hit the DB at build time — exactly when Neon was unreachable (P1001 cold start). Every prior build only succeeded because Neon happened to be awake mid-build. Site stayed up (failed deploy never promoted; prod kept serving #165).

- `app/admin/layout.tsx`: `export const dynamic = "force-dynamic"` — admin pages are per-request, auth-gated, DB-backed; never prerender them at build. Removes the DB from the admin build path entirely (and skips pointless build work).
- `app/sitemap.ts`: sitemap also renders at build — wrapped `getSitemapWorks()` in `withDbRetry` + degrade-to-static-routes on total failure (catch outside the cached loader) so a Neon blip can't fail the build.
- Residual (theoretical): other public pages' build-time prerender attempts run cached loaders unguarded (e.g. casting); their windows are tiny and the homepage/rows already degrade. Revisit only if a build ever flakes there.

`tsc --noEmit` clean; lint exit 0.

## Nav was the hidden per-page DB fan-out — 2026-07-22

The recurring `work.count()` pool timeout resurfaced on `GET /works/grandpas-diary` (release 64e5a77). Root cause finally pinned: **`components/nav-wrapper.tsx`** — rendered on **every public page** via the layout — ran an uncached `Promise.all` with `prisma.work.count()` at **index 1** (matching the stack: `Promise.all (index 1)`, shared chunk 2157.js). Every page view fired 2 uncached DB queries through the nav; that's why the error kept appearing on different routes and survived all page-level caching (earlier homepage analyses missed this shared-layout query).

- Cached both user-independent nav queries in the Data Cache: `getHasUpcoming` (`findFirst` existence check instead of `count()`, tag `works`, 300s) and `getAllowRegistrations` (new tag `public-settings`, 300s).
- Added `safeNav()` — thunk-based retry (`withDbRetry`) + degradation fallback, so a nav DB blip degrades one flag for one render instead of crashing every page (the nav lives in the layout). Catches OUTSIDE the cached fns; thunk so retries re-RUN the query, not re-await the same rejection.
- `unreadCount` stays live (per-user) with a `.catch(() => 0)`.
- `lib/cache-tags.ts`: added `publicSettings`; `saveSecuritySettings` (only writer of `allowNewRegistrations`) now fires `revalidateTag(publicSettings)`.

With this, ALL user-independent public-path queries are cached: pages + sitemap + nav. Env change (connection_limit=10 etc. + Neon autosuspend) still pending — see [[project_db_pooler_pending]].

`tsc --noEmit` clean; `npm run lint` exit 0.

## DB hardening: retry-with-backoff for Neon cold starts — 2026-07-12

Code-side hardening for the recurring `work.count()` pool timeout (#1) and "Can't reach database server" (#3). Grounded in a 2026 industry-practice research pass (Neon/Prisma/Vercel docs + Sentry): for this stack (Node runtime + Fluid Compute + singleton PrismaClient — all already in place) the Neon driver-adapter migration is **optional, not required**; the sanctioned fix is the tuned pooled connection string (user env) plus **retry-with-backoff** to ride out Neon scale-to-zero cold starts.

- New `lib/db-retry.ts` — `withDbRetry(op, {retries=2, baseMs=150})`: retries only TRANSIENT connection errors (`PrismaClientInitializationError`, and `P1001` can't-reach / `P1002` connect-timeout / `P2024` pool-acquire-timeout) with capped, **jittered** backoff. Bounded so it rides out a cold start without becoming a retry storm under real saturation; non-transient errors rethrow immediately.
- Wired at the homepage call sites: `safe(withDbRetry(() => getHomeWorks()), …)` and same for `getPublishedTypes` — **retry inside, degrade (safe) outside**, so a cold start serves the REAL page after a brief backoff and only degrades to empty-state if every retry fails. Same in the `getPublicContentRows` wrapper (protects `/works` too).
- `getPublishedTypes`: `work.count()` → `work.findFirst({select:{id}})` for the `hasUpcoming` boolean — stops at first row, cheaper on the hot path.

**STILL the primary fix (user, not code):** the pool `connection_limit` is still 5. Per research, size it to exceed the per-render fan-out (≈10, never 1) and add `connect_timeout=15&pool_timeout=15` on the already-`-pooler` `DATABASE_URL`; and raise Neon's autosuspend `suspend_timeout` (or disable scale-to-zero) rather than a keep-warm cron (which Neon's own guidance discourages). Retry reduces the cold-start errors; only more connections raises the ceiling. See [[project_db_pooler_pending]].

`tsc --noEmit` clean; `npm run lint` exit 0.

## Error monitor: filter extension / in-app-browser + non-Error noise — 2026-07-12

Two more benign client errors were reaching the monitor:
- **`[object Event]`** (`/reset-password`) — an `unhandledrejection` whose `reason` is a bare DOM `Event` (failed resource/media load, etc.); `String(Event)` → `"[object Event]"`, no message/stack, zero signal.
- **`Cannot assign to read only property 'pushState'`** (`/`) — a browser **extension / in-app browser** (IG/FB/TikTok webview) patched `window.history`. Not our code; unfixable from the app.

Added two patterns to `lib/monitoring/ignore.ts`: `/cannot assign to read only property '(pushState|replaceState)'/i` and `/^\[object \w+\]$/` (anchored so real messages like "[object Object] is not iterable" still report). Filtered at both the client reporter and the ingest route (same mechanism as the AbortError filter). This is standard error-monitor hygiene (Sentry-style ignoreErrors).

**DB pool errors (#1 work.count timeout, #3 "can't reach server") from the same batch are NOT in this PR** — the host is now the Neon `-pooler` but pool params were never added (`connection_limit` still 5), and Neon autosuspend causes cold-start "can't reach". Primary fix remains the `DATABASE_URL` params (user) + Neon autosuspend config; structural code fix (Neon serverless driver adapter to remove the pool entirely) tracked separately. See [[project_db_pooler_pending]].

## Jul 5-7 error batch: hydration #418 + homepage resilience — 2026-07-07

Three production errors from the monitor, diagnosed via multi-agent investigation.

**React #418 (hydration text mismatch) — same class as the earlier /admin/users fix:**
- `/admin/email` — three `"use client"` tables (`logs-table.tsx`, `queue-table.tsx`, `suppression-bulk.tsx`) had `fmtDate` using `Intl.DateTimeFormat` with hour/minute but **no `timeZone`** → server UTC vs client local. Added `timeZone: "UTC"` to each.
- `/admin/analytics/visitors` — `vi-feed.tsx` `timeAgo()` uses `Date.now()` (clock-dependent — can't fix with timeZone). Added a mount gate (`mounted` state + `useEffect`) + a deterministic `absTime()` (UTC) placeholder; render `{mounted ? timeAgo(x) : absTime(x)}` at all 3 sites so SSR/first-client render match, then swap to relative post-mount.

**Homepage render crash (`/` digest error) = downstream of the regressed pool timeout:** confirmed the `work.count()` pool-exhaustion throw on a Data-Cache **miss** (post-deploy / after `revalidateTag`) propagated out of the cached loader → unhandled in `HomePage`'s `Promise.all` → crashed the whole render (500/digest). Fix:
- `app/(public)/page.tsx` — added `safe(p, fallback, loader)` call-site guard around `getHomeWorks`/`getPublishedTypes`/`getContinueWatching`/`getSavedIds`; on a transient error it reports via `captureError` and returns a fallback so the render degrades to a valid 200 (existing empty-state) instead of crashing.
- `lib/curated-rows.ts` — same try/catch in the **exported** `getPublicContentRows` wrapper (protects homepage + `/works` + `hasPublicContentRows`).
- **Guardrail:** all catches live OUTSIDE the `unstable_cache` fns — a caught fallback inside would be cached for 300s. Kept the cached loaders throwing so nothing bad is ever cached; the fallback affects only the one failing render.

**STILL THE PRIMARY FIX (user action, not code):** the pool timeout regressed because the pooler `DATABASE_URL` env change was never applied. Point runtime `DATABASE_URL` at the Neon `-pooler` host + `?pgbouncer=true&connection_limit=10&pool_timeout=20&connect_timeout=15`. A single guest cache-miss render fans out to exactly 5 concurrent queries = the current `connection_limit=5`, so two coincident misses guarantee queueing. Caching + degradation reduce and contain it; only the env change raises the ceiling.

`tsc --noEmit` clean; `npm run lint` exit 0.

## Cache remaining crawler pages — 2026-07-04

Follow-up to the homepage/works pool-exhaustion fix — same `unstable_cache` + tag treatment for the other crawler-reachable pages that shared the flaw.

- **`/sitemap.xml`** (`app/sitemap.ts`): cached the published-works `findMany` (tag `works`, revalidate 1h) so bots polling the sitemap don't each open a DB connection.
- **`/casting` + `/casting/[slug]`**: new `casting` cache tag. Cached `getPublicCastingRoles` (list) and `getPublicCastingRole` (deduped across `generateMetadata` + page) at the call sites (they live in a `"use server"` file, so wrapped at the page, not in place). Wired `revalidateTag(CACHE_TAGS.casting)` into `casting.ts` role mutations (`adminCreateRole`/`adminUpdateRole`/`adminDeleteRole`) and `settings.ts` (`saveCastingSettings` + `saveFeatureSettings`, both write `showCasting`). Application-count staleness bounded by the 300s window (not worth invalidating on every submit).
- **`/watch/[slug]`** (`app/(public)/watch/[slug]/page.tsx`): cached the heavy `getWork(slug)` (nested episodes/parent/CTA) and deduped it with `generateMetadata` (tag `works`; added hero/thumb fields to the select for the OG image). **Access-control/redirects run against the live session in the page body, not the cached data** — safe. Per-user loaders (progress, saved, likes, subtitles, notify-signup, analytics) left live.

`tsc --noEmit` clean; `npm run lint` exit 0.

## Client error monitor: filter benign browser noise — 2026-07-04

A production CLIENT error "The operation was aborted." (AbortError) on `/watch/line-of-sight` was captured as a real error. It's benign — `AbortController` cancels in-flight fetch/media requests when the user navigates away or the HLS player tears down. `ClientErrorReporter` only filtered `"Script error."`, so this noise reached the monitor (with a misleading stack, since the ingest route wraps the message in a fresh `Error`).

- New `lib/monitoring/ignore.ts` — `isIgnorableClientError(message)` denylist (Sentry-style `ignoreErrors`): AbortError/"operation was aborted", media `play()`/fetch aborts, ResizeObserver loop, "Non-Error promise rejection", cross-origin "Script error.". Dependency-free so client + server share it.
- Filtered at two layers: `components/client-error-reporter.tsx` (skip the beacon) and `app/api/monitoring/client-error/route.ts` (defense-in-depth for stale clients).
- Existing single occurrence can be marked Ignored in the UI; future ones are auto-dropped.

`npm run lint` exit 0; `tsc --noEmit` clean.

## CI lint gate repaired — 2026-07-04

The "Lint, Type Check & Audit" CI check had been **red on every merge since #154**: CI runs `next lint`, but no `eslint`/`eslint-config-next` was installed and no config existed, so `next lint` dropped into interactive setup and exited 1 — killing the job before typecheck/audit even ran (the lint gate protected nothing).

- Added devDeps `eslint@^8.57.1` + `eslint-config-next@15.3.2`; new `.eslintrc.json` extends `next/core-web-vitals`.
- Fixed the 4 files with real lint **errors** (the many `<img>` items are warnings and don't fail the build): `react/no-unescaped-entities` in `admin/comments` + `notify-me-ctas/signups` (→ `&ldquo;`/`&rdquo;`); `@next/next/no-html-link-for-pages` in `notify-me-ctas` (`<a>` → `<Link>`); and a genuine **`react-hooks/rules-of-hooks`** latent bug in `components/admin/row-edit-form.tsx` — `useFormState` was called *after* an early `return null`; moved it above the guard.

`npm run lint` → exit 0; `tsc --noEmit` clean.

## Homepage connection-pool exhaustion fix — 2026-06-21

**Incident:** production `PrismaClientKnownRequestError` on `HEAD /` — "Timed out fetching a new connection from the connection pool (timeout: 10, connection limit: 5)" on `work.findMany()` + `work.count()`.

**Root cause:** the public homepage ran **5–7 parallel Prisma queries on every render** (including bot HEAD requests) with **no data caching** — the codebase only used `revalidatePath`, never `unstable_cache`. Against the default pool (limit 5 / 10s timeout), a bot/crawler burst during a Neon cold start exhausted the pool.

**Fix (primary — caching):**
- New `lib/cache-tags.ts` — central tag registry (`works`, `content-rows`).
- Wrapped the 3 user-independent loaders in `unstable_cache` (revalidate 300s): `getHomeWorks` + `getPublishedTypes` (`app/(public)/page.tsx`, tag `works`) and `getPublicContentRows` (`lib/curated-rows.ts`, tags `content-rows` + `works` since rows embed live Work fields). Per-user loaders (`getContinueWatching`, `getSavedIds`) stay live; `auth()` stays outside the cache.
- **`revalidatePath` does NOT clear `unstable_cache`** — added `revalidateTag` at every invalidation site: `works.ts` `revalidateAll()` → `works`; all 8 home-affecting `rows.ts` actions → `content-rows`; **worker HLS-completion route** (`app/api/worker/video-processing/[jobId]/complete/route.ts`) → `works` (this route wrote `videoUrl`/`trailerUrl` to a Work but previously revalidated nothing — latent stale-hero bug once cached).

**Fix (secondary — pool hardening, USER ACTION on Vercel):** point runtime `DATABASE_URL` at the Neon **-pooler** host and append `?pgbouncer=true&connection_limit=10&pool_timeout=20&connect_timeout=15`. Keep `DIRECT_DATABASE_URL` on the non-pooler host (migrations). `pgbouncer=true` required to avoid prepared-statement collisions; `connection_limit` must stay ≥ the per-render fan-out (never 1).

**Also cached same session:** `/works` — `getWorksHero` + `getWorks` (`app/(public)/works/page.tsx`, tag `works`; its curated rows were already covered by the shared loader). `/works/[slug]` — deduped the double work-by-slug fetch (`generateMetadata` + page each ran `work.findUnique`) into one cached `getWork(slug)` loader (tag `works`, superset select). Per-user/like-count queries left live.

**Still uncached (follow-up, pool hardening covers them):** `/casting` (2 queries — needs a `casting` tag + invalidation wiring in casting actions), `/watch/[slug]` (4 heavy, but auth/SERIES redirects shrink the cacheable surface), `/sitemap.xml` (1, polled often). `/works/[slug]` like-count still live (cheap indexed COUNT; caching it would need invalidation on every like/unlike).

`npx tsc --noEmit` clean.

## Audit Hardening — 2026-06-20

Full-platform audit fixes applied (see `docs/lite-hls-streaming-audit.md` §11–12 for streaming detail):

- **F-02 CSP** — `'unsafe-eval'` now dropped in production (dev-only). `next.config.ts`.
- **F-03 image hosts** — `next/image` `remotePatterns` changed from `**` wildcard to a closed allowlist derived from `R2_PUBLIC_BASE_URL` + `*.r2.dev`, `*.r2.cloudflarestorage.com`, `lh3.googleusercontent.com`. (Dev note: `scripts/seed-work.mjs` uses an Unsplash demo poster that is no longer whitelisted — seed posters should point at R2.)
- **F-04 worker secret** — `lib/worker-auth.ts` now uses `crypto.timingSafeEqual`.
- **F-05 Turnstile** — `app/api/subscribe/route.ts` now fails **closed** on siteverify network error.
- **F-06 PII logs** — removed `console.log` of user email/id from `lib/auth.ts`.
- **F-14 error pages** — added branded `app/not-found.tsx`; hardened `app/error.tsx` (no longer leaks raw `error.message`, adds Home link).

### REVERTED 2026-06-20 (broke video playback)

`crossOrigin="anonymous"` (F-07) requires R2 CORS to echo the app origin; CORS was not
configured, so it broke ALL video playback for guests and members. The whole playback
layer was reverted to the pre-audit state to restore working video:

- **F-01 playback gate — REMOVED.** `lib/playback-token.ts`, `lib/playback-url.ts`, the watch-page wiring, and `worker/playback-gate/` all deleted. Videos serve from the public CDN exactly as before. The Cloudflare Worker `aim-playback-gate` was deployed during testing — delete it from the CF dashboard (or `wrangler delete`) if not already removed.
- **F-07 crossOrigin — REVERTED** on all 3 players (the actual cause of the breakage).
- **F-08 HLS errors / `player-load-error` — REVERTED** (player files restored).
- **F-11 hls.js prefetch — REVERTED.**
- **F-13 CTA key scoping — REVERTED** (touched only the unused legacy players + overlay).
- **F-16 ABR doc — REVERTED** (streaming-audit doc restored to pre-audit version).

Still in place (not video-related): F-02 CSP, F-03 image hosts, F-04 worker secret, F-05 Turnstile, F-06 PII logs, F-14 error pages.

`npx tsc --noEmit` passes.

### Error Monitoring v2 — Phases 2 & 3 + light re-theme — 2026-06-20

Full reference: `docs/ERROR_MONITORING.md`. No new migration (Phase 1 added all the columns/tables).

Phase 2 (triage + discovery):
- `error-actions.ts`: `setErrorStatus`, `muteError`, `assignError`, `addErrorNote`; resolve/reopen now
  dual-write `status` (via `statusPatch`); `clearResolvedErrors` keys off `status=RESOLVED`; delete from
  detail redirects back to the list (`from=detail`). All `requireAdmin()` + `writeAudit()`.
- Detail page: triage toolbar (Acknowledge / Resolve|Reopen / Ignore / Mute-snooze 1h–30d), assign-to-me,
  notes thread (textarea + list from `error_notes`).
- List page: status filters (Open/Resolved/Muted/All — Open = NEW+ACKNOWLEDGED), level + source filters,
  time-range (24h/7d/30d), sort (recent/frequency/newest), and message/route **search** — all server-rendered
  via a GET form (no client JS). Stats now "Open" + "Fatal (open)".

Phase 3 (ops hardening):
- PII scrub `lib/monitoring/scrub.ts` wired into capture BEFORE fingerprinting (also improves grouping by
  collapsing per-user variants): emails, JWT, Bearer/Basic, AWS/Stripe/Google keys, `secret=…`, sensitive JSON keys.
- Crons (Bearer `CRON_SECRET`, registered in `vercel.json`): `error-digest` (09:00 UTC, skips all-clear) and
  `error-retention` (03:00 UTC; `ERROR_RETENTION_DAYS`=30 groups, `ERROR_BUCKET_RETENTION_DAYS`=90 buckets).
- Legacy `resolved` column **dropped** (two-step, done 2026-06-21): step 1 (74e957d) removed all
  reads/writes; step 2 migration `20260621040000_drop_error_resolved` drops the column + its index
  after step 1 was confirmed live in production. `resolvedAt`/`resolvedBy` retained.

UI: neumorphic, iterated on user feedback. Final = **cool-slate mid-dark** soft-UI panel
(`errors-admin.css`): base #2b3039, cool dual shadows (#21252c / #353c47), soft off-white text
(#ecedf3, not pure white — low eye strain), muted gold accent #e0c084. (History: started dark
near-black → user wanted light → light was too glaring → settled on cool slate "not too black".)
Uses non-token hexes — soft-UI needs custom shadow colors; explicitly requested.

`npx tsc --noEmit` passes.

### Error Monitoring v2 — Phase 1 (Sentry-class foundation) — 2026-06-20

Plan: `~/.claude/plans/jazzy-twirling-zebra.md` (3 phases; this is Phase 1). Industry-standard,
phased, additive. **Needs migration applied** — `prisma/migrations/20260620200000_error_monitoring_v2`
(build runs `prisma migrate deploy` before `next build`, so it self-applies on Vercel; do NOT ship
the code without the migration or capture silently no-ops on the missing `status` column).

Schema (`prisma/schema.prisma`): new `ErrorStatus` enum (NEW/ACKNOWLEDGED/RESOLVED/IGNORED/MUTED);
`ErrorLog` gains `status`, `firstRelease`/`lastRelease`/`environment`, `regressed`/`regressedAt`,
`lastAlertedAt`, `assignedToId`/`assignedToEmail`, `mutedUntil`, `notes[]`. New tables
`error_event_buckets` (hourly occurrence rollup — one row per fingerprint/hour, powers sparkline +
spike detection without row-per-event) and `error_notes` (Phase 2 triage). `resolved` boolean kept
and dual-written; dropped later (two-step). Migration backfills `status` from `resolved`.

Capture (`lib/monitoring/capture-error.ts`, new `lib/monitoring/release.ts` + `buckets.ts`):
tags every error with release (`VERCEL_GIT_COMMIT_SHA`/`VERCEL_DEPLOYMENT_ID`) + env (`VERCEL_ENV`);
**regression detection** (a RESOLVED group that recurs → `regressed`, reopened, alerted; IGNORED/MUTED
intentionally not reopened); upserts the hourly bucket and fires a **spike** alert at
`ERROR_SPIKE_PER_HOUR` (default 50).

Alerting (`lib/monitoring/alert.ts`): replaced leaky in-memory cooldown with **DB-backed per-fingerprint
dedupe** (`lastAlertedAt`, atomic `updateMany`, cross-instance safe); three signals (new/regression/spike);
optional **Slack-compatible webhook** via `ERROR_ALERT_WEBHOOK_URL` (no-op if unset). Cooldown
`ERROR_ALERT_COOLDOWN_MIN` (default 30).

UI: new **detail page** `app/admin/errors/[id]/page.tsx` (24h + 7d occurrence sparklines via inline SVG —
no chart lib; status/release/regressed, first/last seen, stack/context, copy report, resolve/reopen/delete);
list rows now link to detail + show 24h mini-sparkline (one batched `seriesBatch` query, take≤500),
release tag, regressed badge. Shared `format.ts` (timeAgo/fmtAbs/formatReport) + `sparkline.tsx`.

New env (all optional): `ERROR_SPIKE_PER_HOUR`, `ERROR_ALERT_COOLDOWN_MIN`, `ERROR_ALERT_WEBHOOK_URL`.
`npx tsc --noEmit` passes. (Local `next lint` has no eslint config installed → skipped; CI lints.)
**Phase 2** = triage workflow (status/ack/ignore/mute/assign/notes) + search/sort/time-range.
**Phase 3** = digest + retention crons + PII scrubbing + drop legacy `resolved`.

### Error Monitor UI upgrade — 2026-06-20

`/admin/errors` made more Sentry-like (backend grouping/fingerprint/count already existed).
New client component `app/admin/errors/copy-button.tsx` (clipboard with execCommand fallback).
`page.tsx`: per-error **Copy** button + **Copy all (N)** header button that put a clean
plain-text report (level, message, route, occurrences, first/last seen, fingerprint, stack,
metadata) on the clipboard for pasting into chat. Added a recurrence meta line under each
error (occurrence count, first-seen relative time, short fingerprint). CSS additions in
`errors-admin.css`. `npx tsc --noEmit` passes. No schema/data-model change.

### CSP regression fix — 2026-06-20

The F-02 CSP tightening broke the footer Turnstile widget: the checkbox disappeared and
"Join the list" stayed permanently disabled (button needs a Turnstile token). `script-src`
omitted `https://challenges.cloudflare.com` (so `api.js` never loaded → `window.turnstile`
undefined → widget never mounted) and `frame-src` was `'none'` (blocks the challenge iframe).
Fix in `next.config.ts`: added `https://challenges.cloudflare.com` to `script-src` (dev + prod)
and set `frame-src https://challenges.cloudflare.com`. `connect-src` already allowed it via
`https:`. `npx tsc --noEmit` passes.

---

## Error Monitoring (in-house) — 2026-06-20

Self-hosted error monitor (no Sentry). Built scalable: occurrences AGGREGATE by
`fingerprint` (one `error_logs` row per unique error group; repeats increment a
counter) + a per-instance storm throttle, so it can't flood the DB.

- Schema: `ErrorLog` model + `ErrorLevel`/`ErrorSource` enums; migration `20260620190000_add_error_logs` (additive, auto-applied by the `build` script's `prisma migrate deploy`).
- Capture: `lib/monitoring/capture-error.ts` (`captureError`, fire-and-forget, create-or-increment, normalizes message for grouping).
- Server errors: `instrumentation.ts` `onRequestError` (Next 15 hook — render/route/action).
- Client errors: `components/client-error-reporter.tsx` (window error + unhandledrejection) → `app/api/monitoring/client-error` (rate-limited); plus `app/error.tsx` boundary beacons render errors.
- Alerts: `lib/monitoring/alert.ts` emails admin on NEW critical groups (ADMIN_ALERT, throttled).
- Admin: `app/admin/errors` (filter by status/level, resolve/reopen/delete, clear-resolved, pagination) + sidebar link.
- Limitation vs Sentry: no client source-map de-minification, no perf tracing. Server stacks are readable.

## Known Gaps (open)

- **F-01 Playback access control — OPEN, reverted.** The token-gate approach broke playback (R2 CORS not configured for `crossOrigin`) and was removed. Films are served from public CDN URLs again — access is gated at the page, not the file. Any future attempt MUST first configure R2 CORS to allow the app origin, then verify trailer + full-film playback before touching `crossOrigin`/signing.
- Rate limiting is per-instance (in-memory). Works against burst abuse. Does not coordinate across Vercel instances. Upgrade path: Upstash Redis + `@upstash/ratelimit`.
- No end-to-end tests. TypeScript + lint + tsc are the only automated checks.
- CSP uses `'unsafe-inline'` for scripts (required by Next.js). Tighten with nonces when Next.js supports it cleanly.
- Neon PITR and pooler URL — must be configured manually in Neon dashboard and Vercel env vars. See `docs/DATABASE_SAFETY.md`.

---

## Key File Map (quick lookup)

| Area | Key files |
|---|---|
| Auth | `lib/auth.ts`, `lib/actions/auth.ts`, `lib/security.ts` |
| Email send | `lib/email.ts`, `lib/bulk-email.ts`, `lib/email-base.ts` |
| Email tracking | `lib/email-tracking.ts`, `app/api/email/open/`, `app/api/email/click/` |
| Email admin | `app/admin/email/`, `lib/actions/email-admin.ts` |
| Casting emails | `lib/casting/casting-emails.ts` |
| Casting actions | `lib/actions/casting.ts` |
| Casting AI | `lib/casting/casting-ai-client.ts` |
| Video player | `components/video-player.tsx`, `components/episode-player.tsx` |
| Notify Me CTA | `components/notify-cta-overlay.tsx`, `lib/actions/notify-cta.ts` |
| Watch page | `app/(public)/watch/[slug]/page.tsx` |
| Rate limiting | `lib/rate-limit.ts` |
| Audit log | `lib/audit.ts` |
| Admin audit | `lib/actions/users-admin.ts`, `lib/actions/casting.ts` |
| Schema | `prisma/schema.prisma` |
| Migrations | `prisma/migrations/` |
