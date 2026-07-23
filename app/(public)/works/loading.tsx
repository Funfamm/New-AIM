/* Works page loading skeleton */
export default function WorksLoading() {
  return (
    <div style={{ paddingTop: "2rem", maxWidth: 1280, margin: "0 auto", padding: "2rem 1.5rem" }}>
      {/* Tabs skeleton */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.75rem" }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ width: 72, height: 32, borderRadius: 999 }} />
        ))}
      </div>

      {/* Grid skeleton */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(clamp(130px, 18vw, 180px), 1fr))",
        gap: "1rem",
      }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i}>
            <div className="skeleton" style={{ width: "100%", aspectRatio: "2/3", borderRadius: 8, marginBottom: "0.5rem" }} />
            <div className="skeleton" style={{ width: "75%", height: 12, borderRadius: 4, marginBottom: "0.35rem" }} />
            <div className="skeleton" style={{ width: "50%", height: 10, borderRadius: 4 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
