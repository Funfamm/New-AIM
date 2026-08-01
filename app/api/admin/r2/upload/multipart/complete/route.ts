import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { completeMultipartUpload, getPublicUrl } from '@/lib/r2Client';

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const body = await req.json();
    const { r2Key, uploadId, parts } = body as {
      r2Key: string;
      uploadId: string;
      parts: Array<{ PartNumber: number; ETag: string }>;
    };

    if (!r2Key || !uploadId || !parts || !Array.isArray(parts) || parts.length === 0) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    await completeMultipartUpload(r2Key, uploadId, parts);
    const publicUrl = getPublicUrl(r2Key);

    return NextResponse.json({ publicUrl, r2Key });
  } catch (error) {
    console.error('[Complete Multipart] Error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to complete multipart upload' }, { status: 500 });
  }
}
