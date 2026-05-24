import Link from "next/link";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container-app">
        <div className="footer-inner">
          <div className="footer-brand">
            <span className="footer-logo">AIM<span>Studio</span></span>
            <p className="footer-tagline">
              Cinema about sacrifice, regret, and the people we&apos;d do anything for.
            </p>
          </div>
          <nav className="footer-links">
            <Link href="/works">Works</Link>
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/login">Sign In</Link>
          </nav>
        </div>
        <div className="footer-bottom">
          <span className="footer-motto">DON&apos;T LOOK AWAY.</span>
          <span className="footer-copy">© {new Date().getFullYear()} AIM Studio · Cinema, reimagined.</span>
        </div>
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
          font-size: 1.375rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          color: var(--color-brand-white);
        }
        .footer-logo span {
          font-weight: 300;
          color: var(--color-brand-accent);
          margin-left: 0.35rem;
          letter-spacing: 0.1em;
        }
        .footer-tagline {
          font-family: var(--font-body);
          font-size: 0.8rem;
          color: var(--color-brand-muted);
          margin-top: 0.4rem;
          max-width: 300px;
          line-height: 1.5;
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
        .footer-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid var(--color-brand-border);
          margin-top: 2rem;
          padding-top: 1.5rem;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .footer-motto {
          font-family: var(--font-body);
          font-size: 0.6875rem;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--color-brand-white);
        }
        .footer-copy {
          font-family: var(--font-body);
          font-size: 0.75rem;
          color: var(--color-brand-border);
        }
      `}</style>
    </footer>
  );
}
