"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import "./hero-rotator.css";

export type HeroItem = {
  posterUrl: string;
  title: string;
  slug: string;
};

type Props = {
  items: HeroItem[];
  interval?: number; // ms between slides, default 4s
};

export default function HeroRotator({ items, interval = 4000 }: Props) {
  const [active, setActive] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (items.length <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    timer.current = setInterval(() => {
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
        return (
          <div
            key={i}
            className="hr-slide"
            style={{
              opacity: isActive ? 1 : 0,
              pointerEvents: isActive ? "auto" : "none",
            }}
          >
            {/*
              Art direction hook: when heroMobileUrl / heroDesktopUrl exist,
              replace the Image below with a <picture> element using
              <source media="(min-width: 768px)" srcSet={heroDesktopUrl} />
              so the browser only downloads the appropriate source.
            */}
            <Link
              href={`/works/${item.slug}`}
              className="hr-slide-link"
              aria-label={`View details for ${item.title}`}
              tabIndex={isActive ? 0 : -1}
            >
              <Image
                src={item.posterUrl}
                alt=""
                fill
                className="hr-img"
                sizes="100vw"
                quality={85}
                priority={i === 0}
              />
            </Link>
          </div>
        );
      })}
    </div>
  );
}
