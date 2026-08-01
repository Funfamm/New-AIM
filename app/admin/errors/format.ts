import type { ErrorLog } from "@prisma/client";

// Shared formatting for the error monitor list + detail views.
export type ErrorRow = ErrorLog;

export function timeAgo(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24); if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtAbs(d: Date): string {
  return d.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Plain-text report for one error group — what the Copy button puts on the clipboard
// so it can be pasted straight into a chat for diagnosis.
export function formatReport(e: ErrorRow): string {
  const lines: (string | null)[] = [
    `[${e.level}] ${e.source}${e.count > 1 ? `  ×${e.count}` : ""}  status=${e.status}${e.regressed ? " (regressed)" : ""}`,
    `Message: ${e.message}`,
    e.route ? `Route: ${e.method ? `${e.method} ` : ""}${e.route}` : null,
    `Occurrences: ${e.count}`,
    `First seen: ${fmtAbs(new Date(e.firstSeenAt))}`,
    `Last seen:  ${fmtAbs(new Date(e.lastSeenAt))}`,
    e.environment ? `Environment: ${e.environment}` : null,
    (e.firstRelease || e.lastRelease) ? `Release: first ${e.firstRelease ?? "—"} → last ${e.lastRelease ?? "—"}` : null,
    `Fingerprint: ${e.fingerprint}`,
    e.lastUserId ? `Last user: ${e.lastUserId}` : null,
    e.stack ? `\nStack:\n${e.stack}` : null,
    e.metadata != null ? `\nMetadata:\n${JSON.stringify(e.metadata, null, 2)}` : null,
  ];
  return lines.filter((l): l is string => l !== null).join("\n");
}
