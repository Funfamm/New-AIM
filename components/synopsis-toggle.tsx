"use client";
import { useState } from "react";
import type { CSSProperties } from "react";

export default function SynopsisToggle({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);

  const clampStyle: CSSProperties = expanded
    ? { margin: 0 }
    : {
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
        margin: 0,
      };

  return (
    <div className="synopsis-wrap">
      <p className="detail-desc" style={clampStyle}>
        {text}
      </p>
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="synopsis-toggle"
      >
        {expanded ? "Less" : "More"}
      </button>
      <style>{`
        .synopsis-wrap { margin-bottom: 2rem; }
        .synopsis-toggle {
          display: block;
          margin-top: 0.5rem;
          font-family: var(--font-body); font-size: 0.75rem; font-weight: 600;
          letter-spacing: 0.06em; text-transform: uppercase;
          color: var(--color-brand-muted); background: none; border: none;
          cursor: pointer; padding: 0; transition: color 0.15s;
        }
        .synopsis-toggle:hover { color: var(--color-brand-white); }
      `}</style>
    </div>
  );
}
