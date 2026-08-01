"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import HeroVideoBg from "./hero-video-bg";
import "./hero-rotator.css";

export type HeroItem = {
  posterUrl: string;
  title: string;
  slug: string;
  heroMobileUrl?: string | null;
  heroDesktopUrl?: string | null;
  /** Desktop-only preview clip (mp4 or .m3u8). Mobile always keeps static image. */
  previewClipUrl?: string | null;
  /** Seconds to play the preview before returning to poster. Null = 12 s default. */
  previewClipDuration?: number | null;
};

type Props = {
  items: HeroItem[];
  interval?: number; // ms between slides, default 4s
  onSlideChange?: (index: number) => void;
};

export default function HeroRotator({ items, interval = 4000, onSlideChange }: Props) {
  const [active, setActive] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Ref-based lock: skip rotation ticks while a preview video is playing
  const previewActiveRef = useRef(false);

  // Notify parent when active slide changes
  useEffect(() => {
    onSlideChange?.(active);
  }, [active, onSlideChange]);

  useEffect(() => {
    if (items.length <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    timer.current = setInterval(() => {
      if (previewActiveRef.current) return; // hold slide while preview is playing
      setActive((i) => (i + 1) % items.length);
    }, interval);

    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [items.length, interval]);

  if (!items.length) return null;

  return (
    <div className="hr-stack">
      {items.map((item, i) => {
        const isActive = i === active;
        const hasArtDirection = !!(item.heroDesktopUrl || item.heroMobileUrl);

        return (
          <div
            key={i}
            className={`hr-slide${isActive ? " hr-slide--active" : ""}`}
          >
            <Link
              href={`/works/${item.slug}`}
              className="hr-slide-link"
              aria-label={`View details for ${item.title}`}
              tabIndex={isActive ? 0 : -1}
            >
              {hasArtDirection ? (
                /* Native <picture> for 4G-safe art direction —
                   browser downloads only the source that matches the viewport */
                <picture className="hr-picture">
                  {item.heroDesktopUrl && (
                    <source media="(min-width: 768px)" srcSet={item.heroDesktopUrl} />
                  )}
                  {/* Mobile: heroMobileUrl if set, else posterUrl */}
                  <img
                    src={item.heroMobileUrl ?? item.posterUrl}
                    alt=""
                    className="hr-img-native"
                    loading={i === 0 ? "eager" : "lazy"}
                    fetchPriority={i === 0 ? "high" : "low"}
                  />
                </picture>
              ) : (
                /* No art direction: use next/image for optimization */
                <Image
                  src={item.posterUrl}
                  alt=""
                  fill
                  className="hr-img"
                  sizes="100vw"
                  quality={85}
                  priority={i === 0}
                />
              )}
            </Link>

            {/* Desktop-only preview video — renders nothing on mobile/slow networks */}
            {item.previewClipUrl && (
              <HeroVideoBg
                src={item.previewClipUrl}
                isActive={isActive}
                previewMs={(item.previewClipDuration ?? 12) * 1000}
                onPlayingChange={(playing) => { previewActiveRef.current = playing; }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
