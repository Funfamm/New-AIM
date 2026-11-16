// Client website brief — a standalone, no-account page for a prospective web-design
// client. Lives outside the (public) group on purpose: no site nav or footer, just the
// brief. The token in the URL is the only credential; the page is never indexed.

import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata, Viewport } from "next";
import { Big_Shoulders, JetBrains_Mono } from "next/font/google";
import { prisma } from "@/lib/prisma";
import { DEMO_TOKEN, sanitizeAnswers, type Answers } from "@/lib/client-brief/schema";
import BriefExperience from "./brief-experience";

const display = Big_Shoulders({ subsets: ["latin"], weight: ["700", "800", "900"], variable: "--brief-display", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["500", "700"], variable: "--brief-mono", display: "swap" });

export const dynamic = "force-dynamic";
export const viewport: Viewport = { themeColor: "#05080A" };

interface Loaded {
  club: string;
  status: string;
  demo: boolean;
  answers: Answers;
}

// cache(): generateMetadata and the page share one lookup per request.
const load = cache(async (token: string): Promise<Loaded | null> => {
  if (token === DEMO_TOKEN) {
    return {
      club: "Dunamis FC",
      status: "in_progress",
      demo: true,
      answers: { club: "Dunamis FC", current_site: "https://dunamisfc.com", location: "New York" },
    };
  }
  if (!/^[a-z0-9-]{4,64}$/.test(token)) return null;
  const brief = await prisma.clientBrief.findUnique({
    where: { token },
    select: { id: true, club: true, status: true, answers: true },
  });
  if (!brief) return null;
  // Best-effort "last opened" stamp for the admin view — never blocks or fails the page.
  void prisma.clientBrief.update({ where: { id: brief.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  return { club: brief.club, status: brief.status.toLowerCase(), demo: false, answers: sanitizeAnswers(brief.answers) };
});

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const brief = await load(token).catch(() => null);
  return {
    title: brief ? `${brief.club} · Website brief` : "Website brief",
    description: "Tell AIM Studio what your new website needs to do.",
    robots: { index: false, follow: false },
    alternates: { canonical: null },
  };
}

export default async function BriefPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const brief = await load(token);
  if (!brief) notFound();
  return (
    <BriefExperience
      token={token}
      club={brief.club}
      initialStatus={brief.status}
      initialAnswers={brief.answers}
      demo={brief.demo}
      fontClass={`${display.variable} ${mono.variable}`}
    />
  );
}
