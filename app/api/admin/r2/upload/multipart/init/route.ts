import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { initMultipartUpload, getPublicUrl } from '@/lib/r2Client';
import { randomUUID } from 'crypto';

const APPROVED_FIELDS = ['posterUrl', 'thumbnailUrl', 'heroMobileUrl', 'heroDesktopUrl', 'trailerUrl', 'previewClipUrl', 'videoUrl', 'teaserUrl', 'masterVideoKey'];
const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  posterUrl: ['image/jpeg', 'image/png', 'image/webp'],
  thumbnailUrl: ['image/jpeg', 'image/png', 'image/webp'],
  heroMobileUrl: ['image/jpeg', 'image/png', 'image/webp'],
  heroDesktopUrl: ['image/jpeg', 'image/png', 'image/webp'],
  trailerUrl: ['video/mp4', 'video/webm', 'video/quicktime', 'application/vnd.apple.mpegurl', 'video/mp2t'],
  previewClipUrl: ['video/mp4', 'video/webm', 'video/quicktime', 'application/vnd.apple.mpegurl', 'video/mp2t'],
  videoUrl: ['video/mp4', 'video/webm', 'video/quicktime', 'application/vnd.apple.mpegurl', 'video/mp2t'],
  teaserUrl: ['video/mp4', 'video/webm', 'video/quicktime', 'application/vnd.apple.mpegurl', 'video/mp2t'],
  masterVideoKey: ['video/mp4', 'video/quicktime', 'video/webm'],
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[''']/g, '')         // strip apostrophes before splitting on spaces
    .replace(/[^a-z0-9]+/g, '-')  // all remaining non-alphanumeric → hyphen
    .replace(/^-+|-+$/g, '')      // trim leading/trailing hyphens
    .slice(0, 80) || 'untitled';
}

function getFieldCategory(field: string): string {
  const categories: Record<string, string> = {
    posterUrl: 'poster',
    thumbnailUrl: 'thumbnail',
    heroMobileUrl: 'hero-mobile',
    heroDesktopUrl: 'hero-desktop',
    trailerUrl: 'trailer',
    previewClipUrl: 'preview',
    videoUrl: 'full-video',
    teaserUrl: 'teaser',
    masterVideoKey: 'master',
  };
  return categories[field] || field;
}

function getExtension(filename: string): string {
  const i = filename.lastIndexOf('.');
  return i >= 0 ? filename.slice(i).toLowerCase().replace(/[^a-z0-9.]/g, '') : '';
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const body = await req.json();
    const { targetField, projectTitle, projectSlug, filename, contentType } = body as {
      targetField: string;
      projectTitle: string;
      projectSlug?: string;
      filename: string;
      contentType: string;
    };

    if (!targetField || !projectTitle || !filename || !contentType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!APPROVED_FIELDS.includes(targetField)) {
      return NextResponse.json({ error: 'Invalid target field' }, { status: 400 });
    }

    const allowedMimes = ALLOWED_MIME_TYPES[targetField] ?? [];
    if (allowedMimes.length > 0 && !allowedMimes.includes(contentType)) {
      return NextResponse.json({ error: `Invalid content type for ${targetField}` }, { status: 400 });
    }

    const ext = getExtension(filename);
    const safeExt = ext || '.bin';
    const slug = projectSlug || slugify(projectTitle);
    const timestamp = Date.now();
    const randomId = randomUUID().slice(0, 8);

    // Master video goes to a private path — never exposed publicly
    const isMasterUpload = targetField === 'masterVideoKey';
    const r2Key = isMasterUpload
      ? `private/masters/${slug}/master-${timestamp}-${randomId}${safeExt}`
      : `projects/${slug}/${getFieldCategory(targetField)}/${getFieldCategory(targetField)}-${timestamp}-${randomId}${safeExt}`;

    const uploadId = await initMultipartUpload(r2Key, contentType);

    // Master uploads return only the key — no public URL exists for private objects
    if (isMasterUpload) {
      return NextResponse.json({ uploadId, r2Key });
    }

    const publicUrl = getPublicUrl(r2Key);
    return NextResponse.json({ uploadId, r2Key, publicUrl });
  } catch (error) {
    console.error('[Multipart Init] Error:', error);
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
      if (error.message.includes('R2_PUBLIC_BASE_URL is not set')) {
        return NextResponse.json({ error: 'Upload not configured: R2_PUBLIC_BASE_URL is missing. Add it to your environment variables.' }, { status: 500 });
      }
      if (error.message.includes('Missing required Cloudflare R2 environment variables')) {
        return NextResponse.json({ error: 'Upload not configured: R2 credentials are missing. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME in your environment variables.' }, { status: 500 });
      }
    }
    return NextResponse.json({ error: 'Failed to initialize multipart upload' }, { status: 500 });
  }
}
