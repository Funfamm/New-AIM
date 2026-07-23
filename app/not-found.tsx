import Link from "next/link";

// Branded 404. Inline styles (matching app/error.tsx) keep this resilient even
// if the normal CSS pipeline is unavailable for the missing route.
export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.75rem",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "0.75rem",
          fontWeight: 600,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--color-brand-accent)",
          margin: 0,
        }}
      >
        Error 404
      </p>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(1.75rem, 5vw, 2.75rem)",
          fontWeight: 700,
          color: "var(--color-brand-white)",
          margin: 0,
        }}
      >
        This page doesn&rsquo;t exist
      </h1>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "1rem",
          color: "var(--color-brand-muted)",
          maxWidth: "32rem",
          margin: "0 0 1rem",
        }}
      >
        The page you&rsquo;re looking for may have moved, or never existed.
      </p>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
        <Link
          href="/"
          style={{
            padding: "0.6rem 1.6rem",
            background: "var(--color-brand-accent)",
            color: "var(--color-brand-black)",
            borderRadius: "8px",
            fontFamily: "var(--font-body)",
            fontWeight: 700,
            fontSize: "0.85rem",
            textDecoration: "none",
          }}
        >
          Back to Home
        </Link>
        <Link
          href="/works"
          style={{
            padding: "0.6rem 1.6rem",
            border: "1px solid var(--color-brand-border)",
            color: "var(--color-brand-light)",
            borderRadius: "8px",
            fontFamily: "var(--font-body)",
            fontWeight: 600,
            fontSize: "0.85rem",
            textDecoration: "none",
          }}
        >
          Browse Films
        </Link>
      </div>
    </main>
  );
}
