# AIM Studio Lite — HLS Streaming Audit

**Date:** 2026-06-06  
**Status:** Audit complete. No code changes made. No database commands run.  
**Goal:** Prepare the platform to stream large films (≈947 MB source) smoothly on 4G/5G using HLS adaptive streaming.

---

## Summary table

| # | Audit item | Finding |
|---|------------|---------|
| 1 | Current player component | Native `<video>` only — 4 components |
| 2 | Player supports `.m3u8` | **No** — will fail silently in Chrome/Edge |
| 3 | Safari native HLS | **Yes** — Safari supports HLS natively; no library needed |
| 4 | `hls.js` installed | **No** — zero video libraries in package.json |
| 5 | Existing fields can store `.m3u8` URL | **Yes** — all URL fields are `String?` with no format constraint |
| 6 | Admin URL fields accept `.m3u8` | **Yes** — no pattern validation; HTML5 `type="url"` only |
| 7 | R2 upload supports HLS files | **Partial** — presign rejects `.m3u8` MIME type; multipart init does not validate |
| 8 | R2 content types correct | **No** — `.m3u8` and `.ts` not in allowed MIME list; must be added |
| 9 | R2/CORS configured for HLS | **Unknown** — no CORS config in code; must verify at Cloudflare R2 bucket level |
| 10 | Player changes needed | **Yes** — add `hls.js` with native fallback |
| 11 | Schema change needed | **No** — existing `videoUrl: String?` is sufficient |
| 12 | Code changes made | None |
| 13 | Database commands run | None |

---

## 1. Player components

### Files

| File | Used on |
|------|---------|
| `components/aim-player.tsx` | Watch page — primary film/trailer player |
| `components/episode-player.tsx` | Episode watch page |
| `components/video-player.tsx` | Appears in codebase; not used on main watch page |
| `components/series-trailer-player.tsx` | Series detail page trailer |

### What they do

All four use a bare `<video ref={videoRef} src={src} ...>` element. No media source extensions (MSE), no `canPlayType()` check, no HLS library. The `src` prop is passed directly as the `src` attribute.

**Consequence:** Pasting a `.m3u8` URL will produce a black screen or stalled load in Chrome and Edge. Safari loads it natively and would work today.

### Watch page URL flow

`app/(public)/watch/[slug]/page.tsx` determines which URL to use:

```
videoUrl (full film) OR trailerUrl (preview)
  → isYouTube / isVimeo check → embed iframe
  → otherwise → <AimPlayer src={videoUrl} />
```

`.m3u8` URLs are not embed URLs, so they pass straight to `AimPlayer`. The player then fails because it has no HLS handler.

---

## 2. HLS library

`package.json` has **no video libraries of any kind** — no hls.js, video.js, plyr, react-player, shaka-player, or dash.js.

`hls.js` will need to be added and loaded dynamically inside `aim-player.tsx` (and `episode-player.tsx`).

---

## 3. URL fields and schema

Prisma schema (`prisma/schema.prisma`):

```prisma
trailerUrl     String?   // short or full film trailer
previewClipUrl String?   // sample clip when no trailer
videoUrl       String?   // main film/episode/commercial video
teaserUrl      String?   // second video for commercials
```

All are `String?` — no length limit, no pattern constraint. A URL like:

```
https://pub-xxx.r2.dev/works/no-mans-land/hls/master.m3u8
```

stores and retrieves without issue. **No schema change needed.**

---

## 4. Admin form URL fields

`components/admin/work-form.tsx`:

| Field | Input type | Current placeholder |
|-------|-----------|---------------------|
| `trailerUrl` | `type="url"` | "YouTube, Vimeo, or .mp4 URL" |
| `previewClipUrl` | `type="url"` | "YouTube, Vimeo, or .mp4 URL" |
| `videoUrl` | `type="url"` | "YouTube, Vimeo, or .mp4 URL" |
| `teaserUrl` | `type="url"` | "Short teaser video URL" |

