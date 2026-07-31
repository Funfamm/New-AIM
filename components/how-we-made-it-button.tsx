import Link from "next/link";
import { Clapperboard } from "lucide-react";

// "How We Made It" CTA for a work's processUrl (production breakdown / BTS page).
// Internal paths navigate in-app; external URLs open in a new tab.
// Styling comes from the caller: detail page passes no className (ghost CTA),
// the watch page passes the small engagement-pill classes.
export default function HowWeMadeItButton({
  processUrl,
  className = "detail-btn-ghost",
}: {
  processUrl: string;
  className?: string;
}) {
  const label = (
    <>
      <Clapperboard size={14} /> How We Made It
    </>
  );

  if (processUrl.startsWith("/")) {
    return (
      <Link href={processUrl} className={className}>
        {label}
      </Link>
    );
  }
  return (
    <a href={processUrl} target="_blank" rel="noopener noreferrer" className={className}>
      {label}
    </a>
  );
}
