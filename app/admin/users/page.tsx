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
        .td-email { color: var(--color-brand-muted); font-size: 0.8125rem; }
        .admin-count {
          font-family: var(--font-body); font-size: 0.8rem;
          color: var(--color-brand-muted);
        }
      `}</style>
    </div>
  );
}
