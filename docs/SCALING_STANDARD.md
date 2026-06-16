# AIM Studio Lite — Scaling Standard

## Architecture Philosophy

Start as a modular monolith. Keep the system simple and deployable as a single Next.js app on Vercel until there is measured, real scaling pressure. Do not pre-optimise for hypothetical scale.

Split a service into its own process only when:
- A specific service is measurably causing latency or resource contention for others.
- A queue or worker pattern would solve a known, observed bottleneck.
- The operational cost of splitting is lower than the cost of the problem.

## Public Layer (Performance Rules)

- Public pages must be fast. Use React Server Components and avoid unnecessary client-side hydration.
- Cache public content at the CDN layer where practical (Vercel Edge Cache).
- Images must use `next/image` with correct `sizes` and `quality` attributes. Never load full-resolution images on mobile.
- Video must not autoplay or preload on mobile unless the user explicitly requests playback.
- HLS streams must be served from R2/CDN, not proxied through the Next.js server.
- Avoid loading heavy client bundles on public pages — `"use client"` is expensive; keep it minimal.

## Background Jobs

All heavy, slow, or failure-prone work must be moved out of user-facing requests:

| Work type | Pattern |
|---|---|
| Email sending | Queue → worker (EmailQueue table + cron processor) |
| AI agent review | Fire-and-forget in Server Action; result written async |
| Video processing | External queue/worker; status tracked in DB |
| Subtitle generation | Queue + status table |
| Analytics ingestion | Beacon-and-forget; process async |

- Every queued job must have: status, createdAt, attempts, lastError, completedAt.
- Admin must be able to see, retry, and cancel stuck jobs.
- Failed jobs must alert (or surface in the admin dashboard) — silent failures are not acceptable.

## Database Scaling

- Use Neon connection pooling (PgBouncer) in serverless environments. Direct connections from serverless functions exhaust the connection limit.
- Queries that scan large tables must have a `take` or `LIMIT`. No unbounded queries in production.
- Add database indexes for every column used in `WHERE`, `ORDER BY`, or `JOIN` on hot paths.
- Use `select` in Prisma to fetch only the fields you need. Never `findMany` and discard columns.
- Aggregate queries (counts, sums) for admin dashboards must be cached or run on a read replica when they grow expensive.

## CDN & Media

- All public media (posters, thumbnails, hero images) must be served from R2 via the CDN URL — never from the Next.js origin.
- HLS manifests and segments must be served from R2. The player must point to CDN URLs, not origin URLs.
- Set correct `Cache-Control` headers on media responses. Immutable assets get long TTL; dynamic API responses get `no-store`.

## Service Split Triggers

These are the signals that indicate a service should be split:

- Email: queue depth consistently above 1,000 or processing latency above 30s → dedicated worker.
- AI review: agent calls blocking other work → dedicated queue with concurrency control.
- Video: transcoding jobs causing DB contention → dedicated processing service.
- Analytics: event ingestion affecting user-facing latency → separate ingest endpoint or third-party pipeline.

## What Not To Do

- Do not add microservices speculatively.
- Do not add Redis, message brokers, or external queues until the Postgres-backed queue is a measured bottleneck.
- Do not use server-side rendering for content that can be statically generated.
- Do not ship client bundles larger than 250KB (gzipped) for public pages without investigation.
