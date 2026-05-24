import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus, Clapperboard, Users } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin — Command Center" };

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5)  return "Late night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Late night";
}

async function getStats() {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [totalWorks, publishedWorks, totalUsers, newThisMonth, recentUsers] = await Promise.all([
    prisma.work.count({ where: { type: { not: "EPISODE" } } }),
    prisma.work.count({ where: { status: "PUBLISHED", type: { not: "EPISODE" } } }),
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, name: true, email: true, createdAt: true, role: true },
    }),
  ]);

  return { totalWorks, publishedWorks, totalUsers, newThisMonth, recentUsers };
}

export default async function AdminOverviewPage() {
  const { totalWorks, publishedWorks, totalUsers, newThisMonth, recentUsers } = await getStats();
  const greeting = getGreeting();

  const stats = [
    { label: "Total Works",    value: totalWorks,      note: "films & series" },
    { label: "Published",      value: publishedWorks,  note: "live now" },
    { label: "Members",        value: totalUsers,       note: "registered" },
    { label: "New This Month", value: newThisMonth,    note: "recent signups" },
  ];

  return (
    <div className="admin-page">

      {/* ── Command Center header ── */}
      <div className="cmd-header">
        <div>
          <p className="cmd-greeting">{greeting}, Director.</p>
          <h1 className="cmd-title">Studio Command Center</h1>
        </div>
        <div className="cmd-actions">
          <Link href="/admin/works/new" className="admin-add-btn">
            <Plus size={13} /> New Work
          </Link>
          <Link href="/admin/works" className="admin-ghost-btn">
            <Clapperboard size={13} /> Works
          </Link>
          <Link href="/admin/users" className="admin-ghost-btn">
            <Users size={13} /> Users
          </Link>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="cmd-stats">
        {stats.map((s) => (
          <div key={s.label} className="cmd-stat">
            <div className="cmd-stat-value">{s.value}</div>
            <div className="cmd-stat-label">{s.label}</div>
            <div className="cmd-stat-note">{s.note}</div>
          </div>
        ))}
      </div>

      {/* ── Recent members ── */}
      <div className="admin-section">
        <div className="admin-section-hd">
          <h2 className="admin-section-title">Recent Members</h2>
          <Link href="/admin/users" className="admin-section-link">View all</Link>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {recentUsers.map((u) => (
                <tr key={u.id}>
                  <td className="td-primary">{u.name ?? "—"}</td>
                  <td className="td-muted">{u.email}</td>
                  <td>
                    <span className={`role-badge role-badge--${u.role.toLowerCase()}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="td-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {recentUsers.length === 0 && (
                <tr><td colSpan={4} className="table-empty">No members yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        /* ── Command Center header ── */
        .cmd-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 1.5rem; flex-wrap: wrap; margin-bottom: 2rem;
          background: linear-gradient(135deg, rgba(232,201,126,0.05) 0%, rgba(255,255,255,0.01) 100%);
          border: 1px solid rgba(232,201,126,0.1);
          border-radius: 4px; padding: 1.75rem 2rem;
        }
        .cmd-greeting {
          font-family: var(--font-body); font-size: 0.6875rem; font-weight: 600;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--color-brand-accent); margin: 0 0 0.5rem;
        }
        .cmd-title {
          font-family: var(--font-display);
          font-size: clamp(1.5rem, 3vw, 2.25rem);
          font-weight: 700; letter-spacing: -0.02em; line-height: 1.1;
          color: var(--color-brand-white); margin: 0;
        }
        .cmd-actions {
          display: flex; gap: 0.5rem; flex-wrap: wrap;
          align-items: center; align-self: center;
        }

        /* ── Stat cards ── */
        .cmd-stats {
          display: grid; grid-template-columns: repeat(2, 1fr);
          gap: 1rem; margin-bottom: 2.5rem;
        }
        @media (min-width: 640px) { .cmd-stats { grid-template-columns: repeat(4, 1fr); } }
        .cmd-stat {
          background: var(--color-brand-surface);
          border: 1px solid var(--color-brand-border);
          border-radius: 4px; padding: 1.25rem 1.5rem;
        }
        .cmd-stat-value {
          font-family: var(--font-display); font-size: 2.5rem;
          font-weight: 700; letter-spacing: -0.02em; line-height: 1;
          color: var(--color-brand-accent); margin-bottom: 0.4rem;
        }
        .cmd-stat-label {
          font-family: var(--font-body); font-size: 0.875rem; font-weight: 600;
          color: var(--color-brand-white); margin-bottom: 0.2rem;
        }
        .cmd-stat-note {
          font-family: var(--font-body); font-size: 0.75rem; color: var(--color-brand-muted);
        }

        /* ── Section ── */
        .admin-section { margin-top: 2rem; }
        .admin-section-hd {
          display: flex; align-items: baseline;
          justify-content: space-between; margin-bottom: 1rem;
        }
        .admin-section-title {
          font-family: var(--font-display); font-size: 1.125rem; font-weight: 700;
          letter-spacing: -0.01em; color: var(--color-brand-white); margin: 0;
        }
        .admin-section-link {
          font-family: var(--font-body); font-size: 0.75rem; font-weight: 500;
          color: var(--color-brand-muted); text-decoration: none; transition: color 0.15s;
        }
        .admin-section-link:hover { color: var(--color-brand-white); }
        .td-primary { font-weight: 500; color: var(--color-brand-white); }
        .td-muted { color: var(--color-brand-muted); font-size: 0.8125rem; }
      `}</style>
    </div>
  );
}
