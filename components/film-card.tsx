import Link from "next/link";
import Image from "next/image";
import { Lock } from "lucide-react";

type FilmCardProps = {
  slug: string;
  title: string;
  posterUrl?: string | null;
  genre?: string | null;
  requiresAuth?: boolean;
  /** Pass true for above-fold cards (hero rail) to skip lazy-load */
  priority?: boolean;
};

export default function FilmCard({
  slug,
  title,
  posterUrl,
  genre,
  requiresAuth,
  priority = false,
}: FilmCardProps) {
  return (
    <Link
      href={`/works/${slug}`}
      aria-label={`Watch ${title}`}
      className="group relative block rounded transition-shadow duration-300 ease-out hover:shadow-[0_8px_32px_rgba(0,0,0,0.65)]"
    >
      {/* Poster — image IS the card */}
      <div className="relative aspect-[2/3] overflow-hidden rounded bg-brand-surface">
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
            className="flex h-full w-full items-center justify-center font-display text-[4rem] font-bold text-brand-border"
            aria-hidden="true"
          >
            {title.charAt(0)}
          </div>
        )}

        {/* Gradient — strong dark at bottom, fades out at mid-card */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0) 60%)",
          }}
          aria-hidden="true"
        />

        {/* Genre + title — anchored inside the poster */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          {genre && (
            <span className="mb-1 block font-body text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-brand-accent">
              {genre}
            </span>
          )}
          <h3 className="font-display text-[1.125rem] font-semibold leading-snug tracking-normal text-brand-white line-clamp-2">
            {title}
          </h3>
        </div>

        {/* Members-only lock badge */}
        {requiresAuth && (
          <div
            className="absolute right-3 top-3 flex items-center rounded p-1 text-brand-accent"
            style={{ background: "rgba(0,0,0,0.72)" }}
            aria-label="Members only"
          >
            <Lock size={11} aria-hidden="true" />
          </div>
        )}
      </div>
    </Link>
  );
}
