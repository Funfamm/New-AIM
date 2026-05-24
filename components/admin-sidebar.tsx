"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, Clapperboard, Users, LogOut, Menu, X, ArrowLeft } from "lucide-react";
import { logoutUser } from "@/lib/actions/auth";

const NAV = [
  { href: "/admin",       label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/works", label: "Works",    icon: Clapperboard },
  { href: "/admin/users", label: "Users",    icon: Users },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const active = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* Mobile hamburger — fixed top-left */}
      <button className="adm-toggle" onClick={() => setOpen(true)} aria-label="Open menu">
        <Menu size={18} />
      </button>

      {/* Backdrop */}
      {open && <div className="adm-backdrop" onClick={close} />}

      {/* Sidebar */}
      <aside className={`adm-sidebar${open ? " adm-sidebar--open" : ""}`}>

        {/* Top: logo + label */}
        <div className="adm-top">
          <button className="adm-close" onClick={close} aria-label="Close menu">
            <X size={16} />
          </button>
          <Link href="/" className="adm-logo" onClick={close}>
            AIM<span>Studio</span>
          </Link>
          <span className="adm-sublabel">Admin Panel</span>
        </div>

        {/* Nav links */}
        <nav className="adm-nav">
          {NAV.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={close}
              className={`adm-link${active(l.href, l.exact) ? " adm-link--active" : ""}`}
            >
              <l.icon size={15} strokeWidth={1.75} />
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Bottom: back to site + sign out */}
        <div className="adm-bottom">
          <Link href="/" className="adm-back" onClick={close}>
            <ArrowLeft size={13} /> Back to Site
          </Link>
          <form action={logoutUser}>
            <button type="submit" className="adm-signout">
              <LogOut size={13} /> Sign Out
            </button>
          </form>
        </div>

      </aside>

      <style>{`
        /* Mobile hamburger */
        .adm-toggle {
          display: none; position: fixed; top: 1rem; left: 1rem; z-index: 200;
          background: var(--color-brand-surface); border: 1px solid var(--color-brand-border);
          border-radius: 4px; color: var(--color-brand-white);
          width: 36px; height: 36px; align-items: center; justify-content: center;
          cursor: pointer;
        }
        @media (max-width: 768px) { .adm-toggle { display: flex; } }

        /* Backdrop */
        .adm-backdrop {
          position: fixed; inset: 0; z-index: 90;
          background: rgba(0,0,0,0.52); backdrop-filter: blur(2px);
        }

        /* Sidebar shell */
        .adm-sidebar {
          width: 240px; flex-shrink: 0;
          background: var(--color-brand-dark);
          border-right: 1px solid var(--color-brand-border);
          display: flex; flex-direction: column;
          padding: 1.5rem 0.875rem;
          position: fixed; top: 0; left: 0; bottom: 0; z-index: 100;
          transition: transform 0.22s ease;
        }
        @media (max-width: 768px) {
          .adm-sidebar { transform: translateX(-100%); width: 272px; box-shadow: 8px 0 32px rgba(0,0,0,0.6); }
          .adm-sidebar--open { transform: translateX(0); }
        }

        /* Top block */
        .adm-top { margin-bottom: 2rem; }
        .adm-close {
          display: none; background: none; border: none;
          color: var(--color-brand-muted); cursor: pointer; padding: 0;
          margin-bottom: 1.25rem; align-items: center;
        }
        @media (max-width: 768px) { .adm-close { display: flex; } }

        .adm-logo {
          font-family: var(--font-display); font-size: 1.25rem; font-weight: 700;
          letter-spacing: 0.04em; color: var(--color-brand-white);
          text-decoration: none; display: block; margin-bottom: 0.25rem;
        }
        .adm-logo span {
          font-weight: 300; color: var(--color-brand-accent);
          margin-left: 0.3rem; letter-spacing: 0.1em;
        }
        .adm-sublabel {
          font-family: var(--font-body); font-size: 0.625rem; font-weight: 500;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--color-brand-muted); display: block;
        }

        /* Nav */
        .adm-nav { display: flex; flex-direction: column; gap: 0.125rem; flex: 1; }
        .adm-link {
          display: flex; align-items: center; gap: 0.6rem;
          font-family: var(--font-body); font-size: 0.875rem; font-weight: 500;
          color: var(--color-brand-muted); text-decoration: none;
          padding: 0.625rem 0.75rem; border-radius: 4px;
          border-left: 2px solid transparent;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .adm-link:hover { background: var(--color-brand-surface); color: var(--color-brand-white); }
        .adm-link--active {
          background: var(--color-brand-surface); color: var(--color-brand-white);
          border-left-color: var(--color-brand-accent);
        }

        /* Bottom */
        .adm-bottom {
          padding-top: 1rem; border-top: 1px solid var(--color-brand-border);
          display: flex; flex-direction: column; gap: 0.125rem;
        }
        .adm-back {
          display: flex; align-items: center; gap: 0.5rem;
          font-family: var(--font-body); font-size: 0.8rem; font-weight: 500;
          color: var(--color-brand-muted); text-decoration: none;
          padding: 0.5rem 0.75rem; border-radius: 4px;
          transition: color 0.15s, background 0.15s;
        }
        .adm-back:hover { color: var(--color-brand-white); background: var(--color-brand-surface); }
        .adm-signout {
          display: flex; align-items: center; gap: 0.5rem; width: 100%;
          font-family: var(--font-body); font-size: 0.8rem; font-weight: 500;
          color: var(--color-brand-muted); background: none; border: none;
          cursor: pointer; padding: 0.5rem 0.75rem; border-radius: 4px; text-align: left;
          transition: color 0.15s, background 0.15s;
        }
        .adm-signout:hover { color: var(--color-brand-white); background: var(--color-brand-surface); }
      `}</style>
    </>
  );
}
