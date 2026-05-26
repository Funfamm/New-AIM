import Link from "next/link";
import Image from "next/image";
import { Lock, Play } from "lucide-react";

const TYPE_LABEL: Record<string, string> = {
  SHORT_FILM: "Short",
  FULL_FILM: "Film",
  SERIES: "Series",
  EPISODE: "Episode",
  TRAILER: "Trailer",
  COMMERCIAL: "Commercial",
  BRANDING: "Brand",
  CAMPAIGN: "Campaign",
  CASE_STUDY: "Case Study",
};

const STATUS_LABELS: Record<string, string> = {
  UPCOMING:      "Coming Soon",
  IN_PRODUCTION: "In Production",
};

type FilmCardProps = {
  slug: string;
  title: string;
  posterUrl?: string | null;
  genre?: string | null;
  requiresAuth?: boolean;
  isLoggedIn?: boolean;
  type?: string;
  status?: string;
  priority?: boolean;
  watchHref?: string;
};

export default function FilmCard({
  slug,
  title,
  posterUrl,
  genre,
  requiresAuth,
  isLoggedIn = false,
  type,
  status,
  priority = false,
  watchHref,
}: FilmCardProps) {
  const isUpcoming = status === "UPCOMING" || status === "IN_PRODUCTION";
  return (
    <Link
      href={watchHref ?? `/works/${slug}`}
      aria-label={`View ${watchHref ? "film" : "details for"} ${title}`}
      className="group relative block rounded cursor-pointer transition-[transform,box-shadow] duration-200 ease-out hover:scale-[1.04] hover:shadow-[0_8px_32px_rgba(0,0,0,0.6)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
      style={{ touchAction: "manipulation" }}
    >
      {/* Poster — image IS the card */}
      <div className="relative aspect-[2/3] overflow-hidden rounded bg-brand-surface">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={title}
            fill
            sizes="(max-width: 640px) calc(50vw - 1.5rem), (max-width: 768px) 160px, (max-width: 1024px) 180px, 220px"
            className="object-cover"
            quality={85}
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

        {/* Gradient */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0) 55%)" }}
          aria-hidden="true"
        />

        {/* Play overlay — appears on desktop hover */}
        <div
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
          aria-hidden="true"
        >
          <div style={{
            background: "rgba(0,0,0,0.55)", borderRadius: "50%",
            width: 44, height: 44,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Play size={16} fill="currentColor" style={{ color: "var(--color-brand-white)", marginLeft: 2 }} />
          </div>
        </div>

        {/* Genre + title */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          {genre && (
            <span className="mb-1 block font-body text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-brand-light">
              {genre}
            </span>
          )}
          <h3 className="font-body text-[1rem] font-semibold leading-snug tracking-tight text-brand-white line-clamp-2">
            {title}
          </h3>
        </div>

        {/* Type badge — top-left */}
        {type && TYPE_LABEL[type] && (
          <div
            className="absolute left-3 top-3"
            style={{
              background: "rgba(0,0,0,0.72)",
              padding: "0.2rem 0.4rem",
              borderRadius: 2,
            }}
          >
            <span style={{
              fontFamily: "var(--font-body)", fontSize: "0.6875rem",
              fontWeight: 600, letterSpacing: "0.08em",
              textTransform: "uppercase", color: "var(--color-brand-light)",
            }}>
              {TYPE_LABEL[type]}
            </span>
          </div>
        )}

        {/* Status badge — top-right for upcoming/in-production */}
        {isUpcoming && status && STATUS_LABELS[status] ? (
          <div
            className="absolute right-3 top-3"
            style={{
              background: "rgba(232,201,126,0.18)",
              border: "1px solid rgba(232,201,126,0.35)",
              padding: "0.2rem 0.45rem",
              borderRadius: 2,
            }}
          >
            <span style={{
              fontFamily: "var(--font-body)", fontSize: "0.6rem",
              fontWeight: 700, letterSpacing: "0.07em",
              textTransform: "uppercase", color: "var(--color-brand-accent)",
            }}>
              {STATUS_LABELS[status]}
            </span>
          </div>
        ) : (
          /* Lock badge — top-right (guests only, published content) */
          requiresAuth && !isLoggedIn && (
            <div
              className="absolute right-3 top-3 flex items-center rounded p-1 text-brand-accent"
              style={{ background: "rgba(0,0,0,0.72)" }}
              aria-label="Members only"
            >
              <Lock size={11} aria-hidden="true" />
            </div>
          )
        )}
      </div>
    </Link>
  );
}
