import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin — Subscribers" };

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default async function AdminSubscribersPage() {
  await requireAdmin();

  const [total, active, subscribers] = await Promise.all([
    prisma.subscriber.count(),
    prisma.subscriber.count({ where: { active: true } }),
    prisma.subscriber.findMany({
      orderBy: { subscribedAt: "desc" },
      take: 200,
      select: {
        id: true, email: true, name: true, source: true,
        active: true, subscribedAt: true, suppressedAt: true, suppressReason: true,
      },
    }),
  ]);

  return (
    <div>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.75rem", fontWeight: 700, color: "var(--color-brand-white)", margin: "0 0 0.25rem" }}>
          Subscribers
        </h1>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-brand-muted)", margin: 0 }}>
          {active} active · {total} total
        </p>
      </div>

      {subscribers.length === 0 ? (
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.9375rem", color: "var(--color-brand-muted)" }}>
          No subscribers yet.
        </p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Source</th>
                <th>Status</th>
                <th>Subscribed</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-brand-light)" }}>
                    {s.email}
                  </td>
                  <td style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-brand-muted)" }}>
                    {s.name ?? "—"}
                  </td>
                  <td style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-brand-muted)" }}>
                    {s.source ?? "organic"}
                  </td>
                  <td>
                    {s.active ? (
                      <span className="badge--published">Active</span>
                    ) : (
                      <span className="badge--draft" title={s.suppressReason ?? undefined}>
                        {s.suppressReason ?? "Inactive"}
                      </span>
                    )}
                  </td>
                  <td style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-brand-muted)", whiteSpace: "nowrap" }}>
                    {fmtDate(s.subscribedAt)}
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
