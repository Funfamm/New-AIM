"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChevronRight, ChevronLeft } from "lucide-react";
import FilmCard from "./film-card";

export type RailFilm = {
  id: string;
  slug: string;
  title: string;
  posterUrl?: string | null;
  heroMobileUrl?: string | null;
  genre?: string | null;
  requiresAuth?: boolean;
  requiresLoginToViewTrailer?: boolean | null;
  type?: string;
  status?: string;
  videoUrl?: string | null;
  trailerUrl?: string | null;
  watchHref?: string;
};

type FilmRailProps = {
  title: string;
  label?: string;
  href?: string;
  films: RailFilm[];
  priority?: boolean;
  isLoggedIn?: boolean;
};

export default function FilmRail({
  title,
  label,
  href,
  films,
  priority = false,
  isLoggedIn = false,
}: FilmRailProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canLeft,  setCanLeft]  = useState(false);
  const [canRight, setCanRight] = useState(false);

  const sync = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    sync();
    el.addEventListener("scroll",  sync, { passive: true });
    window.addEventListener("resize", sync, { passive: true });
    return () => {
      el.removeEventListener("scroll",  sync);
      window.removeEventListener("resize", sync);
    };
  }, [sync]);

  function scrollDir(dir: "left" | "right") {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "right" ? el.clientWidth * 0.72 : -(el.clientWidth * 0.72), behavior: "smooth" });
  }

  if (films.length === 0) return null;

  return (
    <section className="rail-section">
      <div className="container-app">
        <div className="rail-header">
          <div>
            {label && <span className="rail-eyebrow">{label}</span>}
            <div className="rail-title-row">
              <h2 className="rail-title">{title}</h2>
              {href && (
                <Link href={href} className="rail-view-all">
                  View All <ChevronRight size={14} />
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="rail-track-wrap">
          {/* Left scroll button — desktop only */}
          <button
            className={`rail-scroll-btn rail-scroll-btn--left${canLeft ? " rail-scroll-btn--visible" : ""}`}
            onClick={() => scrollDir("left")}
            aria-label="Scroll left"
            tabIndex={canLeft ? 0 : -1}
          >
            <ChevronLeft size={18} />
          </button>

          <div className="rail-track" ref={trackRef}>
            {films.map((film, i) => (
              <div key={film.id} className="rail-card">
                <FilmCard {...film} priority={priority && i < 4} isLoggedIn={isLoggedIn} />
              </div>
            ))}
          </div>

          {/* Right scroll button — desktop only */}
          <button
            className={`rail-scroll-btn rail-scroll-btn--right${canRight ? " rail-scroll-btn--visible" : ""}`}
            onClick={() => scrollDir("right")}
            aria-label="Scroll right"
            tabIndex={canRight ? 0 : -1}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}
