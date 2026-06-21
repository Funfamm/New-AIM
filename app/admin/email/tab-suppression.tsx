import { prisma } from "@/lib/prisma";
import { addSuppression } from "@/lib/actions/email-admin";
import SuppressionBulk, { type SuppressionRow } from "./suppression-bulk";

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(d);
}

export default async function TabSuppression({ error }: { error?: string }) {
  const [active, inactive] = await Promise.all([
    prisma.emailSuppression.findMany({
      where:   { active: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.emailSuppression.findMany({
      where:   { active: false },
      orderBy: { createdAt: "desc" },
      take:    50,
    }),
  ]);

  const byCounts = active.reduce((acc, s) => {
    const key = s.reason ?? "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Serialize Dates for client component
  const activeRows: SuppressionRow[] = active.map((s) => ({
    id:        s.id,
    email:     s.email,
    reason:    s.reason,
    source:    s.source,
    createdAt: s.createdAt.toISOString(),
  }));

  return (
    <>
      {/* ── Stats ── */}
      <section className="email-section">
        <div className="email-stats" style={{ marginBottom: "1.5rem" }}>
          <div className="email-stat">
            <span className={`email-stat-val${active.length > 0 ? " email-stat-val--amber" : ""}`}>
              {active.length.toLocaleString()}
            </span>
            <span className="email-stat-label">Active</span>
          </div>
          {Object.entries(byCounts).map(([reason, count]) => (
            <div key={reason} className="email-stat">
              <span className="email-stat-val email-stat-val--muted">{count}</span>
              <span className="email-stat-label">{reason}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Add suppression ── */}
      <section className="email-section">
        <h2 className="email-section-title">Add suppression</h2>
        <p className="email-hint">
          Manually suppress an address. It will not receive any marketing emails.
          Safety-critical emails (password reset, security alerts) bypass suppression.
          Use the Import tab to add addresses in bulk.
        </p>
        {error && <p className="email-test-err" style={{ marginBottom: "0.75rem" }}>⚠ {error}</p>}
        <form action={addSuppression} className="email-sup-form">
          <input
            type="email"
            name="email"
            required
            placeholder="email@example.com"
            className="email-sup-input"
          />
          <select name="reason" className="email-sup-input email-sup-input--reason">
            <option value="manual">manual</option>
            <option value="hard_bounce">hard_bounce</option>
            <option value="complaint">complaint</option>
            <option value="unsubscribe">unsubscribe</option>
          </select>
          <button type="submit" className="email-sup-btn">Suppress</button>
        </form>
      </section>

      {/* ── Active suppressions (bulk-selectable) ── */}
      <section className="email-section">
        <h2 className="email-section-title">Active suppressions ({active.length.toLocaleString()})</h2>
        {active.length > 0 && (
          <p className="email-hint">Select rows to bulk remove or permanently delete.</p>
        )}
        <SuppressionBulk rows={activeRows} />
      </section>

      {/* ── Previously removed ── */}
      {inactive.length > 0 && (
        <section className="email-section">
          <h2 className="email-section-title">Previously removed ({inactive.length})</h2>
          <p className="email-hint">
            These addresses were suppressed then manually re-enabled. They can receive emails again.
          </p>
          <div className="email-log-wrap">
            <div className="email-log-scroll">
              <table className="email-sup-table">
                <thead>
                  <tr><th>Email</th><th>Reason</th><th>Source</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {inactive.map((s) => (
                    <tr key={s.id} style={{ opacity: 0.55 }}>
                      <td>{s.email}</td>
                      <td className="elog-provider">{s.reason ?? "—"}</td>
                      <td className="elog-provider">{s.source ?? "—"}</td>
                      <td className="elog-date">{fmtDate(s.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
