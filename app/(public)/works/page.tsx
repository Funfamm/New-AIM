import { prisma } from "@/lib/prisma";
import WorksClient from "@/components/works-client";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Works — AIM Studio" };

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

export default async function WorksPage() {
  const works = await getWorks();
  return <WorksClient works={works} />;
}
