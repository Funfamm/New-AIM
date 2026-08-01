# AIM Studio Video Processor Worker

External Node.js worker that claims a `PENDING` `VideoProcessingJob` from the Next.js app,
downloads the private master video, transcodes it to HLS (1080p / 720p / 480p) using FFmpeg,
uploads the output to Cloudflare R2, and calls the app's `complete` endpoint so
`Work.videoUrl` is updated automatically.

This runs **outside** the Next.js/Vercel runtime. It must not be imported into any Next.js file.

---

## Prerequisites

- Node.js 18+
- FFmpeg installed and in PATH (`ffmpeg -version` should succeed)
- R2 credentials (same bucket as the app)
- `WORKER_SECRET` matching the value set on the app

## Setup

```bash
cd worker/video-processor
cp .env.example .env
# Fill in .env with your values (see section below)
npm install
```

## Environment variables (`.env`)

| Variable | Description |
|---|---|
| `APP_BASE_URL` | Base URL of the deployed Next.js app, e.g. `https://impactaistudio.com` |
| `WORKER_SECRET` | Shared secret — must match `WORKER_SECRET` in the app's env |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret |
| `R2_BUCKET_NAME` | R2 bucket name |
| `R2_PUBLIC_BASE_URL` | Public CDN URL for the bucket, e.g. `https://pub-xxx.r2.dev` |

Use `http://localhost:3000` for `APP_BASE_URL` when testing against the local dev server.

## Commands

```bash
# Run once (claim one PENDING job and process it)
npm run process-once

# Build TypeScript to dist/
npm run build

# Run built output
npm run process-once:built
```

## Output structure

For a job with `outputPrefix = works/{slug}/hls/{jobId}`, the worker uploads:

```
works/{slug}/hls/{jobId}/master.m3u8          ← public HLS entry point
works/{slug}/hls/{jobId}/1080p/index.m3u8
works/{slug}/hls/{jobId}/1080p/seg_0000.ts
works/{slug}/hls/{jobId}/720p/index.m3u8
works/{slug}/hls/{jobId}/720p/seg_0000.ts
works/{slug}/hls/{jobId}/480p/index.m3u8
works/{slug}/hls/{jobId}/480p/seg_0000.ts
```

The `complete` endpoint is called with the public master.m3u8 URL, which the app stores as
`Work.videoUrl` and the player reads.

## Transcode settings

| Variant | Resolution | CRF | Max bitrate |
|---|---|---|---|
| 1080p | 1920×1080 | 20 | 5350 kbps |
| 720p | 1280×720 | 22 | 2996 kbps |
| 480p | 854×480 | 24 | 1284 kbps |

Audio: AAC 128 kbps stereo. Segments: 6s VOD with independent keyframes.

## Progress reported to app

| Value | Event |
|---|---|
| 10 | Job claimed |
| 20 | Master downloaded |
| 40 | FFmpeg started |
| 40–70 | FFmpeg encoding (proportional) |
| 70 | FFmpeg complete |
| 85 | R2 upload started |
| 95 | R2 upload complete |
| 100 | Set by complete endpoint |

## Error handling

If any step fails the worker calls the `fail` endpoint with a safe summary of the error,
then exits with code 1. `Work.videoUrl` and `masterVideoKey` are never cleared on failure.

## Phase 3B only — not yet automated

This worker is one-shot MVP only. Future phases will add:
- Scheduled polling / daemon mode
- Render or Hetzner deployment
- Admin reprocess button
- Multi-worker scaling