HTML5 `type="url"` accepts any valid URL including `.m3u8`. No `pattern` attribute is set. No backend validation in the Server Action rejects `.m3u8`. The database will save the URL as-is.

**Minor change needed when approved:** Update placeholder text to mention `.m3u8` so admin knows HLS URLs are valid.

---

## 5. R2 upload system

### Presign route (`app/api/admin/r2/upload/presign/route.ts`)

`ALLOWED_MIME_TYPES` for video fields:

```ts
trailerUrl:     ['video/mp4', 'video/webm', 'video/quicktime'],
previewClipUrl: ['video/mp4', 'video/webm', 'video/quicktime'],
videoUrl:       ['video/mp4', 'video/webm', 'video/quicktime'],
teaserUrl:      ['video/mp4', 'video/webm', 'video/quicktime'],
```

`application/vnd.apple.mpegurl` (`.m3u8`) and `video/mp2t` (`.ts`) are **not present**. Uploading an HLS manifest via the presign route would be rejected with `400 Invalid content type`.

### Multipart init route (`app/api/admin/r2/upload/multipart/init/route.ts`)

**No MIME type validation.** The route accepts `contentType` from the request body and passes it directly to `initMultipartUpload`. A `.m3u8` or `.ts` file could be uploaded via multipart without rejection — but the uploaded file would still get whatever `Content-Type` the client sends.

### Content-Type propagation

`lib/r2Client.ts` passes `contentType` verbatim from the caller into the `PutObjectCommand`. The R2 object's `Content-Type` metadata is exactly what the client sends. If `.m3u8` is uploaded with the wrong MIME type (e.g. `application/octet-stream`), playback from R2 will behave incorrectly in some browsers.

**When approved:** Add `application/vnd.apple.mpegurl` and `video/mp2t` to `ALLOWED_MIME_TYPES`, and add the same validation to the multipart init route.

---

## 6. R2 CORS

No CORS configuration exists anywhere in the Next.js codebase — not in `next.config.ts`, not in any middleware, not in `lib/r2Client.ts`.

CORS for R2 is configured at the **Cloudflare dashboard** level (R2 bucket → Settings → CORS policy).

**Must verify before go-live.** HLS playback requires CORS because the browser fetches both the `.m3u8` playlist and each `.ts` / `.mp4` segment via XHR/fetch from the player's origin. If CORS is missing or too narrow, `hls.js` will fail with network errors even if the URLs are correct.

