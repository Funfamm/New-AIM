"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { withdrawApplication } from "@/lib/actions/casting";

export default function TrackingClient({ token }: { token: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleWithdraw() {
    setError(null);
    setLoading(true);
    const result = await withdrawApplication(token);
    if (result.ok) {
      router.refresh();
    } else {
      setError(result.error ?? "Withdrawal failed. Please try again.");
      setLoading(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="casting-withdraw-confirm">
        <p className="casting-withdraw-confirm-text">
          Are you sure you want to withdraw? This cannot be undone.
        </p>
        {error && <p className="casting-field-error">{error}</p>}
        <div className="casting-withdraw-confirm-actions">
          <button
            className="casting-btn casting-btn--ghost"
            onClick={() => { setConfirming(false); setError(null); }}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="casting-btn casting-btn--danger"
            onClick={handleWithdraw}
            disabled={loading}
          >
            {loading ? "Withdrawing…" : "Yes, Withdraw"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="casting-withdraw-section">
      <button
        className="casting-btn casting-btn--ghost casting-btn--sm"
        onClick={() => setConfirming(true)}
      >
        Withdraw Application
      </button>
      <p className="casting-withdraw-note">
        Withdrawal is only available while your application is in Received or Under Review status.
      </p>
    </div>
  );
}
