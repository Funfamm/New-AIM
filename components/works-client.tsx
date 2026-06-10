"use client";

import { useState, useEffect, useMemo } from "react";
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
  genres: string[];
  requiresAuth: boolean;
  requiresLoginToViewTrailer?: boolean | null;
  type: string;
  status: string;
  videoUrl?: string | null;
  trailerUrl?: string | null;
  previewClipUrl?: string | null;
  heroPreviewDuration?: number | null;
};

type Tab =
  | "ALL"
  | "UPCOMING"
  | "FILMS"
  | "SERIES"
  | "SHORTS"
  | "COMMERCIAL"
  | "BRANDING"
  | "CAMPAIGNS"
  | "TRAILERS"
  | "CASE_STUDY";

const UPCOMING_STATUSES = new Set(["UPCOMING", "IN_PRODUCTION"]);

const TAB_LABELS: Record<Tab, string> = {
  ALL:       "All",
  UPCOMING:  "Upcoming",
  FILMS:     "Films",
  SERIES:    "Series",
  SHORTS:    "Shorts",
  COMMERCIAL:"Commercial",
  BRANDING:  "Branding",
  CAMPAIGNS: "Campaigns",
  TRAILERS:  "Trailers",
  CASE_STUDY:"Case Studies",
};

// null = no type filter; "UPCOMING" tab uses status filter instead
const TAB_TYPES: Record<Tab, string[] | null> = {
  ALL:       null,
  UPCOMING:  null,   // filtered by status, not type
  FILMS:     ["FULL_FILM"],
  SERIES:    ["SERIES"],
  SHORTS:    ["SHORT_FILM"],
  COMMERCIAL:["COMMERCIAL"],
  BRANDING:  ["BRANDING"],
  CAMPAIGNS: ["CAMPAIGN"],
  TRAILERS:  ["TRAILER"],
  CASE_STUDY:["CASE_STUDY"],
};

const INITIAL_VISIBLE = 12;
const LOAD_MORE_STEP = 12;

// Maps ?collection= URL param → Tab key
const COLLECTION_TO_TAB: Record<string, Tab> = {
  all:           "ALL",
  upcoming:      "UPCOMING",
  films:         "FILMS",
  series:        "SERIES",
  shorts:        "SHORTS",
  commercials:   "COMMERCIAL",
  branding:      "BRANDING",
  campaigns:     "CAMPAIGNS",
  trailers:      "TRAILERS",
  "case-studies":"CASE_STUDY",
};

// Rails shown in ALL view.
// statusFilter: filter by work status instead of type (used for Upcoming).
type Rail = { key: Tab; title: string; eyebrow: string; statusFilter?: string[] };
const RAILS: Rail[] = [
  { key: "UPCOMING",   title: "Upcoming",     eyebrow: "— Coming Soon",       statusFilter: ["UPCOMING", "IN_PRODUCTION"] },
  { key: "FILMS",      title: "Films",        eyebrow: "— Feature Length" },
  { key: "SHORTS",     title: "Shorts",       eyebrow: "— Short Films" },
  { key: "SERIES",     title: "Series",       eyebrow: "— Multi-Episode" },
  { key: "COMMERCIAL", title: "Commercial",   eyebrow: "— Branded Content" },
  { key: "BRANDING",   title: "Branding",     eyebrow: "— Visual Identity" },
  { key: "CAMPAIGNS",  title: "Campaigns",    eyebrow: "— Brand Campaigns" },
  { key: "TRAILERS",   title: "Trailers",     eyebrow: "— Previews & Promos" },
  { key: "CASE_STUDY", title: "Case Studies", eyebrow: "— Strategy & Insight" },
];

type FeaturedHeroItem = {
  posterUrl: string;
  title: string;
  slug: string;
  heroMobileUrl?: string | null;
  heroDesktopUrl?: string | null;
  previewClipUrl?: string | null;
  previewClipDuration?: number | null;
};

type Props = {
  works: Work[];
  collection?: string;
  isLoggedIn?: boolean;
  featuredHeroItems?: FeaturedHeroItem[];
};

