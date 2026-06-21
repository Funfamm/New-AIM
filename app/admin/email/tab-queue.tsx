import { prisma } from "@/lib/prisma";
import ProcessQueueButton from "./process-queue-button";
import QueueTable, { type QueueRow } from "./queue-table";

export default async function TabQueue() {
  const acsConfigured = !!(process.env.ACS_CONNECTION_STRING && process.env.ACS_SENDER_ADDRESS);

  const [queuedCount, recentItems] = await Promise.all([
    prisma.emailQueue.count({ where: { status: "QUEUED" } }),
    prisma.emailQueue.findMany({
      orderBy: { createdAt: "desc" },
      take:    100,
      select:  {
        id: true, to: true, subject: true, type: true,
        campaignId: true, retryCount: true, maxRetries: true,
        status: true, error: true, createdAt: true,
      },
    }),
  ]);

  const sentCount   = recentItems.filter((i) => i.status === "SENT").length;
  const failedCount = recentItems.filter((i) => i.status === "FAILED").length;

  // Serialize Dates for client component
  const rows: QueueRow[] = recentItems.map((i) => ({
    ...i,
    createdAt: i.createdAt.toISOString(),
  }));

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
            <span className="email-stat-label">Sent (last 100)</span>
          </div>
          <div className="email-stat">
            <span className={`email-stat-val${failedCount > 0 ? " email-stat-val--red" : ""}`}>
              {failedCount.toLocaleString()}
            </span>
            <span className="email-stat-label">Failed (last 100)</span>
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

      {/* ── Queue table with bulk actions ── */}
      {rows.length > 0 && (
        <section className="email-section">
          <h2 className="email-section-title">
            Recent queue items ({rows.length})
          </h2>
          <p className="email-hint">
            Select failed items to retry or cancel. Retry resets retry count and re-queues the email.
          </p>
          <QueueTable items={rows} />
        </section>
      )}

      {rows.length === 0 && queuedCount === 0 && (
        <section className="email-section">
          <p className="email-empty">Queue is empty — no pending emails.</p>
        </section>
      )}
    </>
  );
}
