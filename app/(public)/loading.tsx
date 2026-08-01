/* Public route loading skeleton — shown while any public page fetches */
export default function PublicLoading() {
  return (
    <div style={{ minHeight: "100dvh", paddingTop: "68px" }}>
      {/* Hero skeleton */}
      <div className="skeleton" style={{ width: "100%", height: "clamp(320px, 56vw, 600px)" }} />

      {/* Rail skeleton */}
      <div style={{ padding: "2rem 1.5rem", maxWidth: 1280, margin: "0 auto" }}>
        <div className="skeleton" style={{ width: 160, height: 14, marginBottom: "1.25rem", borderRadius: 4 }} />
        <div style={{ display: "flex", gap: "0.85rem", overflow: "hidden" }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ flexShrink: 0, width: "clamp(140px, 18vw, 200px)" }}>
              <div className="skeleton" style={{ width: "100%", aspectRatio: "2/3", borderRadius: 8, marginBottom: "0.5rem" }} />
              <div className="skeleton" style={{ width: "70%", height: 11, borderRadius: 4, marginBottom: "0.3rem" }} />
              <div className="skeleton" style={{ width: "45%", height: 10, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
