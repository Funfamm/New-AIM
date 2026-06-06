import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { getPartPresignedUrl } from '@/lib/r2Client';

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const body = await req.json();
    const { r2Key, uploadId, partNumber } = body as {
      r2Key: string;
      uploadId: string;
      partNumber: number;
    };

    if (!r2Key || !uploadId || typeof partNumber !== 'number' || partNumber < 1 || partNumber > 10000) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const presignedUrl = await getPartPresignedUrl(r2Key, uploadId, partNumber, 900);

    return NextResponse.json({ presignedUrl, partNumber });
  } catch (error) {
    console.error('[Sign Part] Error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to sign part URL' }, { status: 500 });
  }
}
