# AIM Studio Lite — Cloudflare R2 Admin Upload Audit

**Date:** 2026-06-05  
**Status:** Audit Complete — Ready for Implementation Approval

---

## Executive Summary

Enable admins to directly upload large project files (videos >500MB) to Cloudflare R2 storage without routing through Vercel serverless. This audit outlines the architecture, security model, and implementation plan based on the proven pattern from aim-platform.

---

## 1. Current Lite Media Fields

**Location:** `prisma/schema.prisma` (Work model)

| Field | Type | Purpose | Current Input |
|-------|------|---------|---|
| `posterUrl` | String? | Card poster image | Manual URL input |
| `heroMobileUrl` | String? | 9:16 portrait hero | Manual URL input |
| `heroDesktopUrl` | String? | 16:9 landscape hero | Manual URL input |
| `thumbnailUrl` | String? | Episode row thumbnail | Manual URL input |
| `trailerUrl` | String? | Official trailer video | Manual URL input |
| `previewClipUrl` | String? | Fallback preview clip (NEW) | Manual URL input |
| `videoUrl` | String? | Main full film/video | Manual URL input |
| `teaserUrl` | String? | Teaser (commercials only) | Manual URL input |

**Total upload targets:** 8 fields

---

## 2. Current Admin Work Form

**Location:** `components/admin/work-form.tsx`

**Current fields that need upload support:**

1. **Images:**
   - Mobile Image URL (heroMobileUrl) — line 251
   - Desktop Image URL (heroDesktopUrl) — line 257
   - Card/Poster override (posterUrl) — advanced section
   - Thumbnail override (thumbnailUrl) — advanced section

2. **Videos:**
   - Trailer URL (trailerUrl) — line 300
   - Preview Clip URL (previewClipUrl) — line 305 (NEW)
   - Main video URL (videoUrl) — line 309
   - Teaser URL (teaserUrl) — line 318

**Current form behavior:**
- All fields accept manual URL input
- No upload capability
- Fields are type="url" inputs
- No progress indication
- No validation beyond HTML5 URL type

---

## 3. Old AIM R2 Implementation Review

**Location:** `aim-platform/src/lib/r2Upload.ts` and `aim-platform/src/app/api/upload/*`

### Key Findings:

**a) R2 Client Setup:**
- Uses `@aws-sdk/client-s3` (S3-compatible)
- Endpoint: `https://{ACCOUNT_ID}.r2.cloudflarestorage.com`
- Lazy initialization to avoid build failures
- Singleton pattern for S3Client

**b) Presigned URL Pattern:**
- Route: `POST /api/upload/presign`
- Admin-only (gated with `requireAdmin()`)
- Returns:
  - `presignedUrl` (10-minute PUT window)
  - `finalUrl` (permanent public R2 URL)
  - `r2Key` (object key in bucket)
- Zero bytes pass through Vercel — direct browser→R2 upload

**c) File Type Validation:**
- MIME type allowlist per kind (image, audio, video, document)
- Extension inference when browser sends generic type (iOS Safari issue)
- Safe extension checking

**d) Storage Key Strategy:**
- Pattern: `uploads/videos/admin/{ts}-{uuid}.ext` for videos
- Pattern: `casting/calls/{id}/{name}-{hash}/{photos|audio|scripts}/{ts}-{uuid}.ext` for casting
- Timestamp + UUID ensures no collisions
- Human-readable structure
- No raw PII in keys

**e) Large File Support:**
- Multipart upload routes exist:
  - `POST /api/upload/multipart/create` — start upload
  - `POST /api/upload/multipart/sign-part` — get signed part URLs
  - `POST /api/upload/multipart/complete` — finish upload
- Size limits: 500MB for video, 50MB for audio, 10MB for others

**f) Security Model:**
- R2 credentials never sent to browser
- Only signed URLs returned (temporary, scoped)
- Admin check on video uploads
- Rate limiting for public project-asset uploads

---

## 4. Recommended R2 Upload Architecture for Lite

### Single-File Upload (for images <50MB):
```
1. Admin clicks "Upload" button next to URL field
2. Browser fires POST /api/admin/r2/upload/presign
   Body: { projectTitle, projectSlug, fieldType, filename, contentType, sizeBytes }
3. Server returns presignedUrl + finalUrl + r2Key
4. Browser PUT file directly to presignedUrl
5. On success, populate matching URL input with finalUrl
6. Admin still clicks Save to persist to DB
```

### Multipart Upload (for videos >50MB):
```
1. Admin clicks "Upload" button next to video field
2. Browser fires POST /api/admin/r2/upload/multipart/init
   Returns: uploadId, r2Key, object key
3. Browser chunks file into 5MB+ parts
4. For each part, fire POST /api/admin/r2/upload/multipart/sign-part
   Returns: presignedUrl for that part
5. Browser PUT each part directly to presignedUrl
6. After all parts, fire POST /api/admin/r2/upload/multipart/complete
   Body: { uploadId, parts: [{partNumber, etag}] }
7. Server returns finalUrl
8. Populate URL input, admin clicks Save
```

