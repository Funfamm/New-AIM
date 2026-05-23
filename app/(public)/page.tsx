// Home page — cinematic hero + New Releases + Staff Picks rails
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import FilmCard from "@/components/film-card";
import { Play, ChevronRight } from "lucide-react";

const FILM_FIELDS = {
  id: true, slug: true, title: true, posterUrl: true,
  year: true, duration: true, genre: true, requiresAuth: true,
  description: true, trailerUrl: true,
} as const;

async function getHomeFilms() {
  const [newReleases, staffPicks] = await Promise.all([
    prisma.film.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: FILM_FIELDS,
    }),
    prisma.film.findMany({
      where: { isPublic: true },
      orderBy: { order: "asc" },
      take: 8,
      select: FILM_FIELDS,
    }),
  ]);
  return { newReleases, staffPicks };
}

export default async function HomePage() {
  const { newReleases, staffPicks } = await getHomeFilms();
  const hero = staffPicks[0] ?? null;

  return (
    <main>
      {/* ── Hero ─────────────────────────────────────── */}
      <section className="hero">
        <div className="hero-bg">
          {hero?.posterUrl && (
            <Image
              src={hero.posterUrl}
              alt=""
              fill
              priority
              style={{
                objectFit: "cover",
                objectPosition: "center top",
                opacity: 0.35,
              }}
              aria-hidden={true}
            />
          )}
          <div className="hero-bg-gradient" />
        </div>
        <div className="container-app hero-content">
          <div className="hero-eyebrow">
            <span className="hero-badge">Now Streaming</span>
          </div>
          <h1 className="hero-title">
            {hero ? hero.title : "AI-Generated\nCinema"}
          </h1>
          <p className="hero-desc">
            {hero?.description ??
              "Groundbreaking films created with artificial intelligence. Stream trailers, discover new works, and experience the future of storytelling."}
          </p>
          <div className="hero-actions">
            {hero ? (
              <>
                <Link href={`/watch/${hero.slug}`} className="hero-btn-primary">
                  <Play size={16} fill="currentColor" /> Watch Trailer
                </Link>
                <Link href={`/works/${hero.slug}`} className="hero-btn-secondary">
                  Learn More
                </Link>
              </>
            ) : (
              <Link href="/works" className="hero-btn-primary">
                <Play size={16} fill="currentColor" /> Browse Films
              </Link>
            )}
          </div>
        </div>
        <div className="hero-scroll-hint">scroll</div>
      </section>

      {/* ── New Releases rail ────────────────────────── */}
      {newReleases.length > 0 && (
        <section className="section container-app">
          <div className="section-header">
            <h2 className="section-title">New Releases</h2>
            <Link href="/works" className="section-more">
              All Films <ChevronRight size={14} />
            </Link>
          </div>
          <div className="film-rail">
            {newReleases.map((f, i) => (
              <div key={f.id} className="film-rail-card">
                <FilmCard {...f} priority={i < 3} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Staff Picks rail ─────────────────────────── */}
      {staffPicks.length > 0 && (
        <section className="section section--compact container-app">
          <div className="section-header">
            <h2 className="section-title">Staff Picks</h2>
          </div>
          <div className="film-rail">
            {staffPicks.map((f) => (
              <div key={f.id} className="film-rail-card">
                <FilmCard {...f} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Empty state (no public films yet) ────────── */}
      {newReleases.length === 0 && staffPicks.length === 0 && (
        <section className="section container-app">
          <div className="empty-state">
            <p>Films coming soon. Check back shortly.</p>
          </div>
        </section>
      )}

      {/* ── About strip ──────────────────────────────── */}
      <section className="about-strip">
        <div className="container-app about-strip-inner">
          <div className="about-strip-text">
            <h2 className="about-strip-title">The Future of Film is Here</h2>
            <p className="about-strip-desc">
              AIM Studio creates AI-generated films that push the boundaries of
              storytelling. Watch trailers, follow your favourite creators, and
              stream full films on any device.
            </p>
            <Link href="/about" className="about-strip-link">
              Our Story <ChevronRight size={14} />
            </Link>
          </div>
          <div className="about-strip-stats">
            <div className="stat">
              <span className="stat-num">AI</span>
              <span className="stat-label">Generated</span>
            </div>
            <div className="stat">
              <span className="stat-num">4K</span>
              <span className="stat-label">Quality</span>
            </div>
            <div className="stat">
              <span className="stat-num">∞</span>
              <span className="stat-label">Stories</span>
            </div>
          </div>
        </div>
      </section>

      <style>{`
        /* ── Hero ── */
        .hero {
          position: relative;
          min-height: 92dvh;
          display: flex;
          align-items: flex-end;
          padding-bottom: 5rem;
          overflow: hidden;
        }
        .hero-bg {
          position: absolute;
          inset: 0;
          z-index: 0;
        }
        .hero-bg-gradient {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to bottom,
            rgba(10,10,10,0.3) 0%,
            rgba(10,10,10,0.1) 30%,
            rgba(10,10,10,0.85) 75%,
            rgba(10,10,10,1) 100%
          );
        }
        .hero-content {
          position: relative;
          z-index: 1;
          max-width: 680px;
          animation: fadeUp 0.9s ease both;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .hero-eyebrow { margin-bottom: 1rem; }
        .hero-badge {
          font-family: var(--font-body);
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--color-brand-accent);
          border: 1px solid var(--color-brand-accent);
          padding: 0.25rem 0.75rem;
          border-radius: 2px;
        }
        .hero-title {
          font-family: var(--font-display);
          font-size: clamp(2.4rem, 7vw, 5rem);
          font-weight: 900;
          line-height: 1.05;
          color: var(--color-brand-white);
          margin: 0 0 1.25rem;
          white-space: pre-line;
        }
        .hero-desc {
          font-family: var(--font-body);
          font-size: clamp(0.95rem, 2vw, 1.1rem);
          color: var(--color-brand-light);
          line-height: 1.7;
          max-width: 520px;
          margin-bottom: 2rem;
          opacity: 0.85;
        }
        .hero-actions { display: flex; gap: 1rem; flex-wrap: wrap; }
        .hero-btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-family: var(--font-body);
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--color-brand-black);
          background: var(--color-brand-accent);
          padding: 0.75rem 1.75rem;
          border-radius: 4px;
          text-decoration: none;
          transition: opacity 0.2s, transform 0.2s;
        }
        .hero-btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }
        .hero-btn-secondary {
          display: inline-flex;
          align-items: center;
          font-family: var(--font-body);
          font-size: 0.9rem;
          font-weight: 500;
          color: var(--color-brand-white);
          border: 1px solid rgba(255,255,255,0.25);
          padding: 0.75rem 1.75rem;
          border-radius: 4px;
          text-decoration: none;
          transition: border-color 0.2s, background 0.2s;
        }
        .hero-btn-secondary:hover {
          border-color: var(--color-brand-white);
          background: rgba(255,255,255,0.05);
        }
        .hero-scroll-hint {
          position: absolute;
          bottom: 1.5rem;
          left: 50%;
          transform: translateX(-50%);
          font-family: var(--font-body);
          font-size: 0.65rem;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--color-brand-muted);
          animation: bounce 2s ease-in-out infinite;
        }
        @keyframes bounce {
          0%,100% { transform: translateX(-50%) translateY(0); }
          50%      { transform: translateX(-50%) translateY(6px); }
        }

        /* ── Sections ── */
        .section { padding: 5rem 0; }
        .section--compact { padding-top: 0; }
        .section-header {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          margin-bottom: 1.75rem;
        }
        .section-title {
          font-family: var(--font-display);
          font-size: clamp(1.3rem, 3.5vw, 1.8rem);
          font-weight: 700;
          color: var(--color-brand-white);
          margin: 0;
        }
        .section-more {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          font-family: var(--font-body);
          font-size: 0.8rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-brand-accent);
          text-decoration: none;
          transition: gap 0.2s;
        }
        .section-more:hover { gap: 0.5rem; }

        /* ── Film rail (horizontal scroll) ── */
        .film-rail {
          display: flex;
          gap: 0.875rem;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          /* breathing room so card lift + border-glow aren't clipped */
          padding: 6px 2px 12px;
          margin: -6px -2px -12px;
        }
        .film-rail::-webkit-scrollbar { display: none; }
        .film-rail-card {
          flex: 0 0 155px;
          scroll-snap-align: start;
        }
        @media (min-width: 480px) {
          .film-rail-card { flex-basis: 175px; }
        }
        @media (min-width: 768px) {
          .film-rail { gap: 1rem; }
          .film-rail-card { flex-basis: 200px; }
        }
        @media (min-width: 1024px) {
          .film-rail-card { flex-basis: 220px; }
        }

        .empty-state {
          text-align: center;
          padding: 5rem 0;
          color: var(--color-brand-muted);
          font-family: var(--font-body);
        }

        /* ── About strip ── */
        .about-strip {
          background: var(--color-brand-dark);
          border-top: 1px solid var(--color-brand-border);
          border-bottom: 1px solid var(--color-brand-border);
          padding: 4rem 0;
        }
        .about-strip-inner {
          display: flex;
          flex-direction: column;
          gap: 2.5rem;
        }
        @media (min-width: 768px) {
          .about-strip-inner {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
          }
        }
        .about-strip-text { max-width: 520px; }
        .about-strip-title {
          font-family: var(--font-display);
          font-size: clamp(1.4rem, 3vw, 1.9rem);
          font-weight: 700;
          color: var(--color-brand-white);
          margin: 0 0 0.75rem;
        }
        .about-strip-desc {
          font-family: var(--font-body);
          font-size: 0.95rem;
          color: var(--color-brand-muted);
          line-height: 1.7;
          margin: 0 0 1.25rem;
        }
        .about-strip-link {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          font-family: var(--font-body);
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--color-brand-accent);
          text-decoration: none;
          transition: gap 0.2s;
        }
        .about-strip-link:hover { gap: 0.5rem; }
        .about-strip-stats {
          display: flex;
          gap: 2.5rem;
          flex-shrink: 0;
        }
        .stat { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; }
        .stat-num {
          font-family: var(--font-display);
          font-size: 2rem;
          font-weight: 900;
          color: var(--color-brand-accent);
          line-height: 1;
        }
        .stat-label {
          font-family: var(--font-body);
          font-size: 0.65rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--color-brand-muted);
        }
      `}</style>
    </main>
  );
}
