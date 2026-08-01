import type { SparkPoint } from "@/lib/monitoring/buckets";

// Presentational inline-SVG bar chart — no chart library. Server component.
export function Sparkline({
  points,
  width = 160,
  height = 32,
  className = "",
}: {
  points: SparkPoint[];
  width?: number;
  height?: number;
  className?: string;
}) {
  const n = points.length || 1;
  const max = Math.max(1, ...points.map((p) => p.count));
  const gap = n > 60 ? 0.5 : 1;
  const barW = Math.max(1, (width - gap * (n - 1)) / n);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`errspark ${className}`.trim()}
      role="img"
      aria-label="occurrence trend"
      preserveAspectRatio="none"
    >
      {points.map((p, i) => {
        const h = p.count === 0 ? 1 : Math.max(2, Math.round((p.count / max) * height));
        const x = i * (barW + gap);
        return (
          <rect
            key={p.t}
            x={x}
            y={height - h}
            width={barW}
            height={h}
            className={p.count > 0 ? "errspark-bar errspark-bar--on" : "errspark-bar"}
          >
            <title>{`${new Date(p.t).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit" })}: ${p.count}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}
