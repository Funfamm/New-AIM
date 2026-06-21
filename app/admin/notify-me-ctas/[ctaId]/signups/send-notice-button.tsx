"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendNotifyMeFollowupEmails } from "@/lib/actions/notify-me-followup";
import type { FollowupResult } from "@/lib/actions/notify-me-followup";

type Props = {
  ctaId:       string;
  total:       number;   // total signups for this CTA
  acsReady:    boolean;
};

export default function SendNoticeButton({ ctaId, total, acsReady }: Props) {
  const router = useRouter();
  const [pending,   startTransition] = useTransition();
  const [confirmed, setConfirmed]    = useState(false);
  const [result,    setResult]       = useState<FollowupResult | null>(null);

  const canSend = acsReady && total > 0;

  function handleClick() {
    if (!canSend || pending) return;
    if (!confirmed) { setConfirmed(true); return; }
    setResult(null);
    setConfirmed(false);
    startTransition(async () => {
      const r = await sendNotifyMeFollowupEmails(ctaId);
      setResult(r);
      router.refresh(); // re-render server component so badges reflect new status
    });
  }

  // Disabled / no-signups state
  if (!canSend) {
    return (
      <span className="nms-send-btn nms-send-btn--disabled" aria-disabled="true">
        {!acsReady ? "ACS not configured" : "No signups"}
      </span>
    );
  }

  return (
    <span className="nms-send-wrap">
      {/* Result summary — shown inline after send */}
      {result && !result.error && (
        <span className="nms-send-result">
          ✓ {result.queued} sent
          {result.inApp   > 0 ? ` · ${result.inApp} in-app`          : ""}
          {result.skipped > 0 ? ` · ${result.skipped} skipped`        : ""}
          {result.failed  > 0 ? ` · ${result.failed} failed`          : ""}
        </span>
      )}
      {result?.error && (
        <span className="nms-send-result nms-send-result--err">⚠ {result.error}</span>
      )}

      {/* Cancel — shown only during confirmation */}
      {confirmed && !pending && (
        <button
          className="nms-send-cancel"
          onClick={() => setConfirmed(false)}
          type="button"
        >
          Cancel
        </button>
      )}

      {/* Primary button */}
      <button
        className={`nms-send-btn${confirmed ? " nms-send-btn--confirm" : ""}`}
        onClick={handleClick}
        disabled={pending}
        type="button"
      >
        {pending   ? "Sending…"
         : confirmed ? "Confirm →"
         : "Send Notice"}
      </button>
    </span>
  );
}
