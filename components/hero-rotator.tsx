"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

export type HeroItem = {
  posterUrl: string;
  title: string;
};

type Props = {
  items: HeroItem[];
  interval?: number; // ms between slides, default 6s
};

export default function HeroRotator({ items, interval = 6000 }: Props) {
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
    <div className="hr-stack" aria-hidden="true">
      {items.map((item, i) => (
        <div
          key={i}
          className="hr-slide"
          style={{ opacity: i === active ? 1 : 0 }}
        >
          <Image
            src={item.posterUrl}
            alt=""
            fill
            sizes="100vw"
            quality={85}
            priority={i === 0}
            style={{ objectFit: "cover", objectPosition: "center top" }}
          />
        </div>
      ))}
      <style>{`
        .hr-stack { position: absolute; inset: 0; }
        .hr-slide {
          position: absolute; inset: 0;
          transition: opacity 0.8s ease;
        }
        @media (prefers-reduced-motion: reduce) {
          .hr-slide { transition: none; }
        }
      `}</style>
    </div>
  );
}
