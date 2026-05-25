// Home page — cinematic hero with rotating posters + work rails
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import FilmRail from "@/components/film-rail";
import HeroRotator from "@/components/hero-rotator";
import MobileFeaturedHero from "@/components/mobile-featured-hero";
import { Play, ChevronRight } from "lucide-react";
import "./home.css";

const HOME_SELECT = {
  id: true, slug: true, title: true, posterUrl: true,
  heroMobileUrl: true, heroDesktopUrl: true,
  genre: true, genres: true, requiresAuth: true, type: true,
} as const;

async function getHomeWorks() {
  const [featured, newReleases] = await Promise.all([
    prisma.work.findMany({
      where: { status: "PUBLISHED", showOnHome: true, featured: true, type: { not: "EPISODE" } },
      orderBy: { order: "asc" },
      take: 6,
      select: HOME_SELECT,
    }),
    prisma.work.findMany({
      where: { status: "PUBLISHED", showOnHome: true, type: { not: "EPISODE" } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: HOME_SELECT,
    }),
  ]);
  return { featured, newReleases };
}

async function getSavedIds(userId: string): Promise<string[]> {
  const saved = await prisma.savedWork.findMany({
    where: { userId },
    select: { workId: true },
    take: 100,
  });
  return saved.map((s) => s.workId);
}

async function getContinueWatching(userId: string) {
  const progress = await prisma.watchProgress.findMany({
    where: {
      userId,
      completed: false,
      seconds: { gt: 0 },
      work: { status: "PUBLISHED", type: { not: "TRAILER" } },
    },
    select: { work: { select: HOME_SELECT } },
    orderBy: { updatedAt: "desc" },
    take: 8,
  });
  return progress.map((p) => ({
    ...p.work,
    watchHref:
      p.work.type === "EPISODE" || p.work.type === "SERIES"
        ? `/watch/${p.work.slug}`
        : `/watch/${p.work.slug}?full=1`,
  }));
}

export default async function HomePage() {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const [{ featured, newReleases }, continueWatching, savedIds] = await Promise.all([
    getHomeWorks(),
    userId
      ? getContinueWatching(userId)
      : Promise.resolve([] as Awaited<ReturnType<typeof getContinueWatching>>),
    userId ? getSavedIds(userId) : Promise.resolve<string[]>([]),
  ]);

  const featuredWithPosters = featured.filter((w) => w.posterUrl != null).slice(0, 5);

  const heroItems = featuredWithPosters.map((w) => ({
    posterUrl: w.posterUrl!,
    title: w.title,
    slug: w.slug,
    heroMobileUrl: w.heroMobileUrl,
    heroDesktopUrl: w.heroDesktopUrl,
  }));

  const mobileHeroItems = featuredWithPosters.map((w) => ({
    id: w.id,
    slug: w.slug,
    title: w.title,
    posterUrl: w.posterUrl!,
    heroMobileUrl: w.heroMobileUrl,
    requiresAuth: w.requiresAuth,
    genres: w.genres,
    type: w.type,
  }));

  const isEmpty = featured.length === 0 && newReleases.length === 0;

  return (
    <main>
      {/* ── Mobile streaming-style hero (<768px) ─────── */}
      <MobileFeaturedHero
        items={mobileHeroItems}
        isLoggedIn={!!userId}
        savedIds={savedIds}
      />

      {/* ── Desktop cinematic hero (≥768px) ──────────── */}
      <section className="hero">
        <div className="hero-bg">
          <HeroRotator items={heroItems} />
          <div className="hero-bg-gradient" />
        </div>
        <div className="hero-content">
          <span className="hero-eyebrow">— Now Streaming</span>
          <h1 className="hero-title">Cinema, reimagined.</h1>
          <p className="hero-desc">We make films, series, and creative work with AI tools built around story, emotion, memory, and impact. Don&apos;t look away.</p>
          <div className="hero-actions">
            <Link href="/works" className="hero-btn-primary">
              <Play size={16} fill="currentColor" /> Watch Our Films
            </Link>
            <Link href="/about" className="hero-btn-secondary">
              Find Your Way In
            </Link>
          </div>
        </div>
      </section>

      {/* ── Continue Watching ───────────────────────── */}
      {continueWatching.length > 0 && (
        <FilmRail title="Continue Watching" films={continueWatching.map(w => ({ ...w, requiresAuth: false }))} />
      )}

      {/* ── Featured Works ──────────────────────────── */}
      <FilmRail
        title="Featured Works"
        label="— Now Streaming"
        href="/works"
        films={featured}
        priority
      />

      {/* ── New Releases ────────────────────────────── */}
      <FilmRail title="New Releases" label="— Latest Work" href="/works" films={newReleases} />

      {/* ── Empty state ─────────────────────────────── */}
      {isEmpty && (
        <section className="home-empty">
          <div className="container-app">
            <p className="home-empty-text">We&apos;re cooking. The first films drop soon.</p>
          </div>
        </section>
      )}

      {/* ── Brand strip ─────────────────────────────── */}
      {!isEmpty && (
        <div className="brand-strip">
          <div className="container-app">
            <p className="brand-strip-text">
              Stories That Matter&nbsp;&nbsp;·&nbsp;&nbsp;No Story Too Small&nbsp;&nbsp;·&nbsp;&nbsp;Every Frame, On Purpose.
            </p>
          </div>
        </div>
      )}

      {/* ── Studio Statement ────────────────────────── */}
      <section className="studio-statement">
        <div className="container-app">
          <blockquote className="statement-quote">
            Films that couldn&apos;t exist before now.
          </blockquote>
          <Link href="/about" className="statement-link">
            Our Story <ChevronRight size={14} />
          </Link>
        </div>
      </section>

    </main>
  );
}
