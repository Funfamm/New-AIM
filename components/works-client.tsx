"use client";

import { useState, useMemo } from "react";
import FilmCard from "./film-card";
import HeroRotator from "./hero-rotator";
import "./works-client.css";

type Work = {
  id: string;
  slug: string;
  title: string;
  posterUrl: string | null;
  heroMobileUrl: string | null;
  heroDesktopUrl: string | null;
  genre: string | null;
  requiresAuth: boolean;
  type: string;
};

type Tab = "ALL" | "FILMS" | "SERIES" | "TRAILERS" | "COMMERCIAL" | "PORTFOLIO";

const TAB_LABELS: Record<Tab, string> = {
  ALL: "All",
  FILMS: "Films",
  SERIES: "Series",
  TRAILERS: "Trailers",
  COMMERCIAL: "Commercial",
  PORTFOLIO: "Portfolio",
};

const TAB_TYPES: Record<Tab, string[] | null> = {
  ALL: null,
  FILMS: ["SHORT_FILM", "FULL_FILM"],
  SERIES: ["SERIES"],
  TRAILERS: ["TRAILER"],
  COMMERCIAL: ["COMMERCIAL"],
  PORTFOLIO: ["BRANDING", "CAMPAIGN", "CASE_STUDY"],
};

const RAILS: { key: Tab; title: string; eyebrow: string }[] = [
  { key: "FILMS",      title: "Films",      eyebrow: "— Short & Feature" },
  { key: "SERIES",     title: "Series",     eyebrow: "— Multi-Episode" },
  { key: "TRAILERS",   title: "Trailers",   eyebrow: "— Previews & Promos" },
  { key: "COMMERCIAL", title: "Commercial", eyebrow: "— Branded Content" },
  { key: "PORTFOLIO",  title: "Portfolio",  eyebrow: "— Brand & Strategy" },
];

export default function WorksClient({ works }: { works: Work[] }) {
  const [tab, setTab] = useState<Tab>("ALL");
  const [query, setQuery] = useState("");

  // Up to 5 works with poster art for the hero backdrop rotation
  const heroItems = useMemo(
    () =>
      works
        .filter((w) => w.posterUrl != null)
        .slice(0, 5)
        .map((w) => ({
          posterUrl: w.posterUrl!,
          title: w.title,
          slug: w.slug,
          heroMobileUrl: w.heroMobileUrl,
          heroDesktopUrl: w.heroDesktopUrl,
        })),
    [works]
  );

  const visibleTabs = useMemo<Tab[]>(() => {
    const extras = (Object.entries(TAB_TYPES) as [Tab, string[] | null][])
      .filter(([key, types]) => key !== "ALL" && types !== null && works.some((w) => types!.includes(w.type)))
      .map(([key]) => key);
    return extras.length > 0 ? ["ALL", ...extras] : [];
  }, [works]);

  const filtered = useMemo(() => {
    let list = works;
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (w) =>
          w.title.toLowerCase().includes(q) ||
          (w.genre?.toLowerCase() ?? "").includes(q)
      );
    }
    if (tab !== "ALL") {
      const types = TAB_TYPES[tab];
      if (types) list = list.filter((w) => types.includes(w.type));
    }
    return list;
  }, [works, tab, query]);

  const showRails = tab === "ALL" && query.trim() === "";

  // Priority images: first visible rail only
  const firstRailKey = useMemo(
    () => RAILS.find(({ key }) => works.some((w) => TAB_TYPES[key]!.includes(w.type)))?.key,
    [works]
  );

  return (
    <main>
      {/* ── Hero ─────────────────────────────────────── */}
      <section className="wc-hero">
        <div className="wc-hero-bg">
          <HeroRotator items={heroItems} />
          <div className="wc-hero-gradient" />
        </div>
        <div className="container-app wc-hero-content">
          <p className="wc-eyebrow">— All Works</p>
          <h1 className="wc-title">The Films</h1>
          <p className="wc-subtitle">
            Every story we&apos;ve told. Every world we&apos;ve built.
            Independent cinema for a new era.
          </p>
          <div className="wc-search-wrap">
            <svg className="wc-search-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true" width={16} height={16}>
              <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              placeholder="Search works…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="wc-search"
              aria-label="Search works"
            />
          </div>
        </div>
      </section>

      {/* ── Tabs ─────────────────────────────────────── */}
      {visibleTabs.length > 1 && (
        <div className="wc-tabs-bar">
          <div className="container-app">
            <div className="wc-tabs" role="tablist">
              {visibleTabs.map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  className={`wc-tab${tab === t ? " wc-tab--active" : ""}`}
                  onClick={() => setTab(t)}
                >
                  {TAB_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Content ──────────────────────────────────── */}
      {works.length === 0 ? (
        <div className="container-app wc-empty">
          <p>No works yet. Check back soon.</p>
        </div>
      ) : showRails ? (
        <div className="wc-rails">
          {RAILS.map(({ key, title, eyebrow }) => {
            const types = TAB_TYPES[key]!;
            const railWorks = works.filter((w) => types.includes(w.type));
            if (railWorks.length === 0) return null;
            return (
              <section key={key} className="wc-rail">
                <div className="container-app">
                  <div className="wc-rail-head">
                    <span className="wc-rail-eyebrow">{eyebrow}</span>
                    <h2 className="wc-rail-title">{title}</h2>
                  </div>
                  <div className="rail-track">
                    {railWorks.map((w, i) => (
                      <div key={w.id} className="rail-card">
                        <FilmCard {...w} priority={key === firstRailKey && i < 4} />
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="container-app wc-grid-wrap">
          {filtered.length === 0 ? (
            <div className="wc-empty">
              <p>No works match your search.</p>
            </div>
          ) : (
            <div className="wc-grid">
              {filtered.map((w, i) => (
                <div key={w.id} className="wc-grid-item">
                  <FilmCard {...w} priority={i < 4} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </main>
  );
}
