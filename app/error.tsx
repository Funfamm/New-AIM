"use client";
// Global error boundary — catches unhandled render errors
import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log for diagnostics. The raw message is never shown to the user below,
    // so internal details (stack, query text, ids) do not leak to the client.
    console.error(error);
    // Report the boundary error to the in-house monitor (render errors don't
    // surface via window.onerror). Best-effort, never blocks.
    try {
      const payload = JSON.stringify({
        message: (error?.message || "Render error") + (error?.digest ? ` [${error.digest}]` : ""),
        stack:   error?.stack?.slice(0, 4000),
        route:   typeof location !== "undefined" ? location.pathname : undefined,
      });
      navigator.sendBeacon?.("/api/monitoring/client-error", new Blob([payload], { type: "application/json" }));
    } catch { /* ignore */ }
  }, [error]);

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <h2 style={{ fontFamily: "var(--font-display)", color: "var(--color-brand-white)" }}>
        Something went wrong
      </h2>
      <p style={{ color: "var(--color-brand-muted)", fontFamily: "var(--font-body)", maxWidth: "32rem" }}>
        An unexpected error occurred on our end. Please try again — if it keeps
        happening, come back in a little while.
      </p>
      {error.digest && (
        <p style={{ color: "var(--color-brand-muted)", fontFamily: "var(--font-body)", fontSize: "0.75rem", opacity: 0.7 }}>
          Reference: {error.digest}
        </p>
      )}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
        <button
          onClick={reset}
          style={{
            padding: "0.5rem 1.5rem",
            background: "var(--color-brand-accent)",
            color: "var(--color-brand-black)",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontFamily: "var(--font-body)",
            fontWeight: 600,
          }}
        >
          Try again
        </button>
        <Link
          href="/"
          style={{
            padding: "0.5rem 1.5rem",
            border: "1px solid var(--color-brand-border)",
            color: "var(--color-brand-light)",
            borderRadius: "6px",
            fontFamily: "var(--font-body)",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Back to Home
        </Link>
      </div>
    </main>
  );
}
