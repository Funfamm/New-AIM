"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, User, LayoutDashboard } from "lucide-react";

const links = [
  { href: "/", label: "Home" },
  { href: "/works", label: "Works" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

type NavProps = {
  user?: { name?: string | null; email?: string | null; role?: string } | null;
};

export default function Nav({ user }: NavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isAdmin = user?.role === "ADMIN";

  return (
    <header className="nav-header">
      <div className="nav-inner container-app">
        <Link href="/" className="nav-logo" onClick={() => setOpen(false)}>
          AIM<span>Studio</span>
        </Link>

        {/* Desktop */}
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
            <Link href="/dashboard" className="nav-cta">
              <User size={13} /> {user.name?.split(" ")[0] ?? "Account"}
            </Link>
          ) : (
            <Link href="/login" className="nav-cta">Sign In</Link>
          )}
        </nav>

        {/* Mobile burger */}
        <button className="nav-burger" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
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

      <style>{`
        .nav-header {
          position: fixed; top:0; left:0; right:0; z-index:100;
          background: rgba(10,10,10,0.85);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--color-brand-border);
        }
        .nav-inner { display:flex; align-items:center; justify-content:space-between; height:68px; }
        .nav-logo {
          font-family:var(--font-display); font-size:1.375rem; font-weight:700;
          letter-spacing:0.04em; color:var(--color-brand-white); text-decoration:none;
        }
        .nav-logo span {
          font-weight:300; color:var(--color-brand-accent);
          margin-left:0.35rem; letter-spacing:0.1em;
        }
        .nav-links-desktop { display:none; align-items:center; gap:2rem; }
        @media(min-width:768px){ .nav-links-desktop{display:flex} }
        .nav-link {
          font-family:var(--font-body); font-size:0.875rem; font-weight:500;
          letter-spacing:0.05em; text-transform:uppercase;
          color:var(--color-brand-muted); text-decoration:none; transition:color 0.2s;
        }
        .nav-link:hover, .nav-link--active { color:var(--color-brand-white); }
        .nav-link--admin {
          display:inline-flex; align-items:center; gap:0.3rem;
          color:var(--color-brand-accent) !important;
        }
        .nav-cta {
          display:inline-flex; align-items:center; gap:0.25rem;
          font-family:var(--font-body); font-size:0.875rem; font-weight:500;
          letter-spacing:0.05em; text-transform:uppercase;
          color:var(--color-brand-muted); background:none;
          padding:0; text-decoration:none;
          transition:color 0.2s;
        }
        .nav-cta:hover { color:var(--color-brand-white); }
        .nav-burger {
          background:none; border:none; color:var(--color-brand-white);
          cursor:pointer; padding:0.25rem; display:flex; align-items:center;
        }
        @media(min-width:768px){ .nav-burger{display:none} }
        .nav-drawer {
          display:flex; flex-direction:column;
          padding:1rem 1.5rem 1.5rem; gap:0.25rem;
          border-top:1px solid var(--color-brand-border);
          background:var(--color-brand-dark);
        }
        @media(min-width:768px){ .nav-drawer{display:none} }
        .nav-drawer-link {
          font-family:var(--font-body); font-size:1rem; font-weight:500;
          color:var(--color-brand-light); text-decoration:none;
          padding:0.75rem 0; border-bottom:1px solid var(--color-brand-border);
          transition:color 0.2s;
        }
        .nav-drawer-link:hover { color:var(--color-brand-white); }
        .nav-drawer-cta {
          margin-top:1rem; font-family:var(--font-body); font-size:0.875rem; font-weight:500;
          letter-spacing:0.06em; text-transform:uppercase;
          color:var(--color-brand-white); background:none;
          border:1px solid rgba(255,255,255,0.3);
          padding:0.75rem 1.5rem; border-radius:2px; text-decoration:none; text-align:center;
          transition:border-color 0.2s;
        }
      `}</style>
    </header>
  );
}