export default function WorksClient({ works, collection, isLoggedIn = false, featuredHeroItems }: Props) {
  const [tab, setTab] = useState<Tab>(() => {
    if (collection && COLLECTION_TO_TAB[collection]) return COLLECTION_TO_TAB[collection];
    return "ALL";
  });
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  // Sync URL collection param → tab on navigation
  useEffect(() => {
    const next =
      collection && COLLECTION_TO_TAB[collection]
        ? COLLECTION_TO_TAB[collection]
        : "ALL";
    setTab(next);
  }, [collection]);

  // Reset visible count whenever the active filter or search changes
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
  }, [tab, query]);

  // Published works — used for hero, rails, and tab filtering
  const publishedWorks = useMemo(() => works.filter((w) => w.status === "PUBLISHED"), [works]);

  // Admin-selected works hero items take priority; fall back to auto-select from published works.
  const heroItems = useMemo(() => {
    if (featuredHeroItems && featuredHeroItems.length > 0) return featuredHeroItems;
    return publishedWorks
      .filter((w) => !!(w.posterUrl ?? w.heroMobileUrl ?? w.heroDesktopUrl))
      .slice(0, 5)
      .map((w) => ({
        posterUrl:      (w.posterUrl ?? w.heroMobileUrl ?? w.heroDesktopUrl)!,
        title:          w.title,
        slug:           w.slug,
        heroMobileUrl:       w.heroMobileUrl,
        heroDesktopUrl:      w.heroDesktopUrl,
        previewClipUrl:      w.previewClipUrl ?? null,
        previewClipDuration: w.heroPreviewDuration ?? null,
      }));
  }, [featuredHeroItems, publishedWorks]);

  const visibleTabs = useMemo<Tab[]>(() => {
    const hasUpcoming = works.some((w) => UPCOMING_STATUSES.has(w.status));
    const extras = (Object.entries(TAB_TYPES) as [Tab, string[] | null][])
      .filter(([key, types]) =>
        key !== "ALL" && key !== "UPCOMING" &&
        types !== null && publishedWorks.some((w) => types!.includes(w.type))
      )
      .map(([key]) => key);
    const tabs: Tab[] = ["ALL"];
    if (hasUpcoming) tabs.push("UPCOMING");
    tabs.push(...extras);
    return tabs.length > 1 ? tabs : [];
  }, [works, publishedWorks]);

  const filtered = useMemo(() => {
    // UPCOMING tab: filter by status
    if (tab === "UPCOMING") {
      const list = works.filter((w) => UPCOMING_STATUSES.has(w.status));
      if (!query.trim()) return list;
      const q = query.toLowerCase();
      return list.filter((w) => w.title.toLowerCase().includes(q) || (w.genre?.toLowerCase() ?? "").includes(q));
    }

    // ALL: include every public work (published + upcoming/in-production)
    // Specific tabs: published works only
    let list = tab === "ALL" ? works : publishedWorks;
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
  }, [works, publishedWorks, tab, query]);

  const showRails = tab === "ALL" && query.trim() === "";

  const visibleWorks = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  // First rail that has content — used to prioritise image loading
  const firstRailKey = useMemo(
    () =>
      RAILS.find(({ key, statusFilter }) =>
        statusFilter
          ? works.some((w) => statusFilter.includes(w.status))
          : publishedWorks.some((w) => TAB_TYPES[key]!.includes(w.type))
      )?.key,
    [works, publishedWorks]
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
          <p>New stories are in the works. Check back soon.</p>
        </div>
      ) : showRails ? (
        <div className="wc-rails wc-animate-in">
          {RAILS.map((rail) => {
            const railWorks = rail.statusFilter
              ? works.filter((w) => rail.statusFilter!.includes(w.status))
              : publishedWorks.filter((w) => TAB_TYPES[rail.key]!.includes(w.type));
            if (railWorks.length === 0) return null;
            return (
              <section key={rail.key} className="wc-rail">
                <div className="container-app">
                  <div className="wc-rail-head">
                    <span className="wc-rail-eyebrow">{rail.eyebrow}</span>
                    <h2 className="wc-rail-title">{rail.title}</h2>
                  </div>
                  <div className="rail-track">
                    {railWorks.map((w, i) => (
                      <div key={w.id} className="rail-card">
                        <FilmCard {...w} priority={rail.key === firstRailKey && i < 4} isLoggedIn={isLoggedIn} />
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="container-app wc-grid-wrap wc-animate-in">
          {filtered.length === 0 ? (
            <div className="wc-empty">
              <p>Nothing matches that search. Try a different title or genre.</p>
            </div>
          ) : (
            <>
              <div className="wc-grid">
                {visibleWorks.map((w, i) => (
                  <div key={w.id} className="wc-grid-item">
                    <FilmCard {...w} priority={i < 4} isLoggedIn={isLoggedIn} />
                  </div>
                ))}
              </div>
              {hasMore && (
                <div className="wc-load-more-wrap">
                  <p className="wc-count-text">Showing {visibleCount} of {filtered.length} works</p>
                  <button
                    className="wc-load-more"
                    onClick={() => setVisibleCount((c) => c + LOAD_MORE_STEP)}
                  >
                    Load More Works
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

    </main>
  );
}
