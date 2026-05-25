"use client";
import Link from "next/link";
import Image from "next/image";
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

    </header>
  );
}
