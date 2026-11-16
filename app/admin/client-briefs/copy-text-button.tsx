"use client";

import { useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";

// Copy-to-clipboard for text built on the server (a brief link, a quote), so the page
// stays a Server Component. Falls back to a hidden textarea where the async clipboard
// API is unavailable.
export function CopyTextButton({ text, label }: { text: string; label: string }) {
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
    <button type="button" onClick={onCopy} className="admin-ghost-btn">
      {copied ? <Check size={14} /> : <Copy size={14} />}
      <span>{copied ? "Copied" : label}</span>
    </button>
  );
}
