import { prisma } from "@/lib/prisma";
import ProcessQueueButton from "./process-queue-button";

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(d);
}

export default async function TabQueue() {
  const acsConfigured = !!(process.env.ACS_CONNECTION_STRING && process.env.ACS_SENDER_ADDRESS);

  const [queuedCount, recentItems] = await Promise.all([
    prisma.emailQueue.count({ where: { status: "QUEUED" } }),
    prisma.emailQueue.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  const sentCount   = recentItems.filter((i) => i.status === "SENT").length;
  const failedCount = recentItems.filter((i) => i.status === "FAILED").length;

  return (
    <>
      {/* ── Stats ── */}
      <section className="email-section">
        <div className="email-stats" style={{ marginBottom: "1.5rem" }}>
          <div className="email-stat">
            <span className={`email-stat-val${queuedCount > 0 ? " email-stat-val--amber" : ""}`}>
              {queuedCount.toLocaleString()}
            </span>
            <span className="email-stat-label">Queued</span>
          </div>
          <div className="email-stat">
            <span className="email-stat-val email-stat-val--green">{sentCount.toLocaleString()}</span>
            <span className="email-stat-label">Sent (last 50)</span>
          </div>
          <div className="email-stat">
            <span className={`email-stat-val${failedCount > 0 ? " email-stat-val--red" : ""}`}>
              {failedCount.toLocaleString()}
            </span>
            <span className="email-stat-label">Failed (last 50)</span>
          </div>
        </div>
      </section>

      {/* ── Process batch ── */}
      <section className="email-section">
        <h2 className="email-section-title">Process queue</h2>
        <p className="email-hint">
          Processes up to 50 queued bulk emails per batch. Respects suppression list and
          user preferences. Requires the active bulk provider to be configured and
          bulk sending to be enabled in Settings.
        </p>
        {!acsConfigured && (
          <p className="email-hint" style={{ color: "#f59e0b", marginBottom: "0.75rem" }}>
            ⚠ ACS not configured — set ACS_CONNECTION_STRING and ACS_SENDER_ADDRESS,
            or switch to Graph in Settings.
          </p>
        )}
        <ProcessQueueButton queuedCount={queuedCount} />
      </section>

      {/* ── Recent queue items ── */}
      {recentItems.length > 0 && (
        <section className="email-section">
          <h2 className="email-section-title">Recent queue items (last {recentItems.length})</h2>
          <div className="email-log-wrap">
            <div className="email-log-scroll">
              <table className="email-log-table">
                <thead>
                  <tr>
                    <th>Status</th><th>To</th><th>Type</th>
                    <th>Campaign</th><th>Retries</th><th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentItems.map((item) => (
                    <>
                      <tr key={item.id}>
                        <td>
                          <span className={`elog-badge${
                            item.status === "SENT"   ? "" :
                            item.status === "FAILED" ? " elog-failed" :
                            item.status === "QUEUED" ? " elog-queued" : ""
                          }`} style={{
                            background:
                              item.status === "SENT"   ? "rgba(74,222,128,0.1)"  :
                              item.status === "FAILED" ? "rgba(248,113,113,0.1)" :
                              item.status === "QUEUED" ? "rgba(245,158,11,0.1)"  : undefined,
                            borderColor:
                              item.status === "SENT"   ? "rgba(74,222,128,0.2)"  :
                              item.status === "FAILED" ? "rgba(248,113,113,0.2)" :
                              item.status === "QUEUED" ? "rgba(245,158,11,0.2)"  : undefined,
                            color:
                              item.status === "SENT"   ? "#4ade80" :
                              item.status === "FAILED" ? "#f87171" :
                              item.status === "QUEUED" ? "#f59e0b" : undefined,
                          }}>
                            {item.status}
                          </span>
                        </td>
                        <td className="elog-to">{item.to}</td>
                        <td><span className="elog-badge">{item.type}</span></td>
                        <td className="elog-provider">{item.campaignId ?? "—"}</td>
                        <td className="elog-provider" style={{ textAlign: "center" }}>{item.retryCount}</td>
                        <td className="elog-date">{fmtDate(item.createdAt)}</td>
                      </tr>
                      {item.status === "FAILED" && item.error && (
                        <tr key={`${item.id}-err`} className="elog-error-row">
                          <td />
                          <td colSpan={5} className="elog-error-cell">
                            {item.error.slice(0, 300)}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {recentItems.length === 0 && queuedCount === 0 && (
        <section className="email-section">
          <p className="email-empty">Queue is empty — no pending emails.</p>
        </section>
      )}
    </>
  );
}
