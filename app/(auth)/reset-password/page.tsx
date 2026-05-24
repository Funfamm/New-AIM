import { resetPassword } from "@/lib/actions/auth";
import Link from "next/link";
import type { Metadata } from "next";
import "./reset.css";

export const metadata: Metadata = { title: "Reset Password — AIM Studio" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const params = await searchParams;
  const token = params?.token?.trim();

  // No token in URL — show a generic invalid-link message
  if (!token) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <div className="auth-header">
            <Link href="/" className="auth-logo">AIM<span>Studio</span></Link>
            <h1 className="auth-title">Reset Password</h1>
          </div>
          <p className="auth-invalid">
            This reset link is invalid or has expired.{" "}
            <Link href="/forgot-password">Request a new one.</Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <Link href="/" className="auth-logo">AIM<span>Studio</span></Link>
          <h1 className="auth-title">Choose a New Password</h1>
          <p className="auth-sub">Must be at least 8 characters.</p>
        </div>

        {params?.error && (
          <div className="auth-error">{params.error}</div>
        )}

        <form action={resetPassword} className="auth-form">
          {/* Pass raw token through the form — action hashes it before DB lookup */}
          <input type="hidden" name="token" value={token} />

          <div className="form-group">
            <label className="form-label">New password</label>
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

          <div className="form-group">
            <label className="form-label">Confirm new password</label>
            <input
              type="password"
              name="confirm"
              className="form-input"
              placeholder="Repeat your new password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <button type="submit" className="auth-btn">Update Password</button>
        </form>

        <p className="auth-switch">
          <Link href="/login">Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}