### Required CORS policy on R2 bucket

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://your-production-domain.com",
      "https://*.vercel.app"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 86400
  }
]
```

---

## 7. R2 content-type requirement

When uploading HLS output to R2, these MIME types must be set explicitly:

| File type | Required Content-Type |
|-----------|----------------------|
| `.m3u8` | `application/vnd.apple.mpegurl` |
| `.ts` | `video/mp2t` |
| `.mp4` (segments) | `video/mp4` |

Also set on segments:

```
Cache-Control: public, max-age=31536000, immutable
```

`r2Client.ts` already sets `CacheControl: 'public, max-age=31536000, immutable'` on all uploads — this is correct for immutable segment files.

---

## 8. Private master / public HLS path rule

The 947 MB source must not be served publicly.

**Private (never player-facing):**
```
private/masters/no-mans-land/master.mp4
```

**Public HLS (player uses only this):**
```
works/no-mans-land/hls/master.m3u8
works/no-mans-land/hls/1080p/index.m3u8
works/no-mans-land/hls/720p/index.m3u8
works/no-mans-land/hls/480p/index.m3u8
```

Admin pastes the master playlist URL into `videoUrl`:
```
https://pub-xxx.r2.dev/works/no-mans-land/hls/master.m3u8
```

Transcoding is done **offline** (e.g. ffmpeg locally or via a separate tool), then HLS output is uploaded to R2. No transcoding inside Vercel/Next.js.

---

## 9. Exact files to touch if approved

### Must change (player)

| File | Change |
|------|--------|
| `components/aim-player.tsx` | Dynamic import of `hls.js`; `canPlayType` fallback for Safari; destroy on unmount |
| `components/episode-player.tsx` | Same HLS integration |

### Must change (R2 upload)

| File | Change |
|------|--------|
| `app/api/admin/r2/upload/presign/route.ts` | Add `application/vnd.apple.mpegurl` and `video/mp2t` to `ALLOWED_MIME_TYPES` |
| `app/api/admin/r2/upload/multipart/init/route.ts` | Add same MIME type validation (currently missing) |

### Minor change (admin UX)

| File | Change |
|------|--------|
| `components/admin/work-form.tsx` | Update placeholder text on `videoUrl` / `trailerUrl` fields to mention `.m3u8` |

### External config (not code)

| System | Change |
|--------|--------|
| Cloudflare R2 bucket | Set CORS policy to allow player origins |
| Cloudflare R2 bucket | Confirm `.m3u8` objects are served with correct Content-Type |

### No change needed

| Item | Reason |
|------|--------|
| `prisma/schema.prisma` | `videoUrl: String?` already stores `.m3u8` URLs |
| `components/series-trailer-player.tsx` | Trailers are short clips; `.mp4` is fine for trailers |
| `components/video-player.tsx` | Not used on the main watch page |
| Database migrations | No schema change → no migration |

---

## 10. Recommended implementation sequence (for approval)

1. **CORS** — verify and set R2 bucket CORS policy. No code change.
2. **Transcode** — generate HLS output offline with ffmpeg. Upload to R2 with correct MIME types.
3. **Paste URL** — admin pastes `master.m3u8` URL into `videoUrl` field. Test Safari playback (works natively).
4. **hls.js** — add to `aim-player.tsx` and `episode-player.tsx` for Chrome/Edge support.
5. **R2 upload MIME types** — add `.m3u8` / `.ts` to allowed types if admin needs to upload HLS files through the existing UI.
6. **Placeholder text** — update admin form placeholder to mention `.m3u8`.

Steps 1–3 require no code changes and can confirm the HLS path works before any code is touched.

---

*No code changes were made during this audit. No database or schema commands were run.*

---

## 11. Post-audit hardening (2026-06-20)

The following player-level changes were applied after the full-platform audit. They
interact with the R2 configuration described above — read this before deploying.

### 11.1 `crossOrigin="anonymous"` on all `<video>` elements

`aim-player.tsx`, `episode-player.tsx`, and `video-player.tsx` now set
`crossOrigin="anonymous"`. This is required for cross-origin subtitle (`<track>`)
loading and for any future canvas/thumbnail work, and it is the correct standard
for media served from a different origin (the R2 CDN).

> **Operational dependency:** with `crossOrigin` set, the browser enforces CORS on
> the media request itself — not only on `hls.js` segment fetches. The R2 bucket
> CORS policy in **section 6** is now **mandatory for all playback** (native Safari
> HLS, MP4, and hls.js alike), not just for Chrome/Edge HLS. If hls.js already plays
> in Chrome today, CORS is correctly configured and this change is safe. If CORS is
> missing, video will fail to load — verify the policy before deploying.

### 11.2 HLS error handling

`lib/use-hls-video.ts` now attaches an `hls.on(ERROR)` handler:

- `NETWORK_ERROR` (fatal) → `hls.startLoad()` retry
- `MEDIA_ERROR` (fatal) → `hls.recoverMediaError()`
- any other fatal error → tears down and invokes an `onError` callback

Each player renders a branded `PlayerLoadError` overlay (Retry button reloads and
resumes from saved progress) instead of a frozen black frame. Native/MP4 failures
are caught via the `<video onError>` handler.

### 11.3 hls.js prefetch

The dynamic import now carries `/* webpackPrefetch: true */` so the hls.js chunk is
fetched during browser idle time, reducing first-play latency on Chrome/Edge/Firefox.

### 11.4 Multi-bitrate (ABR) requirement — REQUIRED for adaptive streaming

hls.js and native HLS only adapt quality if the **master playlist references multiple
bitrate renditions**. A master that points at a single rendition gives no adaptation:
viewers on slow connections will buffer instead of dropping to a lower quality.

The offline transcode (section 8) / video-processing worker **must** emit a master
playlist with at least the following ladder:

| Rendition | Resolution | Target bitrate |
|-----------|-----------|----------------|
| 1080p | 1920×1080 | ~5.0 Mbps |
| 720p  | 1280×720  | ~2.8 Mbps |
| 480p  | 854×480   | ~1.4 Mbps |
| 360p  | 640×360   | ~0.8 Mbps |

The `master.m3u8` must list each rendition with `#EXT-X-STREAM-INF` `BANDWIDTH` and
`RESOLUTION` attributes so the player can choose. Single-rendition output is acceptable
only for short trailers, never for full films.

