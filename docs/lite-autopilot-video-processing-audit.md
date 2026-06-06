# AIM Studio Lite — Autopilot Video Processing Audit

**Date:** 2026-06-06
**Status:** Audit only. No code changes. No database commands.

---

## 1. Current Video Upload / HLS Status

### What exists today

| Component | Current state |
|-----------|--------------|
| Presigned upload | `/api/admin/r2/upload/presign` — single-file PUT |
| Multipart upload | `/api/admin/r2/upload/multipart/{init,sign-part,complete}` — chunked for large files |
| Upload destination | `projects/{slug}/{category}/{category}-{timestamp}-{uuid}.ext` — **all public bucket** |
| Private storage | **None** — no private master path exists yet |
| HLS support | Manual only: admin runs FFmpeg locally, uploads with AWS CLI / upload script, pastes `master.m3u8` URL manually |
| Processing job table | **None** |
| Processing status on Work | **None** — `Work.status` is publication state (`DRAFT`/`PUBLISHED`), not video state |
| Worker / queue | **None** |
| R2 GetObject presigned URL | **Not implemented** — r2Client only has PutObject presign; worker download would need this |
| Webhook / callback endpoint | **None** |

### What the current R2 client can do

`lib/r2Client.ts` exports: `getS3Client`, `getPresignedUrl` (PutObject), `getPublicUrl`, `initMultipartUpload`, `getPartPresignedUrl`, `completeMultipartUpload`, `abortMultipartUpload`.

Missing for autopilot: `getDownloadPresignedUrl` (GetObject — needed so the worker can securely download the private master file).

---

## 2. Why Vercel Must Not Run FFmpeg

Vercel Serverless Functions have hard limits:

| Limit | Value |
|-------|-------|
| Max execution time (Pro) | 60 seconds |
| Max execution time (Hobby) | 10 seconds |
| Max response payload | 4.5 MB |
| Filesystem | Read-only (except `/tmp`) |
| `/tmp` size | 512 MB |
| FFmpeg binary | Cannot be bundled in Next.js app router |

A 4:42 4K film transcoded to 3 HLS resolutions takes ~15–25 minutes on a modern CPU. Vercel cannot run this.

**Vercel's role is coordination only:**
1. Authenticate admin
2. Generate signed upload URL for master → private R2
3. Create a `VideoProcessingJob` row (`PENDING`)
4. Serve job status to admin UI
5. Receive worker callback and save final HLS URL to `Work.videoUrl`

---

## 3. Option A — Managed Video Platform (Cloudflare Stream / Mux)

### Cloudflare Stream

- Upload via direct upload URL or tus protocol
- Cloudflare handles transcoding, HLS delivery, thumbnails, captions
- Pricing: ~$5/1000 min stored + $1/1000 min delivered
- For a 4:42 film: ~$0.023/month storage + delivery costs per view

**Pros:**
- Zero engineering for transcoding/HLS
- Built-in adaptive bitrate
- Cloudflare CDN included

**Cons:**
- Videos live on Cloudflare Stream, not in your R2 bucket — breaks current file structure
- `videoUrl` would become a Stream embed URL, not a direct `.m3u8` from your R2
- Player integration changes — Stream uses its own embed or HLS URL format
- Less control over quality ladder, segment length, bitrate targets
- Cannot reuse current upload script / HLS workflow for existing content
- Another platform cost and vendor dependency

### Mux

- Similar to Cloudflare Stream with richer analytics and per-title encoding
- Higher cost (~$0.015/min video stored + $0.0135/min video delivered on top tier)
- Better for large content libraries with detailed analytics

**Verdict on Option A:** Not recommended for AIM Studio Lite. The existing R2 structure, custom HLS workflow, and direct-to-R2 player architecture would all require restructuring. Cost adds up as the library grows.

---

## 4. Option B — Custom R2 + FFmpeg Worker (Recommended)

### Architecture overview

```
Admin uploads master → R2 private/masters/...
      ↓
App creates VideoProcessingJob row (PENDING)
      ↓
Worker polls /api/admin/video-processing/jobs/next
      ↓
Worker downloads master via presigned GetObject URL
      ↓
Worker runs FFmpeg (3-resolution HLS)
      ↓
Worker uploads HLS to R2 works/{slug}/hls/{jobId}/
      ↓
Worker POSTs completion to /api/admin/video-processing/jobs/{id}/complete
      ↓
App sets job READY, updates Work.videoUrl = master.m3u8 public URL
```