### Key Security Requirements:
- ✅ Server-only R2 credentials
- ✅ Presigned URLs with 10-minute expiry
- ✅ Admin-only endpoints (requireAdmin() guard)
- ✅ File type/size validation on server
- ✅ No credentials in error messages
- ✅ No file content routed through Vercel

---

## 5. Upload Type Support Recommendation

**Single-file (presign route):**
- posterUrl (JPEG/PNG, <10MB)
- heroMobileUrl (JPEG/PNG, <10MB)
- heroDesktopUrl (JPEG/PNG, <10MB)
- thumbnailUrl (JPEG/PNG, <10MB)

**Multipart upload (for large files):**
- trailerUrl (MP4/WebM, <500MB)
- previewClipUrl (MP4/WebM, <500MB)
- videoUrl (MP4/WebM, <500MB, full films)
- teaserUrl (MP4/WebM, <50MB, commercials)

---

## 6. Project Folder/Key Strategy

**Storage prefix structure:**

```
projects/{project-slug}/
  poster/poster-{ts}.{ext}
  mobile-hero/mobile-{ts}.{ext}
  desktop-hero/desktop-{ts}.{ext}
  thumbnail/thumb-{ts}.{ext}
  trailer/trailer-{ts}.{ext}
  preview-clip/preview-{ts}.{ext}
  full-video/full-{ts}.{ext}
  teaser/teaser-{ts}.{ext}
```

**Example for "Line of Sight":**
```
projects/line-of-sight/
  poster/poster-1717591200000.jpg
  full-video/full-1717591200000.mp4
  trailer/trailer-1717591200000.mp4
  preview-clip/preview-1717591200000.mp4
```

**Key safety rules:**
- Use existing project slug (`work.slug`)
- If slug not available yet, generate safe slug from title (lowercase, `-` for spaces, trim)
- Include timestamp to avoid collisions if file re-uploaded
- Include field category (poster, trailer, etc.) for human readability
- Keep file extension
- No raw filenames (prevent path traversal)

**Behavior if project title changes:**
- Old files remain under old slug prefix
- New uploads use new slug
- Old URLs still work (R2 is immutable)
- No automatic migration (not needed, not recommended)

---

## 7. Required Environment Variables

Add to `.env.local.example` (NO REAL VALUES):

```env
# ── Cloudflare R2 Configuration ──────────────────────────
# Get from: Cloudflare Dashboard → R2 → API Tokens
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=aim-studio-bucket

# ── R2 Public URL ────────────────────────────────────────
# Custom domain or default: https://{bucket}.{account}.r2.cloudflarestorage.com
R2_PUBLIC_BASE_URL=https://cdn.example.com
```

**Notes:**
- R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY are secrets — never commit
- Only add placeholders to `.env.local.example`
- R2_PUBLIC_BASE_URL can be custom domain or default R2 domain
- Server-side only (never sent to browser)

---

## 8. R2 CORS Requirements

