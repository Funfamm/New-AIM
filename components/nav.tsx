"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, User, LayoutDashboard, Bell } from "lucide-react";

const links = [
  { href: "/", label: "Home" },
  { href: "/works", label: "Works" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

type NavProps = {
  user?: { name?: string | null; email?: string | null; role?: string } | null;
  unreadCount?: number;
};

export default function Nav({ user, unreadCount = 0 }: NavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isAdmin = user?.role === "ADMIN";
  const hasUnread = user && unreadCount > 0;
  const badgeLabel = unreadCount > 9 ? "9+" : String(unreadCount);

  return (
    <header className="nav-header">
      <div className="nav-inner container-app">
        <Link href="/" className="nav-logo" onClick={() => setOpen(false)}>
          <Image
            src="/images/SP_Logo.jpg"
            alt="AIM Studio"
            width={28}
            height={28}
            className="nav-logo-img"
            priority
          />
          AIM<span>Studio</span>
        </Link>

        {/* Desktop links */}
        <nav className="nav-links-desktop">
          {links.map((l) => (
            <Link key={l.href} href={l.href}
              className={`nav-link ${pathname === l.href ? "nav-link--active" : ""}`}>
              {l.label}
            </Link>
          ))}
          {isAdmin && (
            <Link href="/admin" className="nav-link nav-link--admin">
              <LayoutDashboard size={13} /> Admin
            </Link>
          )}
          {user ? (
            <>
              {/* Bell — desktop */}
              <Link
                href="/dashboard/notifications"
                className="nav-bell"
                aria-label={hasUnread ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}` : "Notifications"}
              >
                <Bell size={16} />
                {hasUnread && (
                  <span className="nav-bell-badge" aria-hidden="true">{badgeLabel}</span>
                )}
              </Link>
              <Link href="/dashboard" className="nav-cta">
                <User size={13} /> {user.name?.split(" ")[0] ?? "Account"}
              </Link>
            </>
          ) : (
            <Link href="/login" className="nav-cta">Sign In</Link>
          )}
        </nav>

        {/* Mobile right-side cluster: bell (if logged in) + burger */}
        <div className="nav-mobile-actions">
          {user && (
            <Link
              href="/dashboard/notifications"
              className="nav-bell"
              aria-label={hasUnread ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}` : "Notifications"}
              onClick={() => setOpen(false)}
            >
              <Bell size={20} />
              {hasUnread && (
                <span className="nav-bell-badge" aria-hidden="true">{badgeLabel}</span>
              )}
            </Link>
          )}
          <button className="nav-burger" onClick={() => setOpen(!open)} aria-label="Toggle menu">
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="nav-drawer">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="nav-drawer-link" onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
          {isAdmin && (
            <Link href="/admin" className="nav-drawer-link" onClick={() => setOpen(false)}>
              Admin Dashboard
            </Link>
          )}
          {user ? (
            <Link href="/dashboard" className="nav-drawer-cta" onClick={() => setOpen(false)}>
              My Account
            </Link>
          ) : (
            <Link href="/login" className="nav-drawer-cta" onClick={() => setOpen(false)}>
              Sign In
            </Link>
          )}
        </div>
      )}

    </header>
  );
}
