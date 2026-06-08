import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import {
  findSubtitle,
  updateSubtitleById,
  deleteSubtitleById,
  saveSubtitleSegments,
  setSubtitleStatus,
} from "@/lib/subtitles/subtitle-repo";
import { cacheVttToR2 } from "@/lib/subtitles/vtt-storage";
import type { SubtitleSegment } from "@/lib/subtitles/subtitle-file-parser";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try { await requireAdmin(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const subtitle = await findSubtitle(id);
  if (!subtitle) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ subtitle });
}

// PATCH: update metadata, segments (save draft), status (approve), or cancelJob
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try { await requireAdmin(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json() as {
    // metadata
    label?: string;
    sortOrder?: number;
    isDefault?: boolean;
    // save draft — cue edit
    segments?: SubtitleSegment[];
    reason?: string;
    // approval
    status?: string;
    // cancel active job
    cancelJob?: boolean;
  };

  if (body.cancelJob) {
    await prisma.subtitleJob.updateMany({
      where: { subtitleId: id, status: { in: ["PENDING", "PROCESSING"] } },
      data: { status: "FAILED", error: "Cancelled by admin", updatedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  let subtitle;

  if (body.segments !== undefined) {
    // Save draft: update segment content and save revision
    subtitle = await saveSubtitleSegments(id, body.segments, body.reason ?? "manual_edit");
  } else if (body.status !== undefined) {
    // Approval state change
    if (body.status !== "draft" && body.status !== "approved_source") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    subtitle = await setSubtitleStatus(id, body.status);

    // Cache source VTT to R2 on approval so the CDN URL is available for the player
    if (body.status === "approved_source" && subtitle.segmentsJson.length > 0) {
      try {
        const srcLang = subtitle.sourceLanguage;
        const existingKeys = (subtitle.vttKeysJson ?? {}) as Record<string, string>;
        if (!existingKeys[srcLang]) {
          const key = await cacheVttToR2(subtitle.id, srcLang, subtitle.segmentsJson);
          subtitle = await updateSubtitleById(id, { vttKeysJson: { ...existingKeys, [srcLang]: key } });
        }
      } catch {
        // Non-fatal — public VTT route serves from segmentsJson as fallback
      }
    }
  } else {
    // Metadata update
    subtitle = await updateSubtitleById(id, {
      label: body.label,
      sortOrder: body.sortOrder,
      isDefault: body.isDefault,
    });
  }

  return NextResponse.json({ subtitle });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try { await requireAdmin(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  await deleteSubtitleById(id);
  return NextResponse.json({ ok: true });
}