**Pros:**
- Full control over quality ladder, segment length, content types
- Uses existing R2 bucket and HLS player — no structural changes
- Worker can be a single Node.js/Docker process on a cheap VPS
- No extra video platform cost — only worker hosting
- Manual workflow (paste URL) can coexist as fallback

**Cons:**
- More engineering surface area
- Need to handle job retries, timeouts, crashes
- Need to host and maintain a worker process

---

## 5. Recommended Architecture

**Option B with polling-based queue (MVP), R2 events deferred to later.**

### Why polling over R2 events for MVP

R2 event notifications require configuring Cloudflare queues (Workers Queue / R2 Bucket Notifications). This adds another system to configure and debug. For a single-worker MVP with a small upload volume (a few films), polling every 10–30 seconds is sufficient and much simpler to reason about.

Add R2 event notifications later if upload volume grows.

### Worker host recommendation

| Platform | Fit | Cost |
|----------|-----|------|
| **Render (Background Worker)** | Best for MVP — simple Node.js service, no idle billing, free tier available | Free (limited) / ~$7/mo |
| Railway | Similar to Render, easy deploy from GitHub | ~$5/mo |
| Fly.io | Good for bursting machines (pay per CPU) | ~$3–10/mo depending on usage |
| AWS ECS/Fargate | More complex, better for high volume | ~$10–30/mo |
| Dedicated VPS (Hetzner/DO) | Most control, fixed cost | ~$5–10/mo |

**Recommended for MVP:** Render background worker or a $5/mo Hetzner VPS — both run Node.js with FFmpeg, both can use the existing `@aws-sdk/client-s3` package.

---

## 6. Required Schema Changes

Two options:

### Option 6A — Separate job table (recommended)

New model `VideoProcessingJob`:

```prisma
model VideoProcessingJob {
  id            String   @id @default(cuid())
  workId        String
  work          Work     @relation(fields: [workId], references: [id], onDelete: Cascade)

  // Source
  sourceKey     String   // R2 key: private/masters/{slug}/master-{timestamp}.mp4
  sourceSize    BigInt?  // bytes, for display

  // Output
  outputPrefix  String?  // R2 prefix: works/{slug}/hls/{jobId}
  hlsUrl        String?  // final public master.m3u8 URL

  // State
  status        VideoJobStatus @default(PENDING)
  progress      Int?           // 0–100 if worker reports it
  errorMessage  String?

  // Timestamps
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  startedAt     DateTime?
  completedAt   DateTime?

  @@index([status])
  @@index([workId])
  @@map("video_processing_jobs")
}

enum VideoJobStatus {
  PENDING
  PROCESSING
  READY
  FAILED
}
```

Add to `Work`:

```prisma
  masterVideoKey     String?  // private R2 key of the original master file
  videoProcessingJobs VideoProcessingJob[]
```

Note: `Work.videoUrl` is already the field that gets updated to the final HLS URL when the job completes — no new field needed on Work for the output URL.

### Option 6B — Status fields on Work only (simpler, less flexible)

Add to `Work`:

```prisma
  masterVideoKey  String?
  videoJobStatus  VideoJobStatus?
  videoJobError   String?
```

**Recommendation:** Option 6A (separate job table). It allows multiple reprocess attempts, error history, and worker polling without touching the Work record on every progress tick.

---

## 7. Required Worker Hosting

The worker is a standalone Node.js process (or Docker container):

- **Runtime:** Node.js 20+ (uses `@aws-sdk/client-s3`, `fluent-ffmpeg` or `execa` for FFmpeg subprocess)
- **FFmpeg:** Must be installed on the worker host (available via `apt-get install ffmpeg` or as a binary)
- **Env vars needed on worker:**
  - `R2_ACCOUNT_ID`
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
  - `R2_BUCKET_NAME`
  - `R2_PUBLIC_BASE_URL`
  - `APP_BASE_URL` (the Next.js app URL, for job polling and callback)
  - `WORKER_SECRET` (shared secret for authenticating worker → app API calls)
- **Poll interval:** Every 15–30 seconds (low volume; no real-time needed)
- **Concurrency:** 1 job at a time per worker instance (FFmpeg is CPU-intensive)

---

## 8. Required API Routes

