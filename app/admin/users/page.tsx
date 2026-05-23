import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin — Users" };

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, email: true, role: true,
      createdAt: true,
      _count: { select: { progress: true } },
    },
  });

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Users</h1>
        <span className="admin-count">{users.length} total</span>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Films Watched</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name ?? "—"}</td>
                <td className="td-email">{u.email}</td>
                <td>
                  <span className={`role-badge role-badge--${u.role.toLowerCase()}`}>
                    {u.role}
                  </span>
                </td>
                <td>{u._count.progress}</td>
                <td>{new Date(u.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={5} className="table-empty">No users yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        .admin-page { max-width: 900px; }
        .admin-page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
        }
        .admin-page-title {
          font-family: var(--font-display);
          font-size: 1.8rem;
          font-weight: 700;
          color: var(--color-brand-white);
          margin: 0;
        }
        .admin-count {
          font-family: var(--font-body);
          font-size: 0.8rem;
          color: var(--color-brand-muted);
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
          vertical-align: middle;
        }
        .admin-table tr:last-child td { border-bottom: none; }
        .td-email { color: var(--color-brand-muted); font-size: 0.8rem; }
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
        .table-empty { text-align: center; color: var(--color-brand-muted); padding: 3rem; }
      `}</style>
    </div>
  );
}
