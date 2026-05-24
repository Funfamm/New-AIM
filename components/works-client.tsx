"use client";

import { useState, useMemo } from "react";
import FilmCard from "./film-card";
import HeroRotator from "./hero-rotator";

type Work = {
  id: string;
  slug: string;
  title: string;
  posterUrl: string | null;
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
        .map((w) => ({ posterUrl: w.posterUrl!, title: w.title })),
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

      <style>{`
        /* ── Hero ── */
        .wc-hero {
          position: relative;
          overflow: hidden;
          min-height: 420px;
          display: flex;
          align-items: flex-end;
          padding-bottom: 3rem;
          background-color: var(--color-brand-dark);
        }
        @media (min-width: 768px) { .wc-hero { min-height: 540px; } }
        .wc-hero-bg {
          position: absolute;
          inset: 0;
          z-index: 0;
        }
        .wc-hero-gradient {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to bottom,
            rgba(10,10,10,0.25) 0%,
            rgba(10,10,10,0.5)  45%,
            rgba(10,10,10,0.88) 75%,
            rgba(10,10,10,1)    100%
          );
        }
        .wc-hero-content {
          position: relative;
          z-index: 1;
        }
        .wc-eyebrow {
          font-family: var(--font-body); font-size: 0.6875rem; font-weight: 600;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--color-brand-accent); margin: 0 0 1rem;
        }
        .wc-title {
          font-family: var(--font-display);
          font-size: clamp(2rem, 5vw, 3.25rem);
          font-weight: 700; letter-spacing: -0.02em; line-height: 1.15;
          color: var(--color-brand-white); margin: 0 0 1rem;
        }
        .wc-subtitle {
          font-family: var(--font-body); font-size: 0.9375rem;
          color: var(--color-brand-light); max-width: 440px;
          line-height: 1.65; margin: 0 0 2rem; opacity: 0.82;
        }

        /* ── Search ── */
        .wc-search-wrap { position: relative; max-width: 480px; }
        .wc-search-icon {
          position: absolute; left: 1rem; top: 50%; transform: translateY(-50%);
          color: var(--color-brand-muted); pointer-events: none;
        }
        .wc-search {
          width: 100%; height: 48px;
          padding: 0 1rem 0 2.75rem;
          font-family: var(--font-body); font-size: 0.875rem;
          color: var(--color-brand-white);
          background: rgba(26,26,26,0.8);
          border: 1px solid rgba(42,42,42,0.8);
          border-radius: 2px; outline: none;
          transition: border-color 0.15s, background 0.15s;
          box-sizing: border-box;
          touch-action: manipulation;
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
        }
        .wc-search::placeholder { color: var(--color-brand-muted); }
        .wc-search:focus {
          border-color: var(--color-brand-light);
          background: var(--color-brand-surface);
        }
        .wc-search::-webkit-search-cancel-button { display: none; }

        /* ── Tabs ── */
        .wc-tabs-bar {
          position: sticky; top: 68px; z-index: 20;
          background: var(--color-brand-black);
          border-bottom: 1px solid var(--color-brand-border);
        }
        .wc-tabs {
          display: flex; overflow-x: auto; scrollbar-width: none;
        }
        .wc-tabs::-webkit-scrollbar { display: none; }
        .wc-tab {
          flex-shrink: 0;
          font-family: var(--font-body); font-size: 0.75rem; font-weight: 500;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--color-brand-muted);
          background: none; border: none;
          border-bottom: 2px solid transparent;
          padding: 0 1.5rem; height: 48px;
          cursor: pointer; white-space: nowrap;
          transition: color 0.15s, border-color 0.15s;
          touch-action: manipulation;
        }
        .wc-tab:hover { color: var(--color-brand-white); }
        .wc-tab--active {
          color: var(--color-brand-white);
          border-bottom-color: var(--color-brand-white);
        }

        /* ── Rails ── */
        .wc-rails { padding-bottom: 6rem; }
        .wc-rail { padding-top: 4rem; }
        @media (min-width: 768px) { .wc-rail { padding-top: 5rem; } }
        @media (min-width: 1024px) { .wc-rail { padding-top: 6rem; } }
        .wc-rail-head { margin-bottom: 1.5rem; }
        .wc-rail-eyebrow {
          display: block;
          font-family: var(--font-body); font-size: 0.6875rem; font-weight: 600;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--color-brand-muted); margin-bottom: 0.5rem;
        }
        .wc-rail-title {
          font-family: var(--font-body);
          font-size: 1.375rem;
          font-weight: 700; letter-spacing: -0.01em; line-height: 1.2;
          color: var(--color-brand-white); margin: 0;
        }

        /* ── Grid — same fixed card widths as rail-card ── */
        .wc-grid-wrap { padding: 3rem 0 6rem; }
        .wc-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
        }
        .wc-grid-item {
          flex: 0 0 calc(50% - 0.5rem);
        }
        @media (min-width: 640px) { .wc-grid-item { flex: 0 0 160px; } }
        @media (min-width: 768px) { .wc-grid-item { flex: 0 0 180px; } }
        @media (min-width: 1024px) { .wc-grid { gap: 1.25rem; } .wc-grid-item { flex: 0 0 220px; } }

        /* ── Empty ── */
        .wc-empty {
          padding: 6rem 0; text-align: center;
          font-family: var(--font-body); color: var(--color-brand-muted);
        }
      `}</style>
    </main>
  );
}
