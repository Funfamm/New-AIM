"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play } from "lucide-react";
import SaveButton from "./save-button";
import "./mobile-featured-hero.css";

export type MobileHeroItem = {
  id: string;
  slug: string;
  title: string;
  posterUrl: string;
  heroMobileUrl?: string | null;
  requiresAuth: boolean;
  genres: string[];
  type: string;
};

// Pill definitions: shown only if at least one requiredType has published content
const PILL_DEFS: { label: string; collection: string; requiredTypes: string[] }[] = [
  { label: "Films",      collection: "films",       requiredTypes: ["SHORT_FILM", "FULL_FILM"] },
  { label: "Series",     collection: "series",      requiredTypes: ["SERIES"] },
  { label: "Shorts",     collection: "shorts",      requiredTypes: ["SHORT_FILM"] },
  { label: "Commercial", collection: "commercials", requiredTypes: ["COMMERCIAL"] },
  { label: "Branding",   collection: "branding",    requiredTypes: ["BRANDING"] },
  { label: "Campaigns",  collection: "campaigns",   requiredTypes: ["CAMPAIGN"] },
];

type Props = {
  items: MobileHeroItem[];
  isLoggedIn: boolean;
  savedIds: string[];
  availableTypes: string[];
};

export default function MobileFeaturedHero({ items, isLoggedIn, savedIds, availableTypes }: Props) {
  const [active, setActive] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (items.length <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    timerRef.current = setInterval(() => {
      setActive((prev) => (prev + 1) % items.length);
    }, 7000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [items.length]);

  if (!items.length) return null;

  return (
    <section className="mfh" aria-label="Featured works">

      {/* ── Category pills ── */}
      <div className="mfh-pills-wrap">
        <div className="mfh-pills">
          {/* "All" pill — always shown */}
          <Link href="/works" className="mfh-pill">All</Link>

          {/* Category pills — only if at least one requiredType has published content */}
          {PILL_DEFS
            .filter((p) => p.requiredTypes.some((t) => availableTypes.includes(t)))
            .map((p) => (
              <Link key={p.label} href={`/works?collection=${p.collection}`} className="mfh-pill">
                {p.label}
              </Link>
            ))
          }
        </div>
      </div>

      {/* ── Hero card stack ── */}
      <div className="mfh-slides-wrap">
        <div className="mfh-slides">
          {items.map((item, i) => {
            const isActive = i === active;
            const watchHref =
              item.type === "SERIES"
                ? `/watch/${item.slug}`
                : `/watch/${item.slug}?full=1`;
            const signInHref = `/login?from=${encodeURIComponent(watchHref)}`;

            return (
              <div
                key={item.id}
                className={`mfh-slide${isActive ? " mfh-slide--active" : ""}`}
                aria-hidden={isActive ? undefined : true}
              >
                <div className="mfh-card">

                  {/* Background link — navigates to detail page */}
                  <Link
                    href={`/works/${item.slug}`}
                    className="mfh-card-link"
                    aria-label={`View details for ${item.title}`}
                    tabIndex={isActive ? 0 : -1}
                  />

                  {/* Poster image */}
                  <div className="mfh-img-wrap">
                    {item.heroMobileUrl ? (
                      <img
                        src={item.heroMobileUrl}
                        alt=""
                        className="mfh-img"
                        loading={i === 0 ? "eager" : "lazy"}
                      />
                    ) : (
                      <Image
                        src={item.posterUrl}
                        alt=""
                        fill
                        className="mfh-img"
                        sizes="(max-width: 767px) 100vw"
                        quality={88}
                        priority={i === 0}
                      />
                    )}
                  </div>

                  {/* Gradient overlay */}
                  <div className="mfh-gradient" aria-hidden="true" />

                  {/* Genres + title + buttons */}
                  <div className="mfh-card-content">
                    {item.genres.length > 0 && (
                      <p className="mfh-genres">
                        {item.genres.slice(0, 3).join(" · ")}
                      </p>
                    )}
                    <h2 className="mfh-title">{item.title}</h2>
                    <div className="mfh-actions">
                      {item.requiresAuth && !isLoggedIn ? (
                        <Link href={signInHref} className="mfh-btn-play">
                          <Play size={14} fill="currentColor" />
                          Sign In to Watch
                        </Link>
                      ) : (
                        <Link href={watchHref} className="mfh-btn-play">
                          <Play size={14} fill="currentColor" />
                          Watch
                        </Link>
                      )}
                      {isLoggedIn && (
                        <SaveButton
                          workId={item.id}
                          initialSaved={savedIds.includes(item.id)}
                          className="mfh-btn-save"
                        />
                      )}
                    </div>
                  </div>

                </div>
              </div>
            );
          })}
        </div>

        {/* Dot indicators */}
        {items.length > 1 && (
          <div className="mfh-dots" aria-hidden="true">
            {items.map((_, i) => (
              <span
                key={i}
                className={`mfh-dot${i === active ? " mfh-dot--active" : ""}`}
              />
            ))}
          </div>
        )}
      </div>

    </section>
  );
}
