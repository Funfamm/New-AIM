import { prisma } from "@/lib/prisma";
import FilmCard from "@/components/film-card";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Works" };

async function getWorks() {
  return prisma.work.findMany({
    where: { status: "PUBLISHED", type: { not: "EPISODE" } },
    orderBy: { order: "asc" },
    select: {
      id: true, slug: true, title: true, posterUrl: true,
      genre: true, requiresAuth: true, type: true,
    },
  });
}

export default async function WorksPage() {
  const works = await getWorks();

  const genres = ["All", ...Array.from(
    new Set(works.map((w) => w.genre).filter(Boolean) as string[])
  )];

  return (
    <main className="works-page">
      <div className="container-app">
        <div className="works-header">
          <h1 className="works-title">Our Works</h1>
          <p className="works-subtitle">
            AI-generated films, series, and creative projects crafted at the intersection of technology and storytelling.
          </p>
        </div>

        {genres.length > 1 && (
          <div className="genre-pills">
            {genres.map((g) => (
              <span key={g} className="genre-pill">{g}</span>
            ))}
          </div>
        )}

        {works.length > 0 ? (
          <div className="works-grid">
            {works.map((w) => (
              <FilmCard key={w.id} {...w} />
            ))}
          </div>
        ) : (
          <div className="works-empty">
            <p>No works available yet. Check back soon.</p>
          </div>
        )}
      </div>

      <style>{`
        .works-page { padding: 4rem 0 6rem; }
        .works-header { padding: 2rem 0 2.5rem; }
        .works-title {
          font-family: var(--font-display);
          font-size: clamp(2rem, 6vw, 3.5rem);
          font-weight: 700;
          letter-spacing: -0.02em;
          color: var(--color-brand-white);
          margin: 0 0 0.75rem;
        }
        .works-subtitle {
          font-family: var(--font-body); font-size: 1rem;
          color: var(--color-brand-muted); max-width: 480px;
          line-height: 1.6; margin: 0;
        }
        .genre-pills { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 2.5rem; }
        .genre-pill {
          font-family: var(--font-body); font-size: 0.75rem; font-weight: 500;
          letter-spacing: 0.06em; text-transform: uppercase;
          color: var(--color-brand-muted); border: 1px solid var(--color-brand-border);
          padding: 0.35rem 0.85rem; border-radius: 2px; cursor: pointer;
          transition: color 0.2s, border-color 0.2s;
        }
        .genre-pill:hover { color: var(--color-brand-white); border-color: var(--color-brand-white); }
        .works-grid {
          display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;
        }
        @media (min-width: 640px)  { .works-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (min-width: 1024px) { .works-grid { grid-template-columns: repeat(4, 1fr); gap: 1.25rem; } }
        .works-empty {
          text-align: center; padding: 6rem 0;
          color: var(--color-brand-muted); font-family: var(--font-body);
        }
      `}</style>
    </main>
  );
}
