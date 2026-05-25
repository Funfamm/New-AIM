import { prisma } from "@/lib/prisma";
import { createWork, updateWork } from "@/lib/actions/works";
import WorkForm from "@/components/admin/work-form";
import SeriesEpisodesPanel from "@/components/admin/series-episodes-panel";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { WorkType } from "@prisma/client";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    /** Pre-fill parent series — set by "Add Episode" link in SeriesEpisodesPanel */
    parentId?: string;
    /** Pre-select work type — set by "Add Episode" link */
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

  // Fetch the work being edited (if any) and the full series list in parallel
  const [work, seriesList] = await Promise.all([
    isNew
      ? Promise.resolve(null)
      : prisma.work.findUnique({ where: { id } }),
    prisma.work.findMany({
      where: { type: "SERIES" },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
  ]);

  if (!isNew && !work) notFound();

  // Fetch child episodes only when editing a Series — avoids the query for all other types
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

  return (
    <>
      <WorkForm
        work={work}
        workTitle={work?.title}
        action={action}
        seriesList={seriesList}
        error={error}
        defaultType={defaultType}
        defaultParentId={defaultParentId}
      />

      {/* Episodes panel — only rendered when editing a Series */}
      {!isNew && work?.type === "SERIES" && (
        <SeriesEpisodesPanel seriesId={id} episodes={episodes} />
      )}
    </>
  );
}
