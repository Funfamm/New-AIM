import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Clapperboard, Users, LogOut } from "lucide-react";
import { logoutUser } from "@/lib/actions/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/");

  return (
    <div className="admin-shell">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <Link href="/" className="admin-logo">AIM<span>Studio</span></Link>
        <span className="admin-badge">Admin</span>

        <nav className="admin-nav">
          <Link href="/admin" className="admin-nav-link">
            <LayoutDashboard size={16} /> Overview
          </Link>
          <Link href="/admin/works" className="admin-nav-link">
            <Clapperboard size={16} /> Works
          </Link>
          <Link href="/admin/users" className="admin-nav-link">
            <Users size={16} /> Users
          </Link>
        </nav>

        <form action={logoutUser} className="admin-logout-form">
          <button type="submit" className="admin-logout-btn">
            <LogOut size={15} /> Sign Out
          </button>
        </form>
      </aside>

      {/* Main */}
      <main className="admin-main">{children}</main>

      <style>{`
        .admin-shell {
          display: flex;
          min-height: 100dvh;
          background: var(--color-brand-black);
        }
        .admin-sidebar {
          width: 220px;
          flex-shrink: 0;
          background: var(--color-brand-dark);
          border-right: 1px solid var(--color-brand-border);
          display: flex;
          flex-direction: column;
          padding: 1.5rem 1rem;
          position: fixed;
          top: 0; left: 0; bottom: 0;
          z-index: 50;
        }
        @media (max-width: 768px) {
          .admin-sidebar { display: none; }
          .admin-main { margin-left: 0 !important; }
        }
        .admin-logo {
          font-family: var(--font-display);
          font-size: 1.1rem;
          font-weight: 900;
          color: var(--color-brand-white);
          text-decoration: none;
          margin-bottom: 0.4rem;
        }
        .admin-logo span { color: var(--color-brand-accent); }
        .admin-badge {
          font-family: var(--font-body);
          font-size: 0.65rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--color-brand-accent);
          background: rgba(232,201,126,0.1);
          border: 1px solid rgba(232,201,126,0.2);
          padding: 0.2rem 0.5rem;
          border-radius: 3px;
          display: inline-block;
          margin-bottom: 2rem;
        }
        .admin-nav {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          flex: 1;
        }
        .admin-nav-link {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          font-family: var(--font-body);
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-brand-muted);
          text-decoration: none;
          padding: 0.6rem 0.75rem;
          border-radius: 6px;
          transition: background 0.15s, color 0.15s;
        }
        .admin-nav-link:hover {
          background: var(--color-brand-surface);
          color: var(--color-brand-white);
        }
        .admin-logout-form { margin-top: auto; padding-top: 1rem; }
        .admin-logout-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
          font-family: var(--font-body);
          font-size: 0.8rem;
          color: var(--color-brand-muted);
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.5rem 0.75rem;
          border-radius: 6px;
          transition: color 0.2s;
        }
        .admin-logout-btn:hover { color: var(--color-brand-white); }
        .admin-main {
          flex: 1;
          margin-left: 220px;
          padding: 2rem;
          overflow-y: auto;
        }
      `}</style>
    </div>
  );
}
