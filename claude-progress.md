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

## Audit Hardening — 2026-06-20

Full-platform audit fixes applied (see `docs/lite-hls-streaming-audit.md` §11–12 for streaming detail):

- **F-02 CSP** — `'unsafe-eval'` now dropped in production (dev-only). `next.config.ts`.
- **F-03 image hosts** — `next/image` `remotePatterns` changed from `**` wildcard to a closed allowlist derived from `R2_PUBLIC_BASE_URL` + `*.r2.dev`, `*.r2.cloudflarestorage.com`, `lh3.googleusercontent.com`. (Dev note: `scripts/seed-work.mjs` uses an Unsplash demo poster that is no longer whitelisted — seed posters should point at R2.)
- **F-04 worker secret** — `lib/worker-auth.ts` now uses `crypto.timingSafeEqual`.
- **F-05 Turnstile** — `app/api/subscribe/route.ts` now fails **closed** on siteverify network error.
- **F-06 PII logs** — removed `console.log` of user email/id from `lib/auth.ts`.
- **F-07 crossOrigin** — `crossOrigin="anonymous"` on all `<video>` (aim/episode/video players). **Depends on R2 CORS being live** (see streaming audit §6/§11.1).
- **F-08 HLS errors** — `lib/use-hls-video.ts` retries recoverable errors, surfaces fatal via new `components/player-load-error.tsx` overlay wired into all 3 players.
- **F-11 prefetch** — hls.js dynamic import marked `webpackPrefetch`.
- **F-13 CTA key** — `ctaSignedKey()` helper scopes the notify-CTA localStorage key per user email.
- **F-14 error pages** — added branded `app/not-found.tsx`; hardened `app/error.tsx` (no longer leaks raw `error.message`, adds Home link).
- **F-16 ABR** — multi-bitrate HLS ladder requirement documented (streaming audit §11.4).
- **F-01 (CODE-COMPLETE, pending deploy)** — playback gate built. App signs a short-lived path-scoped token (`lib/playback-token.ts`) and rewrites the full-film `src` through `lib/playback-url.ts` when a work has `requiresAuth` + the gate env vars are set; otherwise serves the public URL unchanged (inert, zero behaviour change). Cloudflare Worker in `worker/playback-gate/` validates the token, serves from R2, and propagates the token onto HLS child playlists. Token-in-URL design runs on free `*.workers.dev` (no DNS change). To activate: deploy the Worker, set `PLAYBACK_GATE_BASE_URL` + `PLAYBACK_SIGNING_KEY` on Vercel + Worker. Plan: `docs/lite-playback-gate-plan.md`; deploy steps: `worker/playback-gate/README.md`.

`npx tsc --noEmit` passes (app and Worker).

---

## Known Gaps (open)

- **F-01 Playback access control — code-complete, NOT yet activated.** Gate is built and inert; full films on `requiresAuth` works will only be deliverable to signed-in members once the Cloudflare Worker (`worker/playback-gate/`) is deployed and `PLAYBACK_GATE_BASE_URL` + `PLAYBACK_SIGNING_KEY` are set on Vercel. Until then, films still serve from the public CDN (current behaviour). Deploy steps: `worker/playback-gate/README.md`.
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