New routes needed in the Next.js app:

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/admin/video-processing/jobs` | POST | Admin session | Create job after master upload |
| `/api/admin/video-processing/jobs/next` | GET | Worker secret | Worker polls for next PENDING job |
| `/api/admin/video-processing/jobs/[id]/start` | POST | Worker secret | Worker claims job → sets PROCESSING |
| `/api/admin/video-processing/jobs/[id]/complete` | POST | Worker secret | Worker reports success → sets READY, updates Work.videoUrl |
| `/api/admin/video-processing/jobs/[id]/fail` | POST | Worker secret | Worker reports failure → sets FAILED, saves errorMessage |
| `/api/admin/video-processing/jobs/[id]` | GET | Admin session | Admin polls job status for UI |

Worker authentication: a `WORKER_SECRET` env var — the worker sends it in an `Authorization: Bearer {secret}` header. The app verifies it. This is simpler than JWT for a single trusted worker.

Also needed in `lib/r2Client.ts`:

```ts
export async function getDownloadPresignedUrl(key: string, expiresIn = 3600): Promise<string>
// Uses GetObjectCommand — lets worker securely download the private master
```

---

## 9. Required Admin UI Changes

Changes to `components/admin/work-form.tsx` (and related admin work pages):

1. **Master Video Upload section** — separate from the existing Video URL field
   - Upload button targeting new private path
   - Progress bar during upload
   - Shows filename + size after upload
   - Triggers job creation on upload complete

2. **Processing Status indicator** — shows current `VideoProcessingJob.status`:
   - `PENDING` — "Queued for processing…"
   - `PROCESSING` — "Processing… (progress % if available)"
   - `READY` — "Ready" + green indicator
   - `FAILED` — "Failed" + error message + Reprocess button

3. **Reprocess button** — creates a new job from the existing `masterVideoKey`

4. **Manual HLS URL field** — keep as-is, used when admin bypasses autopilot or worker is down

5. **Status polling** — admin page polls `/api/admin/video-processing/jobs/{id}` every 10s while status is PENDING or PROCESSING

Manual URL fallback must remain — do not remove.

---

## 10. Required R2 Storage Paths

| Path | Visibility | Purpose |
|------|-----------|---------|
| `private/masters/{slug}/master-{timestamp}.mp4` | **Private** (no public URL) | Master source file |
| `works/{slug}/hls/{jobId}/master.m3u8` | Public | Top-level HLS playlist |
| `works/{slug}/hls/{jobId}/{res}/index.m3u8` | Public | Per-resolution playlist |
| `works/{slug}/hls/{jobId}/{res}/seg_{n}.ts` | Public | Segments |

The `{jobId}` in the HLS path prevents old streams from being overwritten if a reprocess is triggered.

**R2 bucket public access** should remain on `works/**` and `projects/**` only. The `private/**` prefix must never be exposed via the public R2 URL.

> **Important:** Cloudflare R2 public access is configured at the bucket/domain level. Since AIM Studio Lite uses a single bucket, `private/masters/` is technically reachable if someone guesses the path. For true access control, either:
> - Use a separate private bucket (clean but requires separate R2 credentials context)
> - Use R2 object-level signed URLs only (never expose via public domain)
>
> MVP recommendation: keep one bucket, never generate a `getPublicUrl` call for `private/**` keys. Worker accesses master via presigned `GetObjectCommand` only.

---

## 11. Security Concerns

| Concern | Mitigation |
|---------|-----------|
| Master file exposed publicly | Never call `getPublicUrl` on `private/**` keys; worker uses `GetObjectCommand` presigned URL only |
| Worker calling app APIs without auth | `WORKER_SECRET` header validated on all `/api/admin/video-processing/jobs/*/...` routes |
| Admin triggering unlimited reprocessing | Rate-limit job creation: max 1 PENDING or PROCESSING job per workId at a time |
| R2 credentials in worker env | Keep credentials in worker environment variables, never in the codebase or git |
| Arbitrary file upload to private path | Presign route must validate `targetField === 'masterVideo'` and restrict MIME to `video/mp4`, `video/quicktime`, `video/webm` |
| Worker downloading wrong key | Job row stores the exact `sourceKey`; worker trusts DB, not query params |

---

## 12. Cost Concerns

| Item | Estimate |
|------|----------|
| Worker hosting (Render free tier) | Free (limited to 750h/mo, sleeps after inactivity — OK for low volume) |
| Worker hosting (Render paid / Hetzner) | ~$7–10/mo |
| R2 storage: master files | ~$0.015/GB/mo — one 1GB master ≈ $0.015/mo |
| R2 storage: HLS outputs | 3 resolutions × ~200MB per film ≈ 600MB/film ≈ $0.009/film/mo |
| R2 egress | Free (Cloudflare R2 has no egress fees) |
| Cloudflare Stream (Option A) | ~$5/1000 min stored + delivery — more expensive at scale |
| Mux (Option A) | More expensive still |

**Bottom line:** Custom worker (Option B) is cheaper at low-to-medium library sizes and gives full control.

---

## 13. Failure / Retry Strategy

| Scenario | Handling |
|----------|---------|
| Worker crashes mid-transcode | Job stays `PROCESSING`; watchdog resets to `PENDING` after N minutes (configurable timeout) |
| FFmpeg fails (corrupt source) | Worker calls `/fail` with `errorMessage`; admin sees failure + can reprocess |
| R2 upload fails | Worker retries individual segment uploads up to 3 times; calls `/fail` if all retries exhausted |
| Worker never picks up job | Admin can see `PENDING` status for > X minutes and trigger manual reprocess |
| Network partition | Worker's HTTP call to app `/complete` retries with exponential backoff |
| Duplicate completion (race) | App's `/complete` route is idempotent — if job already `READY`, return 200 without overwriting |

Watchdog can run as a Vercel cron: `GET /api/cron/video-job-watchdog` — resets stale `PROCESSING` jobs to `PENDING` if `startedAt` > 30 minutes ago. This reuses the existing cron infrastructure.

---

## 14. Implementation Phases

### Phase 1 — Schema + storage paths (no UI change)

1. Add `VideoProcessingJob` model and `VideoJobStatus` enum to schema
2. Add `masterVideoKey` to `Work` model
3. Run migration
4. Add `getDownloadPresignedUrl` to `lib/r2Client.ts`
5. Add `private/masters` upload flow to presign + multipart routes (new `targetField: 'masterVideo'`)

### Phase 2 — Job API (no worker yet)

1. `POST /api/admin/video-processing/jobs` — create job
2. `GET /api/admin/video-processing/jobs/next` — worker polling endpoint
3. `POST /api/admin/video-processing/jobs/[id]/start`
4. `POST /api/admin/video-processing/jobs/[id]/complete`
5. `POST /api/admin/video-processing/jobs/[id]/fail`
6. `GET /api/admin/video-processing/jobs/[id]`
7. Watchdog cron route

### Phase 3 — Worker

1. Standalone Node.js service (separate repo or `worker/` folder)
2. Poll loop → FFmpeg transcode → R2 upload → callback
3. Deploy to Render or Hetzner

### Phase 4 — Admin UI

1. Master Video upload section in `work-form.tsx`
2. Processing status display
3. Reprocess button
4. Status polling

### Phase 5 — R2 event notifications (optional)

Replace polling with event-driven queue for lower latency and reduced DB load.

---

## 15. Files Likely to Touch

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `VideoProcessingJob`, `VideoJobStatus`, `Work.masterVideoKey` |
| `prisma/migrations/` | New migration file |
| `lib/r2Client.ts` | Add `getDownloadPresignedUrl` |
| `app/api/admin/r2/upload/presign/route.ts` | Add `masterVideo` target field + `private/masters/` path |
| `app/api/admin/r2/upload/multipart/init/route.ts` | Same — `masterVideo` target |
| `app/api/admin/video-processing/jobs/route.ts` | New — POST create job |
| `app/api/admin/video-processing/jobs/next/route.ts` | New — GET next pending |
| `app/api/admin/video-processing/jobs/[id]/route.ts` | New — GET status |
| `app/api/admin/video-processing/jobs/[id]/start/route.ts` | New — POST claim |
| `app/api/admin/video-processing/jobs/[id]/complete/route.ts` | New — POST success |
| `app/api/admin/video-processing/jobs/[id]/fail/route.ts` | New — POST failure |
| `app/api/cron/video-job-watchdog/route.ts` | New — stale job reset |
| `components/admin/work-form.tsx` | Master upload + status UI |
| `worker/index.mjs` (new service) | Standalone polling + FFmpeg worker |

---

## 16. No Code Changes Made

Confirmed. This document is audit only.

---

## 17. No Database Commands Run

Confirmed. No `db:push`, no `db:migrate`, no `db:generate`.
