import Link from "next/link";
import Image from "next/image";
import { Clock, Calendar, Lock } from "lucide-react";

type FilmCardProps = {
  slug: string;
  title: string;
  posterUrl?: string | null;
  year?: number | null;
  duration?: number | null;
  genre?: string | null;
  requiresAuth?: boolean;
  /** Pass true for above-fold cards (hero, first rail) to skip lazy-load */
  priority?: boolean;
};

export default function FilmCard({
  slug,
  title,
  posterUrl,
  year,
  duration,
  genre,
  requiresAuth,
  priority = false,
}: FilmCardProps) {
  const durationLabel =
    duration !== null && duration !== undefined
      ? duration >= 60
        ? `${Math.floor(duration / 60)}h ${duration % 60}m`
        : `${duration}m`
      : null;

  return (
    <Link
      href={`/works/${slug}`}
      aria-label={`Watch ${title}`}
      className="group block rounded-sm overflow-hidden bg-brand-dark border border-brand-border transition-[transform,border-color] duration-200 ease-out hover:border-brand-accent hover:-translate-y-1"
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] overflow-hidden bg-brand-surface">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
            priority={priority}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center font-display text-[4rem] font-black text-brand-border"
            aria-hidden="true"
          >
            {title.charAt(0)}
          </div>
        )}

        {/* Bottom gradient — always visible, darkens for readability */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to top, rgba(10,10,10,0.75) 0%, transparent 55%)",
          }}
          aria-hidden="true"
        />

        {/* Members-only lock badge */}
        {requiresAuth && (
          <div
            className="absolute top-2 right-2 flex items-center rounded p-1 text-brand-accent"
            style={{ background: "rgba(10,10,10,0.82)" }}
            aria-label="Members only"
          >
            <Lock size={11} aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-3.5 pt-3 pb-3.5">
        {genre && (
          <span className="block mb-1.5 font-body text-[0.65rem] font-semibold uppercase tracking-widest text-brand-accent">
            {genre}
          </span>
        )}
        <h3 className="font-display text-[1rem] font-bold leading-snug text-brand-white mb-2 line-clamp-2">
          {title}
        </h3>
        {(year || durationLabel) && (
          <div className="flex items-center gap-3 flex-wrap">
            {year && (
              <span className="flex items-center gap-1 font-body text-[0.72rem] text-brand-muted">
                <Calendar size={11} aria-hidden="true" />
                {year}
              </span>
            )}
            {durationLabel && (
              <span className="flex items-center gap-1 font-body text-[0.72rem] text-brand-muted">
                <Clock size={11} aria-hidden="true" />
                {durationLabel}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
