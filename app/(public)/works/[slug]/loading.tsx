/* Work detail loading skeleton */
export default function DetailLoading() {
  return (
    <div style={{ minHeight: "100dvh" }}>
      {/* Hero backdrop */}
      <div className="skeleton" style={{ width: "100%", height: "clamp(280px, 50vw, 520px)" }} />

      {/* Content area */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "2rem 1.5rem" }}>
        {/* Title + meta */}
        <div className="skeleton" style={{ width: "55%", height: 36, borderRadius: 6, marginBottom: "0.75rem" }} />
        <div className="skeleton" style={{ width: "30%", height: 14, borderRadius: 4, marginBottom: "1.5rem" }} />

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
          <div className="skeleton" style={{ width: 130, height: 42, borderRadius: 999 }} />
          <div className="skeleton" style={{ width: 90, height: 42, borderRadius: 999 }} />
          <div className="skeleton" style={{ width: 80, height: 42, borderRadius: 999 }} />
        </div>

        {/* Synopsis */}
        <div className="skeleton" style={{ width: "90%", height: 14, borderRadius: 4, marginBottom: "0.4rem" }} />
        <div className="skeleton" style={{ width: "75%", height: 14, borderRadius: 4, marginBottom: "0.4rem" }} />
        <div className="skeleton" style={{ width: "60%", height: 14, borderRadius: 4 }} />
      </div>
    </div>
  );
}
