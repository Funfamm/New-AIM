"use client";

import Link from "next/link";
import { Clapperboard } from "lucide-react";
import { beacon } from "@/lib/beacon";

// "How We Made It" CTA for a work's processUrl (production breakdown / BTS page).
// Internal paths navigate in-app; external URLs open in a new tab.
// Fires a PROCESS_CLICK analytics beacon on click, attributed to workId.
// Styling comes from the caller: detail page passes no className (ghost CTA),
// the watch page passes its accent-link class.
export default function HowWeMadeItButton({
  processUrl,
  workId,
  className = "detail-btn-ghost",
}: {
  processUrl: string;
  workId: string;
  className?: string;
}) {
  const onClick = () => beacon("PROCESS_CLICK", { workId });

  const label = (
    <>
      <Clapperboard size={14} /> How We Made It
    </>
  );

  if (processUrl.startsWith("/")) {
    return (
      <Link href={processUrl} className={className} onClick={onClick}>
        {label}
      </Link>
    );
  }
  return (
    <a
      href={processUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={onClick}
    >
      {label}
    </a>
  );
}