---

## 12. F-01 — Playback access control (CRITICAL, edge-level change required)

### The problem

`videoUrl` (and `trailerUrl` / `previewClipUrl`) are **permanent, unsigned public CDN
URLs**. The watch page (`app/(public)/watch/[slug]/page.tsx`) gates access with a
server-side redirect, but once any user sees the URL in the browser network tab it is
reusable forever, by anyone, with no session — `requiresAuth: true` does not protect the
file, only the page. `controlsList="nodownload"` is cosmetic.

This is acceptable for free / trailer content. It is **not** acceptable for premium or
rights-restricted films.

### Why it cannot be fixed in application code alone

The bytes flow **R2 CDN → browser** directly; Next.js is never in the request path for
the media. Any real fix must run at the edge (Cloudflare), which requires (a) making the
`works/.../hls` path private and (b) a signing/validation mechanism plus a shared key.
None of that can live purely in this repo.

> S3-style presigned GET URLs (`getDownloadPresignedUrl` in `lib/r2Client.ts`) only sign a
> **single object**. HLS playback fetches the manifest **and every `.ts`/`.mp4` segment** as
> separate requests, which a presigned manifest URL does not cover. Presigning therefore
> works for single-file MP4 only — **not** for the HLS films this platform uses.

### Remediation options

**Option A — Cloudflare Worker + signed cookie (recommended; HLS-compatible).**
1. Move playback objects to a private path; remove public bucket access for it.
2. Put a Worker in front of the CDN domain (must be same-site as the app, e.g. app
   `impactaistudio.com` + CDN `cdn.impactaistudio.com`, so a cookie on `.impactaistudio.com`
   is sent with every segment request).
3. The watch page sets a short-lived, HttpOnly, path-scoped signed cookie (HMAC of
   `workId + expiry`, signed with a key shared with the Worker) when it grants access.
4. The Worker validates the cookie on **every** request (manifest + segments) and streams
   from R2 only when valid. Because the browser sends the cookie automatically, every
   segment is gated without rewriting the manifest.

**Option B — single-file MP4 + presigned URL (only if HLS is dropped).**
Make the MP4 private; have the watch page return a short-expiry `getDownloadPresignedUrl`.
Simple, but loses adaptive bitrate and breaks for `.m3u8`. Not recommended given §8–§11.

### Single integration point

When implementing Option A, the only application-side change is resolving the player
`src` in the watch page (the `src={videoUrl}` passed to `<AimPlayer>`), plus a
`Set-Cookie` on the granted response. The Worker is a separate Cloudflare deployment.

### Interim recommendation (Lite phase)

Keep the current public-CDN model for **free** content only. Do not publish premium or
rights-restricted films until Option A is in place. Track this as the one remaining
blocker before monetisation.

