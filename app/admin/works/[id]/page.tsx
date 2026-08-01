import { prisma } from "@/lib/prisma";
import { createWork, updateWork } from "@/lib/actions/works";
import WorkForm from "@/components/admin/work-form";
import SeriesEpisodesPanel from "@/components/admin/series-episodes-panel";
import WorkCastPanel from "@/components/admin/work-cast-panel";
import SubtitlePanel from "@/components/admin/subtitle-panel";
import AdminSection from "@/components/admin/admin-section";
import ReleaseEmailButton from "./release-email-button";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BellRing } from "lucide-react";
import type { Metadata } from "next";
import type { WorkType, VideoJobStatus } from "@prisma/client";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    parentId?: string;
    type?: string;
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (id === "new") return { title: "Admin — Add Work" };
  return { title: "Admin — Edit Work" };
}

export default async function AdminWorkFormPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { error, parentId: defaultParentId, type: defaultTypeRaw } = await searchParams;
  const defaultType = defaultTypeRaw as WorkType | undefined;
  const isNew = id === "new";

  const [work, seriesList, ctaRow, allRows, assignedItems, allJobs] = await Promise.all([
    isNew
      ? Promise.resolve(null)
      : prisma.work.findUnique({ where: { id } }),
    prisma.work.findMany({
      where: { type: "SERIES" },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    isNew
      ? Promise.resolve(null)
      : prisma.notifyMeCta.findUnique({
          where: { workId: id },
          select: { id: true, isEnabled: true },
        }),
    prisma.contentRow.findMany({
      where: { active: true },
      select: { id: true, title: true, placement: true },
      orderBy: { sortOrder: "asc" },
    }),
    isNew
      ? Promise.resolve([] as { rowId: string }[])
      : prisma.contentRowItem.findMany({
          where: { workId: id },
          select: { rowId: true },
        }),
    isNew
      ? Promise.resolve([] as { id: string; status: VideoJobStatus; progress: number; hlsUrl: string | null; errorMessage: string | null; targetField: string }[])
      : prisma.videoProcessingJob.findMany({
          where: { workId: id },
          select: { id: true, status: true, progress: true, hlsUrl: true, errorMessage: true, targetField: true },
          orderBy: { createdAt: "desc" },
        }),
  ]);

  const latestJobVideo   = allJobs.find((j) => j.targetField === "videoUrl")       ?? null;
  const latestJobTrailer = allJobs.find((j) => j.targetField === "trailerUrl")      ?? null;
  const latestJobPreview = allJobs.find((j) => j.targetField === "previewClipUrl")  ?? null;

  const assignedRowIds = assignedItems.map((item) => item.rowId);

  if (!isNew && !work) notFound();

  const episodes =
    !isNew && work?.type === "SERIES"
      ? await prisma.work.findMany({
          where: { parentId: id },
          orderBy: [{ seasonNumber: "asc" }, { episodeNumber: "asc" }],
          select: {
            id: true, title: true, status: true,
            seasonNumber: true, episodeNumber: true,
            duration: true, videoUrl: true,
          },
        })
      : [];

  const action = isNew ? createWork : updateWork.bind(null, id);

  const acsReady = !!(
    process.env.ACS_CONNECTION_STRING &&
    process.env.ACS_SENDER_ADDRESS
  );

  const hasCtaActive = ctaRow?.isEnabled === true;
  const hasCastData = !isNew && work;
  const hasSubtitleData = !isNew && work && work.type !== "SERIES";
  const showEmail = !isNew && work && work.status === "PUBLISHED";

  return (
    <>
      <WorkForm
        work={work}
        workId={isNew ? null : id}
        workTitle={work?.title}
        action={action}
        seriesList={seriesList}
        error={error}
        defaultType={defaultType}
        defaultParentId={defaultParentId}
        rows={allRows}
        assignedRowIds={assignedRowIds}
        latestJobVideo={latestJobVideo}
        latestJobTrailer={latestJobTrailer}
        latestJobPreview={latestJobPreview}
      />

      {/* Episodes panel — only for Series */}
      {!isNew && work?.type === "SERIES" && (
        <AdminSection title="Episodes" icon="📺" defaultOpen={episodes.length > 0}>
          <SeriesEpisodesPanel seriesId={id} episodes={episodes} />
        </AdminSection>
      )}

      {/* Cast panel */}
      {hasCastData && (
        <AdminSection title="Cast" icon="👥" defaultOpen={false} lazy>
          <WorkCastPanel workId={id} />
        </AdminSection>
      )}

      {/* Subtitles panel */}
      {hasSubtitleData && (
        <AdminSection title="Subtitles & CC" icon="💬" defaultOpen={false} lazy>
          <SubtitlePanel
            workId={id}
            videoUrl={work.videoUrl ?? null}
            trailerUrl={work.trailerUrl ?? null}
          />
        </AdminSection>
      )}

      {/* Notify Me CTA */}
      {!isNew && work && (
        <AdminSection
          title="Notify Me CTA"
          icon="🔔"
          badge={hasCtaActive ? "Active" : undefined}
          defaultOpen={false}
        >
          <div style={{ padding: "1rem 0 0.25rem" }}>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-brand-muted)", margin: "0 0 0.75rem" }}>
              Create or manage the Notify Me call-to-action for this work.
            </p>
            <Link
              href={ctaRow ? `/admin/notify-me-ctas/${ctaRow.id}` : `/admin/notify-me-ctas/new?workId=${id}`}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontFamily: "var(--font-body)", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-brand-accent)", textDecoration: "none" }}
            >
              <BellRing size={14} />
              {ctaRow ? `Manage CTA${ctaRow.isEnabled ? " (Active)" : " (Disabled)"}` : "Set Up Notify Me CTA"}
            </Link>
          </div>
        </AdminSection>
      )}

      {/* Release / Episode email */}
      {showEmail && work.type !== "EPISODE" && (
        <AdminSection title="Release Email" icon="📧" defaultOpen={false}>
          <div style={{ padding: "1rem 0 0.25rem" }}>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-brand-muted)", margin: "0 0 0.75rem", lineHeight: 1.5 }}>
              Queue a bulk email to all opted-in registered users announcing this release.
              Emails are sent when you process the queue from{" "}
              <Link href="/admin/email" style={{ color: "var(--color-brand-accent)" }}>Admin → Email</Link>.
            </p>
            <ReleaseEmailButton workId={id} emailType="release" acsReady={acsReady} />
          </div>
        </AdminSection>
      )}

      {showEmail && work.type === "EPISODE" && work.parentId && (
        <AdminSection title="Episode Email" icon="📧" defaultOpen={false}>
          <div style={{ padding: "1rem 0 0.25rem" }}>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-brand-muted)", margin: "0 0 0.75rem", lineHeight: 1.5 }}>
              Queue a bulk email to opted-in users announcing this episode.
            </p>
            <ReleaseEmailButton workId={id} emailType="episode" acsReady={acsReady} />
          </div>
        </AdminSection>
      )}
    </>
  );
}
