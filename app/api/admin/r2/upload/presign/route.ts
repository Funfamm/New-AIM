import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { getPresignedUrl, getPublicUrl } from '@/lib/r2Client';
import { createHash, randomUUID } from 'crypto';

const APPROVED_FIELDS = ['posterUrl', 'thumbnailUrl', 'heroMobileUrl', 'heroDesktopUrl', 'trailerUrl', 'previewClipUrl', 'videoUrl', 'teaserUrl'];
const ALLOWED_MIME_TYPES = {
  posterUrl: ['image/jpeg', 'image/png', 'image/webp'],
  thumbnailUrl: ['image/jpeg', 'image/png', 'image/webp'],
  heroMobileUrl: ['image/jpeg', 'image/png', 'image/webp'],
  heroDesktopUrl: ['image/jpeg', 'image/png', 'image/webp'],
  trailerUrl: ['video/mp4', 'video/webm', 'video/quicktime'],
  previewClipUrl: ['video/mp4', 'video/webm', 'video/quicktime'],
  videoUrl: ['video/mp4', 'video/webm', 'video/quicktime'],
  teaserUrl: ['video/mp4', 'video/webm', 'video/quicktime'],
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function getExtension(filename: string): string {
  const i = filename.lastIndexOf('.');
  return i >= 0 ? filename.slice(i).toLowerCase().replace(/[^a-z0-9.]/g, '') : '';
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
  };
  return categories[field] || field;
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const body = await req.json();
    const { targetField, projectTitle, projectSlug, filename, contentType, sizeBytes } = body as {
      targetField: string;
      projectTitle: string;
      projectSlug?: string;
      filename: string;
      contentType: string;
      sizeBytes?: number;
    };

    if (!targetField || !projectTitle || !filename || !contentType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!APPROVED_FIELDS.includes(targetField)) {
      return NextResponse.json({ error: 'Invalid target field' }, { status: 400 });
    }

    const allowedMimes = ALLOWED_MIME_TYPES[targetField as keyof typeof ALLOWED_MIME_TYPES] || [];
    if (!allowedMimes.includes(contentType)) {
      return NextResponse.json({ error: `Invalid content type for ${targetField}` }, { status: 400 });
    }

    // Sanitize filename and extension
    const ext = getExtension(filename);
    const safeExt = ext || '.bin';
    const blockedExts = ['exe', 'bat', 'cmd', 'msi', 'sh', 'ps1', 'scr', 'com', 'vbs', 'dll', 'so'];
    if (blockedExts.includes(ext.slice(1).toLowerCase())) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    // Generate safe project slug
    const slug = projectSlug || slugify(projectTitle);
    const category = getFieldCategory(targetField);
    const timestamp = Date.now();
    const randomId = randomUUID().slice(0, 8);
    const r2Key = `projects/${slug}/${category}/${category}-${timestamp}-${randomId}${safeExt}`;

    // Get presigned URL
    const presignedUrl = await getPresignedUrl(r2Key, contentType, 600);
    const publicUrl = getPublicUrl(r2Key);

    return NextResponse.json({ presignedUrl, publicUrl, r2Key });
  } catch (error) {
    console.error('[Presign] Error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
  }
}
