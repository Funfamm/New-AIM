"use client";

/**
 * Fires a PAGE_VIEW analytics event via navigator.sendBeacon on every
 * client-side navigation. Renders nothing — zero visual footprint.
 *
 * sendBeacon is non-blocking and queued by the browser, so it never
 * affects page paint, navigation speed, or 4G performance.
 *
 * usePathname is already in the bundle (Nav uses it), so this component
 * adds effectively zero new bytes to the shared JS chunk.
 */

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export default function AnalyticsBeacon() {
  const pathname = usePathname();
  const lastPath = useRef("");

  useEffect(() => {
    // Skip if the path hasn't changed (StrictMode double-invoke guard)
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;

    if (typeof navigator === "undefined" || !("sendBeacon" in navigator)) return;

    navigator.sendBeacon(
      "/api/analytics",
      new Blob(
        [JSON.stringify({ type: "PAGE_VIEW", path: pathname })],
        { type: "application/json" }
      )
    );
  }, [pathname]);

  return null;
}
