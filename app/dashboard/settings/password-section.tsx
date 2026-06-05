"use client";

import { useState, useTransition, useActionState, useEffect } from "react";
import {
  requestDashboardPasswordCode,
  verifyDashboardPasswordCode,
  changeDashboardPassword,
  createDashboardPassword,
  type PwdVerifyState,
  type PwdChangeState,
} from "@/lib/actions/dashboard-password";
import { PasswordInput } from "@/components/password-input";

type Step = "idle" | "requesting" | "code-sent" | "changing" | "done";

export default function PasswordSection({ hasPassword }: { hasPassword: boolean }) {
  const [step, setStep] = useState<Step>("idle");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [verifiedCode, setVerifiedCode] = useState<string | null>(null);
  const [codeValue, setCodeValue] = useState("");
  const [isPending, startTransition] = useTransition();

  const [verifyState, verifyAction] = useActionState<PwdVerifyState, FormData>(
    verifyDashboardPasswordCode,
    null,
  );
  const [pwdState, pwdAction] = useActionState<PwdChangeState, FormData>(
    hasPassword ? changeDashboardPassword : createDashboardPassword,
    null,
  );

  useEffect(() => {
    if (verifyState?.verified && codeValue) {
      setVerifiedCode(codeValue);
      setStep("changing");
    }
  }, [verifyState, codeValue]);

  useEffect(() => {
    if (pwdState?.ok) {
      setStep("done");
    }
  }, [pwdState]);

  function cancel() {
    setStep("idle");
    setRequestError(null);
    setVerifiedCode(null);
    setCodeValue("");
  }

  function handleRequestCode() {
    setRequestError(null);
    setStep("requesting");
    startTransition(async () => {
      const result = await requestDashboardPasswordCode();
      if (result.ok) {
        setStep("code-sent");
      } else {
        setRequestError(result.error ?? "Failed to send code. Please try again.");
        setStep("idle");
      }
    });
  }

  if (step === "done") {
    return (
      <div className="pwd-section pwd-section--success">
        <p className="pwd-success-msg">
          Password {hasPassword ? "updated" : "created"} successfully.
        </p>
        <button type="button" onClick={cancel} className="pwd-cancel-btn">
          Done
        </button>
      </div>
    );
  }

  if (step === "idle" || step === "requesting") {
    return (
      <div className="settings-toggle-row settings-toggle-row--plain">
        <div>
          <p className="settings-toggle-label">Password</p>
          <p className="settings-toggle-desc">
            {hasPassword
              ? "Verify your identity then choose a new password"
              : "Add a password to sign in with email"}
          </p>
          {requestError && <p className="pwd-error">{requestError}</p>}
        </div>
        <button
          type="button"
          className="settings-text-link"
          onClick={handleRequestCode}
          disabled={isPending}
        >
          {isPending ? "Sending…" : hasPassword ? "Change" : "Create password"}
        </button>
      </div>
    );
  }

  if (step === "code-sent") {
    return (
      <div className="pwd-section">
        <p className="pwd-hint">
          A 6-digit code was sent to your email. Enter it below.
        </p>
        {verifyState?.error && <p className="pwd-error">{verifyState.error}</p>}
        <form action={verifyAction} className="pwd-form">
          <div className="pwd-field">
            <label className="settings-field-label">Verification code</label>
            <input
              type="text"
              name="code"
              className="settings-text-input pwd-code-input"
              placeholder="000000"
              required
              maxLength={6}
              minLength={6}
              pattern="[0-9]{6}"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={codeValue}
              onChange={(e) => setCodeValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </div>
          <div className="pwd-actions">
            <button type="submit" className="settings-save-btn">
              Verify Code
            </button>
            <button type="button" className="pwd-cancel-btn" onClick={cancel}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (step === "changing") {
    return (
      <div className="pwd-section">
        <p className="pwd-hint">
          {hasPassword
            ? "Enter your current password and choose a new one."
            : "Choose a password for your account."}
        </p>
        {pwdState?.error && <p className="pwd-error">{pwdState.error}</p>}
        <form action={pwdAction} className="pwd-form">
          <input type="hidden" name="code" value={verifiedCode ?? ""} />
          {hasPassword && (
            <div className="pwd-field">
              <label className="settings-field-label">Current password</label>
              <PasswordInput
                name="current"
                inputClassName="settings-text-input"
                autoComplete="current-password"
                required
              />
            </div>
          )}
          <div className="pwd-field">
            <label className="settings-field-label">New password</label>
            <PasswordInput
              name="password"
              inputClassName="settings-text-input"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div className="pwd-field">
            <label className="settings-field-label">Confirm password</label>
            <PasswordInput
              name="confirm"
              inputClassName="settings-text-input"
              placeholder="Repeat new password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div className="pwd-actions">
            <button type="submit" className="settings-save-btn">
              {hasPassword ? "Update Password" : "Create Password"}
            </button>
            <button type="button" className="pwd-cancel-btn" onClick={cancel}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return null;
}
