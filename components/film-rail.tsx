import Link from "next/link";
import { ChevronRight } from "lucide-react";
import FilmCard from "./film-card";

export type RailFilm = {
  id: string;
  slug: string;
  title: string;
  posterUrl?: string | null;
  genre?: string | null;
  requiresAuth?: boolean;
};

type FilmRailProps = {
  title: string;
  label?: string;
  href?: string;
  films: RailFilm[];
  priority?: boolean;
};

export default function FilmRail({
  title,
  label,
  href,
  films,
  priority = false,
}: FilmRailProps) {
  if (films.length === 0) return null;

  return (
    <section className="pt-12 md:pt-16 lg:pt-24">
      <div className="container-app">
        <div className="mb-6">
          {label && (
            <span className="block font-body text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-brand-muted mb-2">
              {label}
            </span>
          )}
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-[1.375rem] font-bold text-brand-white tracking-[-0.02em] m-0">
              {title}
            </h2>
            {href && (
              <Link
                href={href}
                className="flex items-center gap-1 font-body text-[0.8rem] font-medium text-brand-muted hover:text-brand-white transition-colors duration-150 whitespace-nowrap ml-4"
              >
                View all <ChevronRight size={14} />
              </Link>
            )}
          </div>
        </div>
        <div className="rail-track">
          {films.map((film, i) => (
            <div key={film.id} className="rail-card">
              <FilmCard {...film} priority={priority && i < 4} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
