import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { SubtitleSegment } from "./subtitle-file-parser";

export type SubtitleRow = {
  id: string;
  workId: string;
  mediaType: string;
  sourceLanguage: string;
  label: string;
  status: string; // draft | approved_source
  segmentsJson: SubtitleSegment[];
  translationsJson: Record<string, SubtitleSegment[]> | null;
  vttKeysJson: Record<string, string> | null;
  isPublished: boolean;
  isDefault: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type SubtitleRevisionRow = {
  id: string;
  subtitleId: string;
  snapshotJson: SubtitleSegment[];
  reason: string | null;
  createdAt: Date;
};

export async function findSubtitle(id: string): Promise<SubtitleRow | null> {
  const row = await prisma.subtitle.findUnique({ where: { id } });
  if (!row) return null;
  return row as unknown as SubtitleRow;
}

export async function listSubtitlesByWork(workId: string): Promise<SubtitleRow[]> {
  const rows = await prisma.subtitle.findMany({
    where: { workId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, type: true, status: true, progress: true, error: true, languagesJson: true, createdAt: true, updatedAt: true },
      },
    },
  });
  return rows as unknown as SubtitleRow[];
}

export async function findOrCreateSubtitle(
  workId: string,
  mediaType: string,
  sourceLanguage: string = "en"
): Promise<SubtitleRow> {
  const existing = await prisma.subtitle.findUnique({
    where: { workId_mediaType_sourceLanguage: { workId, mediaType, sourceLanguage } },
  });
  if (existing) return existing as unknown as SubtitleRow;

  const created = await prisma.subtitle.create({
    data: {
      workId,
      mediaType,
      sourceLanguage,
      label: getLangLabel(sourceLanguage),
      segmentsJson: [] as never,
      status: "draft",
    },
  });
  return created as unknown as SubtitleRow;
}

export type UpsertSubtitleInput = {
  workId: string;
  mediaType?: string;
  sourceLanguage?: string;
  label?: string;
  segments: SubtitleSegment[];
};

export async function upsertSubtitle(input: UpsertSubtitleInput): Promise<SubtitleRow> {
  const { workId, mediaType = "full", sourceLanguage = "en", label, segments } = input;
  const displayLabel = label ?? getLangLabel(sourceLanguage);

  const existing = await prisma.subtitle.findUnique({
    where: { workId_mediaType_sourceLanguage: { workId, mediaType, sourceLanguage } },
  });

  if (existing) {
    await prisma.subtitleRevision.create({
      data: { subtitleId: existing.id, snapshotJson: existing.segmentsJson as never, reason: "re-upload" },
    });
    const updated = await prisma.subtitle.update({
      where: { id: existing.id },
      data: {
        label: displayLabel,
        segmentsJson: segments as never,
        translationsJson: Prisma.JsonNull,
        vttKeysJson: Prisma.JsonNull,
        status: "draft",
        updatedAt: new Date(),
      },
    });
    return updated as unknown as SubtitleRow;
  }

  const created = await prisma.subtitle.create({
    data: {
      workId,
      mediaType,
      sourceLanguage,
      label: displayLabel,
      segmentsJson: segments as never,
      status: "draft",
    },
  });
  return created as unknown as SubtitleRow;
}

export async function saveSubtitleSegments(
  id: string,
  segments: SubtitleSegment[],
  reason: string = "manual_edit"
): Promise<SubtitleRow> {
  const existing = await prisma.subtitle.findUnique({ where: { id } });
  if (existing && (existing.segmentsJson as SubtitleSegment[]).length > 0) {
    await prisma.subtitleRevision.create({
      data: { subtitleId: id, snapshotJson: existing.segmentsJson as never, reason },
    });
  }
  const updated = await prisma.subtitle.update({
    where: { id },
    data: { segmentsJson: segments as never, updatedAt: new Date() },
  });
  return updated as unknown as SubtitleRow;
}

export async function setSubtitleStatus(id: string, status: string): Promise<SubtitleRow> {
  const updated = await prisma.subtitle.update({
    where: { id },
    data: { status, updatedAt: new Date() },
  });
  return updated as unknown as SubtitleRow;
}

export async function updateSubtitleById(
  id: string,
  data: Partial<{
    label: string;
    status: string;
    isPublished: boolean;
    isDefault: boolean;
    sortOrder: number;
    translationsJson: Record<string, SubtitleSegment[]>;
    vttKeysJson: Record<string, string>;
  }>
): Promise<SubtitleRow> {
  const updated = await prisma.subtitle.update({
    where: { id },
    data: data as never,
  });
  return updated as unknown as SubtitleRow;
}

export async function deleteSubtitleById(id: string): Promise<void> {
  await prisma.subtitle.delete({ where: { id } });
}

export async function listPublishedSubtitles(workId: string): Promise<SubtitleRow[]> {
  const rows = await prisma.subtitle.findMany({
    where: { workId, isPublished: true },
    orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }],
  });
  return rows as unknown as SubtitleRow[];
}

export async function listSubtitleRevisions(subtitleId: string): Promise<SubtitleRevisionRow[]> {
  const revs = await prisma.subtitleRevision.findMany({
    where: { subtitleId },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, subtitleId: true, snapshotJson: true, reason: true, createdAt: true },
  });
  return revs as unknown as SubtitleRevisionRow[];
}

export async function restoreSubtitleRevision(
  subtitleId: string,
  revisionId: string
): Promise<SubtitleRow | null> {
  const rev = await prisma.subtitleRevision.findUnique({
    where: { id: revisionId },
    select: { snapshotJson: true },
  });
  if (!rev) return null;

  const existing = await prisma.subtitle.findUnique({ where: { id: subtitleId } });
  if (existing) {
    await prisma.subtitleRevision.create({
      data: { subtitleId, snapshotJson: existing.segmentsJson as never, reason: "before_restore" },
    });
  }

  const updated = await prisma.subtitle.update({
    where: { id: subtitleId },
    data: { segmentsJson: rev.snapshotJson as never, updatedAt: new Date() },
  });
  return updated as unknown as SubtitleRow;
}

function getLangLabel(code: string): string {
  const map: Record<string, string> = {
    en: "English", es: "Spanish", fr: "French", de: "German",
    pt: "Portuguese", ru: "Russian", zh: "Chinese", ar: "Arabic",
    ja: "Japanese", ko: "Korean", hi: "Hindi",
  };
  return map[code] ?? code.toUpperCase();
}
