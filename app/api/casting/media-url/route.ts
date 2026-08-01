import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getDownloadPresignedUrl } from "@/lib/r2Client";
import { prisma } from "@/lib/prisma";

// GET /api/casting/media-url?mediaId=xxx
// Returns a short-lived signed URL for admins to view a casting media file.
export async function GET(req: NextRequest) {
  await requireAdmin();

  const mediaId = req.nextUrl.searchParams.get("mediaId");
  if (!mediaId) {
    return NextResponse.json({ error: "mediaId required" }, { status: 400 });
  }

  const media = await prisma.castingApplicationMedia.findUnique({
    where: { id: mediaId },
    select: { r2Key: true },
  });

  if (!media) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = await getDownloadPresignedUrl(media.r2Key, 1800); // 30 min
  return NextResponse.json({ url });
}
