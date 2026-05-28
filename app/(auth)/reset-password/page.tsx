import { resetPassword } from "@/lib/actions/auth";
import Link from "next/link";
import type { Metadata } from "next";
import "./reset.css";

export const metadata: Metadata = { title: "Reset Password — AIM Studio" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string; error?: string }>;
}) {
  const params = await searchParams;
  const token = params?.token?.trim();
  const email = params?.email?.trim();

  // Neither token nor email — show a generic invalid message
  if (!token && !email) {
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

  // Code flow (user-initiated): email in URL, user enters 6-digit code
  // Token flow (admin-initiated): token in URL, hidden field
  const isCodeFlow = !!email && !token;

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <Link href="/" className="auth-logo">AIM<span>Studio</span></Link>
          <h1 className="auth-title">Choose a New Password</h1>
          <p className="auth-sub">
            {isCodeFlow
              ? "Enter the 6-digit code sent to your email."
              : "Must be at least 8 characters."}
          </p>
        </div>

        {params?.error && (
          <div className="auth-error">{params.error}</div>
        )}

        <form action={resetPassword} className="auth-form">
          {/* Token flow: pass raw token as hidden field */}
          {token && <input type="hidden" name="token" value={token} />}

          {/* Code flow: pass email + visible code input */}
          {isCodeFlow && (
            <>
              <input type="hidden" name="email" value={email} />
              <div className="form-group">
                <label className="form-label">Verification code</label>
                <input
                  type="text"
                  name="code"
                  className="form-input code-input"
                  placeholder="000000"
                  required
                  maxLength={6}
                  minLength={6}
                  pattern="[0-9]{6}"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                />
              </div>
            </>
          )}

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

        {isCodeFlow && (
          <p className="auth-resend">
            Didn&apos;t receive a code?{" "}
            <Link href="/forgot-password">Send again</Link>
          </p>
        )}

        <p className="auth-switch">
          <Link href="/login">Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}
