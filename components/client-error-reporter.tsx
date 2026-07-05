"use client";

import { useEffect } from "react";
import { isIgnorableClientError } from "@/lib/monitoring/ignore";

// Captures uncaught browser errors + unhandled promise rejections and beacons them
// to the in-house monitor. Mounted once in the root layout. Silent and best-effort.
export default function ClientErrorReporter() {
  useEffect(() => {
    function report(message: string, stack?: string) {
      const msg = (message ?? "").trim();
      // Drop known-benign browser noise (aborted fetch/media on navigation, cross-origin
      // "Script error.", ResizeObserver churn) so it never reaches the monitor.
      if (isIgnorableClientError(msg)) return;
      const payload = JSON.stringify({
        message: msg.slice(0, 1000),
        stack:   stack?.slice(0, 4000),
        route:   location.pathname,
      });
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon("/api/monitoring/client-error", new Blob([payload], { type: "application/json" }));
        } else {
          void fetch("/api/monitoring/client-error", {
            method: "POST", body: payload, keepalive: true,
            headers: { "Content-Type": "application/json" },
          });
        }
      } catch { /* ignore */ }
    }

    const onError = (e: ErrorEvent) => report(e.message, e.error?.stack);
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason as { message?: string; stack?: string } | undefined;
      report(r?.message ?? String(e.reason), r?.stack);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
