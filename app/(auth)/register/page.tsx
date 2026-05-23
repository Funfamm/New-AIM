import { registerUser } from "@/lib/actions/auth";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Create Account" };

export default function RegisterPage() {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <Link href="/" className="auth-logo">AIM<span>Studio</span></Link>
          <h1 className="auth-title">Create account</h1>
          <p className="auth-sub">Free — no credit card required</p>
        </div>

        <form action={registerUser} className="auth-form">
          <div className="form-group">
            <label className="form-label">Name <span className="form-optional">(optional)</span></label>
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
          <button type="submit" className="auth-btn">Create Account</button>
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
        .auth-header { text-align: center; margin-bottom: 2rem; }
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
        .auth-form { display: flex; flex-direction: column; gap: 1.1rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.4rem; }
        .form-label {
          font-family: var(--font-body);
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--color-brand-light);
        }
        .form-optional {
          color: var(--color-brand-muted);
          font-weight: 400;
        }
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
          margin-top: 0.5rem;
          transition: opacity 0.2s;
        }
        .auth-btn:hover { opacity: 0.88; }
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
