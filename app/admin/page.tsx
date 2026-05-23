import { prisma } from "@/lib/prisma";
import { Film, Users, Eye, TrendingUp } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin — Overview" };

async function getStats() {
  const [totalFilms, publicFilms, totalUsers, recentUsers] = await Promise.all([
    prisma.film.count(),
    prisma.film.count({ where: { isPublic: true } }),
    prisma.user.count(),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, email: true, createdAt: true, role: true },
    }),
  ]);
  return { totalFilms, publicFilms, totalUsers, recentUsers };
}

export default async function AdminOverviewPage() {
  const { totalFilms, publicFilms, totalUsers, recentUsers } = await getStats();

  const stats = [
    { label: "Total Films", value: totalFilms, icon: Film, color: "#e8c97e" },
    { label: "Public Films", value: publicFilms, icon: Eye, color: "#27ae60" },
    { label: "Total Users", value: totalUsers, icon: Users, color: "#3498db" },
    { label: "Private Films", value: totalFilms - publicFilms, icon: TrendingUp, color: "#9b59b6" },
  ];

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">Overview</h1>

      {/* Stat cards */}
      <div className="stats-grid">
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-card-icon" style={{ color: s.color }}>
              <s.icon size={20} />
            </div>
            <div className="stat-card-num">{s.value}</div>
            <div className="stat-card-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Recent users */}
      <div className="admin-section">
        <h2 className="admin-section-title">Recent Signups</h2>
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
                  <td>{u.name ?? "—"}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`role-badge role-badge--${u.role.toLowerCase()}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {recentUsers.length === 0 && (
                <tr><td colSpan={4} className="table-empty">No users yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .admin-page { max-width: 900px; }
        .admin-page-title {
          font-family: var(--font-display);
          font-size: 1.8rem;
          font-weight: 700;
          color: var(--color-brand-white);
          margin: 0 0 2rem;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
          margin-bottom: 2.5rem;
        }
        @media (min-width: 640px) { .stats-grid { grid-template-columns: repeat(4, 1fr); } }
        .stat-card {
          background: var(--color-brand-dark);
          border: 1px solid var(--color-brand-border);
          border-radius: 8px;
          padding: 1.25rem;
        }
        .stat-card-icon { margin-bottom: 0.75rem; }
        .stat-card-num {
          font-family: var(--font-display);
          font-size: 2rem;
          font-weight: 900;
          color: var(--color-brand-white);
          line-height: 1;
          margin-bottom: 0.3rem;
        }
        .stat-card-label {
          font-family: var(--font-body);
          font-size: 0.75rem;
          color: var(--color-brand-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .admin-section { margin-top: 2rem; }
        .admin-section-title {
          font-family: var(--font-display);
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--color-brand-white);
          margin: 0 0 1rem;
        }
        .admin-table-wrap {
          background: var(--color-brand-dark);
          border: 1px solid var(--color-brand-border);
          border-radius: 8px;
          overflow-x: auto;
        }
        .admin-table {
          width: 100%;
          border-collapse: collapse;
          font-family: var(--font-body);
          font-size: 0.875rem;
        }
        .admin-table th {
          text-align: left;
          padding: 0.75rem 1rem;
          color: var(--color-brand-muted);
          font-weight: 500;
          font-size: 0.75rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          border-bottom: 1px solid var(--color-brand-border);
        }
        .admin-table td {
          padding: 0.75rem 1rem;
          color: var(--color-brand-light);
          border-bottom: 1px solid rgba(42,42,42,0.5);
        }
        .admin-table tr:last-child td { border-bottom: none; }
        .role-badge {
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 0.2rem 0.5rem;
          border-radius: 3px;
        }
        .role-badge--admin { background: rgba(232,201,126,0.15); color: var(--color-brand-accent); }
        .role-badge--user  { background: rgba(52,152,219,0.15);  color: #3498db; }
        .table-empty { text-align: center; color: var(--color-brand-muted); padding: 2rem; }
      `}</style>
    </div>
  );
}
