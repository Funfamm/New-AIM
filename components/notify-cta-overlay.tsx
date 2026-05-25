"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { notifyMeSignup } from "@/lib/actions/notify-cta";
import { beacon } from "@/lib/beacon";
import "./notify-cta-overlay.css";

export type CtaData = {
  id: string;
  type: string;
  headline: string;
  body: string | null;
  ctaLabel: string;
  triggerSecondsFromEnd: number;
  workId: string;
  workTitle: string | null;
};

type Props = {
  cta: CtaData;
  onDismiss: () => void;
};

const TYPE_BADGE: Record<string, string> = {
  RELEASE:      "Coming Soon",
  MORE:         "More on the Way",
  POST_RELEASE: "What's Next",
};

export default function NotifyMeCtaOverlay({ cta, onDismiss }: Props) {
  const [email, setEmail] = useState("");
  const [name, setName]   = useState("");
  const [done, setDone]   = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start]  = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await notifyMeSignup(
        cta.id, cta.workId, cta.workTitle, email, name || undefined
      );
      if (!res.ok) {
        setError(res.error ?? "Something went wrong.");
        return;
      }
      // Persist signed-up flag in localStorage — prevents CTA reappearing in this browser
      try { localStorage.setItem(`aim_cta_signed_${cta.id}`, "1"); } catch {}
      beacon("CTA_SIGNUP", { workId: cta.workId, metadata: { ctaId: cta.id } });
      setDone(true);
      // Auto-dismiss after showing the thank-you state
      setTimeout(onDismiss, 2400);
    });
  }

  return (
    <div className="ncta-overlay" role="dialog" aria-label="Stay in the loop">
      <button className="ncta-close" onClick={onDismiss} aria-label="Dismiss">
        <X size={13} />
      </button>

      <span className="ncta-badge">{TYPE_BADGE[cta.type] ?? cta.type}</span>

      {done ? (
        <div className="ncta-done">
          <p className="ncta-done-msg">You&apos;re on the list.</p>
        </div>
      ) : (
        <>
          <p className="ncta-headline">{cta.headline}</p>
          {cta.body && <p className="ncta-body">{cta.body}</p>}

          <form className="ncta-form" onSubmit={handleSubmit}>
            <input
              className="ncta-input"
              type="text"
              placeholder="Name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={pending}
              autoComplete="name"
            />
            <input
              className="ncta-input"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={pending}
              autoComplete="email"
            />
            {error && <p className="ncta-error">{error}</p>}
            <button className="ncta-btn" type="submit" disabled={pending}>
              {pending ? "…" : cta.ctaLabel}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
