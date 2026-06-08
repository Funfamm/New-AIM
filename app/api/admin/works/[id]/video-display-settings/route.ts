import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

const VALID_MEDIA_TYPES = new Set(["full", "trailer", "preview"]);

// GET /api/admin/works/[id]/video-display-settings
export async function GET(_req: NextRequest, { params }: Params) {
  await requireAdmin();
  const { id } = await params;

  const settings = await prisma.workVideoDisplaySetting.findMany({
    where: { workId: id },
  });

  return NextResponse.json({ settings });
}

// PATCH /api/admin/works/[id]/video-display-settings
// Body: { mediaType, filmstripMaskEnabled, filmstripMaskHeight, filmstripMaskOpacity }
export async function PATCH(req: NextRequest, { params }: Params) {
  await requireAdmin();
  const { id } = await params;

  const work = await prisma.work.findUnique({ where: { id }, select: { id: true } });
  if (!work) return NextResponse.json({ error: "Work not found" }, { status: 404 });

  const body = await req.json() as {
    mediaType?: string;
    filmstripMaskEnabled?: boolean;
    filmstripMaskHeight?: number;
    filmstripMaskOpacity?: number;
  };

  const { mediaType, filmstripMaskEnabled, filmstripMaskHeight, filmstripMaskOpacity } = body;

  if (!mediaType || !VALID_MEDIA_TYPES.has(mediaType)) {
    return NextResponse.json({ error: "mediaType must be full, trailer, or preview" }, { status: 400 });
  }
  if (typeof filmstripMaskEnabled !== "boolean") {
    return NextResponse.json({ error: "filmstripMaskEnabled must be a boolean" }, { status: 400 });
  }
  if (typeof filmstripMaskHeight !== "number" || filmstripMaskHeight < 5 || filmstripMaskHeight > 25) {
    return NextResponse.json({ error: "filmstripMaskHeight must be 5–25" }, { status: 400 });
  }
  if (typeof filmstripMaskOpacity !== "number" || filmstripMaskOpacity < 60 || filmstripMaskOpacity > 100) {
    return NextResponse.json({ error: "filmstripMaskOpacity must be 60–100" }, { status: 400 });
  }

  const setting = await prisma.workVideoDisplaySetting.upsert({
    where: { workId_mediaType: { workId: id, mediaType } },
    create: {
      workId: id,
      mediaType,
      filmstripMaskEnabled,
      filmstripMaskHeight,
      filmstripMaskOpacity,
      updatedAt: new Date(),
    },
    update: {
      filmstripMaskEnabled,
      filmstripMaskHeight,
      filmstripMaskOpacity,
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, setting });
}