**Bucket CORS configuration needed for browser direct-upload:**

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://staging.impactaistudio.com",
      "https://impactaistudio.com"
    ],
    "AllowedMethods": [
      "PUT",
      "POST",
      "HEAD",
      "GET"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "x-amz-version-id",
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

**Setup location:**
- Cloudflare Dashboard → R2 → Select bucket → Settings → CORS

**Allow methods:**
- PUT (presigned URL uploads, single file)
- POST (multipart init)
- HEAD (optional, for size checks)
- GET (optional, for public downloads)

---

## 9. Schema Change Needed?

**NO.** All 8 media URL fields already exist in Work model and accept String?

- posterUrl ✅
- heroMobileUrl ✅
- heroDesktopUrl ✅
- thumbnailUrl ✅
- trailerUrl ✅
- previewClipUrl ✅ (added in earlier feature)
- videoUrl ✅
- teaserUrl ✅

No new columns required. Existing URL fields can store R2 URLs without change.

---

## 10. New Dependencies Needed

**Current Lite package.json lacks:**
- `@aws-sdk/client-s3` (S3-compatible client)
- `@aws-sdk/s3-request-presigner` (presigned URL generation)
- `uuid` (for unique file names)

**To add:**
```json
"@aws-sdk/client-s3": "^3.x.x",
"@aws-sdk/s3-request-presigner": "^3.x.x",
"uuid": "^9.x.x"
```

**No other dependencies needed.** (crypto is built-in to Node.js)

---

## 11. Exact Files to Touch

### New files to create:
1. `lib/r2Client.ts` — R2/S3 client singleton
2. `app/api/admin/r2/upload/presign/route.ts` — presigned URL endpoint
3. `app/api/admin/r2/upload/multipart/init/route.ts` — start multipart upload
4. `app/api/admin/r2/upload/multipart/sign-part/route.ts` — get part upload URLs
5. `app/api/admin/r2/upload/multipart/complete/route.ts` — finish multipart upload
6. `components/r2-file-upload.tsx` — reusable upload component

### Files to modify:
7. `.env.local.example` — add R2 env var placeholders
8. `components/admin/work-form.tsx` — add upload buttons next to media fields
9. `package.json` — add AWS SDK dependencies

### No changes needed to:
- `prisma/schema.prisma` (fields already exist)
- `lib/work-cta.ts` (CTA logic unaffected)
- Database/migrations (no schema change)

**Total new files:** 6  
**Total modified files:** 3  
**Total untouched:** 2+

---

## 12. Risk Level Assessment

**Overall Risk:** LOW

### Why low:
- ✅ No schema changes
- ✅ No database mutations
- ✅ No existing behavior broken
- ✅ Manual URL input still works alongside upload
- ✅ Proven pattern from aim-platform
- ✅ Server-side credentials (no exposure)
- ✅ Presigned URLs with expiry
- ✅ Admin-only access

### Mitigation:
- Test small image uploads first
- Test large video multipart uploads second
- Verify CORS is set correctly in R2 bucket
- Verify env vars are secret (not logged)
- Confirm presigned URLs expire properly

---

## 13. Implementation Sequence After Approval

### Phase 1: Foundation (1-2 hours)
1. Add AWS SDK dependencies to package.json
2. Create `lib/r2Client.ts` (S3 client singleton)
3. Create env var placeholders in `.env.local.example`
4. Run `npm install`

### Phase 2: API Routes (2-3 hours)
5. Create presigned URL route (`POST /api/admin/r2/upload/presign`)
6. Create multipart init route (`POST /api/admin/r2/upload/multipart/init`)
7. Create multipart sign-part route (`POST /api/admin/r2/upload/multipart/sign-part`)
8. Create multipart complete route (`POST /api/admin/r2/upload/multipart/complete`)

### Phase 3: UI Component (1-2 hours)
9. Create `components/r2-file-upload.tsx` (reusable upload component)
   - Progress bar for upload
   - Cancel button
   - Error handling
   - Auto-fill URL input on success

### Phase 4: Integration (1-2 hours)
10. Modify `components/admin/work-form.tsx`
    - Add upload buttons next to each media field
    - Wire upload component to field names
    - Preserve manual URL input functionality

### Phase 5: Testing (2-3 hours)
11. Test image upload (poster, heroes, thumbnail)
12. Test video upload (trailer, preview, full film, teaser)
13. Test multipart for large videos
14. Verify R2 bucket structure
15. Verify URLs are public and accessible
16. Test error recovery (failed upload, network issues)
17. Run TypeScript check

---

## 14. Testing Checklist

After implementation:

- [ ] Upload poster image (JPEG, <5MB) → appears in projects/{slug}/poster/
- [ ] URL field auto-fills with public R2 URL
- [ ] Save work, verify saved URL matches input
- [ ] Public card displays uploaded poster
- [ ] Upload mobile hero image → projects/{slug}/mobile-hero/
- [ ] Upload desktop hero image → projects/{slug}/desktop-hero/
- [ ] Upload thumbnail → projects/{slug}/thumbnail/
- [ ] Upload trailer video (MP4, <500MB) → projects/{slug}/trailer/
- [ ] URL field auto-fills
- [ ] Save, verify trailer plays on detail page
- [ ] Upload preview clip video → projects/{slug}/preview-clip/
- [ ] Upload full film video >500MB → triggers multipart upload
- [ ] Progress bar displays during multipart
- [ ] Verify multipart parts upload to R2
- [ ] Final URL appears in input
- [ ] Upload teaser video → projects/{slug}/teaser/
- [ ] Test failed upload recovery (cancel, retry)
- [ ] Verify R2 credentials NOT in browser console
- [ ] Verify non-admin cannot access upload APIs (403 response)
- [ ] TypeScript build passes
- [ ] No schema/database commands run

---

## 15. Implementation Not Included

The following are OUT OF SCOPE for this audit:

- ✗ Automatic image optimization/resize (could add later)
- ✗ CDN caching headers (R2 already has defaults)
- ✗ Signed download URLs (not needed, files are public)
- ✗ File deletion from R2 when work is deleted (deferred)
- ✗ Transcoding/video encoding (deferred)
- ✗ AI-powered caption generation (deferred)
- ✗ Rate limiting beyond presign endpoint (can add later)

---

## Next Steps

**This audit is complete.**

### To proceed:
1. ✅ Review this audit
2. ✅ Confirm R2 bucket is created in Cloudflare
3. ✅ Get R2 API token credentials
4. ✅ Approve implementation plan
5. ⏳ Request implementation

### Upon approval:
- Implementation will follow the 5-phase sequence above
- No schema changes
- No database commands
- Estimated delivery: 6-8 hours
- Full test coverage before merge

---

**Audit prepared by:** Claude Code  
**Audit date:** 2026-06-05  
**Status:** Ready for approval  
**No code changes made during audit.**
