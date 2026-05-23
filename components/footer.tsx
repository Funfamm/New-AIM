import Link from "next/link";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container-app footer-inner">
        <div className="footer-brand">
          <span className="footer-logo">AIM<span>Studio</span></span>
          <p className="footer-tagline">AI-generated films for the next generation.</p>
        </div>
        <nav className="footer-links">
          <Link href="/works">Works</Link>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/login">Sign In</Link>
        </nav>
        <p className="footer-copy">© {new Date().getFullYear()} AIM Studio. All rights reserved.</p>
      </div>
      <style>{`
        .footer {
          border-top: 1px solid var(--color-brand-border);
          padding: 3rem 0 2rem;
          margin-top: 6rem;
        }
        .footer-inner {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        @media (min-width: 768px) {
          .footer-inner {
            flex-direction: row;
            align-items: flex-start;
            justify-content: space-between;
          }
        }
        .footer-logo {
          font-family: var(--font-display);
          font-size: 1.1rem;
          font-weight: 900;
          color: var(--color-brand-white);
        }
        .footer-logo span { color: var(--color-brand-accent); }
        .footer-tagline {
          font-family: var(--font-body);
          font-size: 0.8rem;
          color: var(--color-brand-muted);
          margin-top: 0.4rem;
        }
        .footer-links {
          display: flex;
          flex-wrap: wrap;
          gap: 1.5rem;
        }
        .footer-links a {
          font-family: var(--font-body);
          font-size: 0.8rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-brand-muted);
          text-decoration: none;
          transition: color 0.2s;
        }
        .footer-links a:hover { color: var(--color-brand-accent); }
        .footer-copy {
          font-family: var(--font-body);
          font-size: 0.75rem;
          color: var(--color-brand-border);
          align-self: flex-end;
        }
      `}</style>
    </footer>
  );
}
