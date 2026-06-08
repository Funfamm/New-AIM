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
    // save draft — cue edit (source language)
    segments?: SubtitleSegment[];
    reason?: string;
    // save a single translated language without overwriting others
    translationLang?: string;
    translationSegments?: SubtitleSegment[];
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

  if (body.translationLang && body.translationSegments !== undefined) {
    // Save a single translated language — merge into translationsJson without touching others
    const sub = await findSubtitle(id);
    if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const existing = (sub.translationsJson ?? {}) as Record<string, SubtitleSegment[]>;
    subtitle = await updateSubtitleById(id, {
      translationsJson: { ...existing, [body.translationLang]: body.translationSegments },
    });
  } else if (body.segments !== undefined) {
    // Save draft: update source segment content and save revision
    subtitle = await saveSubtitleSegments(id, body.segments, body.reason ?? "manual_edit");
  } else if (body.status !== undefined) {
    // Approval state change
    if (body.status !== "draft" && body.status !== "approved_source") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    subtitle = await setSubtitleStatus(id, body.status);
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
