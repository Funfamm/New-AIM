import { prisma } from "@/lib/prisma";
import { createWork, updateWork } from "@/lib/actions/works";
import WorkForm from "@/components/admin/work-form";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (id === "new") return { title: "Admin — Add Work" };
  return { title: "Admin — Edit Work" };
}

export default async function AdminWorkFormPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { error } = await searchParams;
  const isNew = id === "new";

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

  const action = isNew ? createWork : updateWork.bind(null, id);

  return (
    <WorkForm
      work={work}
      workTitle={work?.title}
      action={action}
      seriesList={seriesList}
      error={error}
    />
  );
}
