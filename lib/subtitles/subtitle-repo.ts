import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { SubtitleSegment } from "./subtitle-file-parser";

export type SubtitleRow = {
  id: string;
  workId: string;
  mediaType: string;
  sourceLanguage: string;
  label: string;
  segmentsJson: SubtitleSegment[];
  translationsJson: Record<string, SubtitleSegment[]> | null;
  vttKeysJson: Record<string, string> | null;
  isPublished: boolean;
  isDefault: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
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
        select: { id: true, status: true, progress: true, error: true, languagesJson: true },
      },
    },
  });
  return rows as unknown as SubtitleRow[];
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
    },
  });
  return created as unknown as SubtitleRow;
}

export async function updateSubtitleById(
  id: string,
  data: Partial<{
    label: string;
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

function getLangLabel(code: string): string {
  const map: Record<string, string> = {
    en: "English", es: "Spanish", fr: "French", pt: "Portuguese",
    zh: "Chinese", ar: "Arabic", ko: "Korean", hi: "Hindi",
  };
  return map[code] ?? code.toUpperCase();
}
