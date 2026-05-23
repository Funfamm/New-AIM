"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const links = [
  { href: "/", label: "Home" },
  { href: "/works", label: "Works" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="nav-header">
      <div className="nav-inner container-app">
        {/* Logo */}
        <Link href="/" className="nav-logo" onClick={() => setOpen(false)}>
          AIM<span>Studio</span>
        </Link>

        {/* Desktop links */}
        <nav className="nav-links-desktop">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`nav-link ${pathname === l.href ? "nav-link--active" : ""}`}
            >
              {l.label}
            </Link>
          ))}
          <Link href="/login" className="nav-cta">Sign In</Link>
        </nav>

        {/* Mobile burger */}
        <button
          className="nav-burger"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="nav-drawer">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="nav-drawer-link"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          <Link href="/login" className="nav-drawer-cta" onClick={() => setOpen(false)}>
            Sign In
          </Link>
        </div>
      )}

      <style>{`
        .nav-header {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 100;
          background: rgba(10,10,10,0.85);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--color-brand-border);
        }
        .nav-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 60px;
        }
        .nav-logo {
          font-family: var(--font-display);
          font-size: 1.25rem;
          font-weight: 900;
          letter-spacing: -0.02em;
          color: var(--color-brand-white);
          text-decoration: none;
        }
        .nav-logo span { color: var(--color-brand-accent); }
        .nav-links-desktop {
          display: none;
          align-items: center;
          gap: 2rem;
        }
        @media (min-width: 768px) {
          .nav-links-desktop { display: flex; }
          .nav-burger { display: none; }
        }
        .nav-link {
          font-family: var(--font-body);
          font-size: 0.875rem;
          font-weight: 500;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--color-brand-muted);
          text-decoration: none;
          transition: color 0.2s;
        }
        .nav-link:hover, .nav-link--active { color: var(--color-brand-white); }
        .nav-cta {
          font-family: var(--font-body);
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--color-brand-black);
          background: var(--color-brand-accent);
          padding: 0.4rem 1rem;
          border-radius: 4px;
          text-decoration: none;
          transition: opacity 0.2s;
        }
        .nav-cta:hover { opacity: 0.85; }
        .nav-burger {
          background: none;
          border: none;
          color: var(--color-brand-white);
          cursor: pointer;
          padding: 0.25rem;
          display: flex;
          align-items: center;
        }
        .nav-drawer {
          display: flex;
          flex-direction: column;
          padding: 1rem 1.5rem 1.5rem;
          gap: 0.25rem;
          border-top: 1px solid var(--color-brand-border);
          background: var(--color-brand-dark);
        }
        @media (min-width: 768px) { .nav-drawer { display: none; } }
        .nav-drawer-link {
          font-family: var(--font-body);
          font-size: 1rem;
          font-weight: 500;
          color: var(--color-brand-light);
          text-decoration: none;
          padding: 0.75rem 0;
          border-bottom: 1px solid var(--color-brand-border);
          transition: color 0.2s;
        }
        .nav-drawer-link:hover { color: var(--color-brand-accent); }
        .nav-drawer-cta {
          margin-top: 1rem;
          font-family: var(--font-body);
          font-size: 0.9rem;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-brand-black);
          background: var(--color-brand-accent);
          padding: 0.75rem 1.5rem;
          border-radius: 4px;
          text-decoration: none;
          text-align: center;
        }
      `}</style>
    </header>
  );
}
