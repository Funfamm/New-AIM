import { registerUser } from "@/lib/actions/auth";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Join the Studio — AIM Studio" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <Link href="/" className="auth-logo">AIM<span>Studio</span></Link>
          <h1 className="auth-title">Join the Studio</h1>
          <p className="auth-sub">Free forever. Always will be.</p>
        </div>

        {/* Three quick wins */}
        <ul className="auth-perks">
          <li className="auth-perk">
            <span className="auth-perk-icon" aria-hidden="true">🎬</span>
            Watch full films free
          </li>
          <li className="auth-perk">
            <span className="auth-perk-icon" aria-hidden="true">🎭</span>
            Apply for casting opportunities
          </li>
          <li className="auth-perk">
            <span className="auth-perk-icon" aria-hidden="true">💬</span>
            Join the community
          </li>
        </ul>

        {params?.error && (
          <div className="auth-error">{params.error}</div>
        )}

        <form action={registerUser} className="auth-form">
          <div className="form-group">
            <label className="form-label">
              Name <span className="form-optional">(optional)</span>
            </label>
            <input
              type="text"
              name="name"
              className="form-input"
              placeholder="Your name"
              autoComplete="name"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              name="email"
              className="form-input"
              placeholder="your@email.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              name="password"
              className="form-input"
              placeholder="At least 8 characters"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <button type="submit" className="auth-btn">Create My Account</button>
          <p className="auth-fine-print">
            By creating an account, you agree to our{" "}
            <Link href="/terms">Terms</Link> and{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </form>

        <p className="auth-switch">
          Already have an account?{" "}
          <Link href="/login">Sign in</Link>
        </p>
      </div>

      <style>{`
        .auth-page {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem 1rem;
          background: var(--color-brand-black);
        }
        .auth-card {
          width: 100%;
          max-width: 420px;
          background: var(--color-brand-dark);
          border: 1px solid var(--color-brand-border);
          border-radius: 12px;
          padding: 2.5rem 2rem;
        }
        .auth-header { text-align: center; margin-bottom: 1.5rem; }
        .auth-logo {
          display: inline-block;
          font-family: var(--font-display);
          font-size: 1.4rem;
          font-weight: 900;
          color: var(--color-brand-white);
          text-decoration: none;
          margin-bottom: 1.5rem;
        }
        .auth-logo span { color: var(--color-brand-accent); }
        .auth-title {
          font-family: var(--font-display);
          font-size: 1.6rem;
          font-weight: 700;
          color: var(--color-brand-white);
          margin: 0 0 0.4rem;
        }
        .auth-sub {
          font-family: var(--font-body);
          font-size: 0.875rem;
          color: var(--color-brand-muted);
          margin: 0;
        }

        /* Quick wins */
        .auth-perks {
          list-style: none;
          margin: 0 0 1.75rem;
          padding: 1rem;
          background: var(--color-brand-surface);
          border-radius: 6px;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }
        .auth-perk {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          font-family: var(--font-body);
          font-size: 0.85rem;
          color: var(--color-brand-light);
        }
        .auth-perk-icon { font-size: 1rem; flex-shrink: 0; }

        .auth-error {
          background: rgba(192,57,43,0.15);
          border: 1px solid var(--color-brand-red);
          color: #e74c3c;
          font-family: var(--font-body);
          font-size: 0.85rem;
          padding: 0.75rem 1rem;
          border-radius: 6px;
          margin-bottom: 1.25rem;
        }
        .auth-form { display: flex; flex-direction: column; gap: 1.1rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.4rem; }
        .form-label {
          font-family: var(--font-body);
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--color-brand-light);
        }
        .form-optional { color: var(--color-brand-muted); font-weight: 400; }
        .form-input {
          font-family: var(--font-body);
          font-size: 0.95rem;
          color: var(--color-brand-white);
          background: var(--color-brand-surface);
          border: 1px solid var(--color-brand-border);
          border-radius: 6px;
          padding: 0.7rem 0.9rem;
          outline: none;
          transition: border-color 0.2s;
          width: 100%;
          box-sizing: border-box;
        }
        .form-input::placeholder { color: var(--color-brand-muted); }
        .form-input:focus { border-color: var(--color-brand-accent); }
        .auth-btn {
          width: 100%;
          font-family: var(--font-body);
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--color-brand-black);
          background: var(--color-brand-accent);
          border: none;
          border-radius: 6px;
          padding: 0.8rem;
          cursor: pointer;
          margin-top: 0.25rem;
          transition: opacity 0.2s;
        }
        .auth-btn:hover { opacity: 0.88; }
        .auth-fine-print {
          font-family: var(--font-body);
          font-size: 0.75rem;
          color: var(--color-brand-muted);
          text-align: center;
          line-height: 1.5;
          margin: 0;
        }
        .auth-fine-print a { color: var(--color-brand-muted); text-decoration: underline; }
        .auth-fine-print a:hover { color: var(--color-brand-light); }
        .auth-switch {
          text-align: center;
          font-family: var(--font-body);
          font-size: 0.85rem;
          color: var(--color-brand-muted);
          margin-top: 1.5rem;
        }
        .auth-switch a {
          color: var(--color-brand-accent);
          text-decoration: none;
          font-weight: 500;
        }
        .auth-switch a:hover { text-decoration: underline; }
      `}</style>
    </main>
  );
}
