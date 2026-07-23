"use client";

import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";

// Client-only copy-to-clipboard control. Takes pre-formatted text (built on the
// server) so the page itself can stay a Server Component. Falls back to a hidden
// textarea + execCommand for non-secure contexts where navigator.clipboard is unavailable.
export function CopyButton({
  text,
  label,
  title = "Copy error details",
}: {
  text: string;
  label?: string;
  title?: string;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked by the browser — fail silently rather than throw.
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={onCopy}
      title={title}
      aria-label={title}
      className={`errmon-copy${label ? " errmon-copy--labeled" : ""}${copied ? " errmon-copy--done" : ""}`}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {label && <span>{copied ? "Copied" : label}</span>}
    </button>
  );
}
