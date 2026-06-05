"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import HeroRotator, { type HeroItem } from "./hero-rotator";

export type HeroDesktopItem = HeroItem & {
  type:           string;
  genre:          string | null;
  primaryLabel:   string;
  primaryHref:    string;
  secondaryLabel: string | null;
  secondaryHref:  string | null;
};

type Props = {
  items: HeroDesktopItem[];
};

const TYPE_LABELS: Record<string, string> = {
  FILM: "Film", SERIES: "Series", SHORT: "Short",
  COMMERCIAL: "Commercial", BRANDING: "Branding",
  CAMPAIGN: "Campaign", CASE_STUDY: "Case Study",
  TRAILER: "Trailer", IN_PRODUCTION: "In Production",
};

/**
 * Desktop cinematic hero (≥768px).
 *
 * Wraps HeroRotator so the CTA buttons update in sync with each rotating
 * slide. Also shows the active film title + type as a subtle secondary label,
 * and renders slide dot indicators at the bottom-right of the hero.
 */
export default function HeroDesktopSection({ items }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);

  const handleSlideChange = useCallback((idx: number) => {
    setActiveIdx(idx);
  }, []);

  const heroItems: HeroItem[] = items.map((item) => ({
    posterUrl:       item.posterUrl,
    title:           item.title,
    slug:            item.slug,
    heroMobileUrl:   item.heroMobileUrl,
    heroDesktopUrl:  item.heroDesktopUrl,
  }));

  const current = items[activeIdx] ?? items[0];
  const typeLabel = current?.type ? (TYPE_LABELS[current.type] ?? null) : null;

  return (
    <>
      <div className="hero-bg">
        <HeroRotator items={heroItems} onSlideChange={handleSlideChange} />
        <div className="hero-bg-gradient" />
      </div>

      <div className="hero-content">
        <span className="hero-eyebrow">— Now Streaming</span>

        {/* Active film title — subtle secondary context beneath eyebrow */}
        {current?.title && (
          <p className="hero-film-label">
            <span className="hero-film-label-dot" />
            {current.title}
            {(current.genre || typeLabel) && (
              <span className="hero-film-label-genre">
                {" · "}{current.genre ?? typeLabel}
              </span>
            )}
          </p>
        )}

        <h1 className="hero-title">Cinema, reimagined.</h1>
        <p className="hero-desc">
          Original cinema built around story, emotion, memory, and the moments people refuse to look away from.
        </p>
        <div className="hero-actions">
          {current?.primaryLabel ? (
            <Link href={current.primaryHref} className="hero-btn-primary">
              <Play size={16} fill="currentColor" /> {current.primaryLabel}
            </Link>
          ) : (
            <Link href={`/works/${current?.slug}`} className="hero-btn-primary">
              <Play size={16} fill="currentColor" /> View Details
            </Link>
          )}
          {current?.secondaryLabel && current?.secondaryHref && (
            <Link href={current.secondaryHref} className="hero-btn-trailer">
              {current.secondaryLabel}
            </Link>
          )}
          <Link href="/about" className="hero-btn-secondary">
            Find Your Way In
          </Link>
        </div>
      </div>

      {/* Slide indicators — bottom-right, desktop only */}
      {items.length > 1 && (
        <div className="hero-dots" aria-hidden="true">
          {items.map((_, i) => (
            <span
              key={i}
              className={`hero-dot${i === activeIdx ? " hero-dot--active" : ""}`}
            />
          ))}
        </div>
      )}
    </>
  );
}
