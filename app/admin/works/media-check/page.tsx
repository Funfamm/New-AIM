import Link from "next/link";
import { checkAllWorkMediaLinks } from "@/lib/media-check";
import { ChevronLeft, RefreshCw } from "lucide-react";
import type { Metadata } from "next";
import "./media-check.css";

export const metadata: Metadata = { title: "Admin — Media Link Check" };
export const dynamic = "force-dynamic";

// Live HEAD-check of every public work's media URLs. The daily cron reports broken
// playback links into the error monitor; this page is the on-demand version so an
// admin can verify immediately after fixing an asset. Reload = re-check.
export default async function MediaCheckPage() {
  const { results, checked, broken, worksScanned } = await checkAllWorkMediaLinks();

  const playbackBroken = broken.filter((b) => b.kind === "playback").length;
  const imagesBroken   = broken.length - playbackBroken;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Media Link Check</h1>
        <div className="admin-page-header-actions">
          <Link href="/admin/works" className="admin-add-btn">
            <ChevronLeft size={15} /> Back to Works
          </Link>
          <Link href="/admin/works/media-check" className="admin-add-btn">
            <RefreshCw size={15} /> Re-check
          </Link>
        </div>
      </div>

      <p className="mc-summary">
        <span><strong>{worksScanned}</strong> works scanned</span>
        <span><strong>{checked}</strong> URLs checked</span>
        <span><strong>{playbackBroken}</strong> broken playback</span>
        <span><strong>{imagesBroken}</strong> broken images</span>
      </p>

      {checked === 0 ? (
        <div className="admin-empty-state">No media URLs to check.</div>
      ) : broken.length === 0 ? (
        <div className="admin-empty-state">All {checked} media links resolve. Nothing broken. ✓</div>
      ) : null}

      {checked > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Work</th>
                <th>Field</th>
                <th>Kind</th>
                <th>URL</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={`${r.workId}-${r.field}`} className={r.ok ? undefined : "mc-row--broken"}>
                  <td>
                    <span className={`mc-status ${r.ok ? "mc-status--ok" : "mc-status--broken"}`}>
                      {r.ok ? "OK" : `✕ ${r.httpStatus ?? "unreachable"}`}
                    </span>
                  </td>
                  <td>
                    <Link href={`/admin/works?search=${encodeURIComponent(r.title)}`}>{r.title}</Link>
                  </td>
                  <td>{r.field}</td>
                  <td className="mc-kind">{r.kind}</td>
                  <td>
                    <span className="mc-url" title={r.url}>{r.url}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
