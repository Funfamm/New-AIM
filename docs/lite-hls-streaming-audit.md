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
