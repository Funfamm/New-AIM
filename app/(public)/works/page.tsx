import { prisma } from "@/lib/prisma";
import WorksClient from "@/components/works-client";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Works — AIM Studio" };

type Props = {
  searchParams: Promise<{ collection?: string }>;
};

async function getWorks() {
  return prisma.work.findMany({
    where: { status: "PUBLISHED", type: { not: "EPISODE" } },
    orderBy: { order: "asc" },
    select: {
      id: true, slug: true, title: true, posterUrl: true,
      heroMobileUrl: true, heroDesktopUrl: true,
      genre: true, requiresAuth: true, type: true,
    },
  });
}

export default async function WorksPage({ searchParams }: Props) {
  const [works, { collection }] = await Promise.all([
    getWorks(),
    searchParams,
  ]);
  return <WorksClient works={works} collection={collection} />;
}
