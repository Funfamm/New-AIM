"use client";

// Card action buttons for History tab announcements.
// Reuses existing publishAnnouncement / unpublishAnnouncement / deleteAnnouncement.

import { useState, useTransition } from "react";
import {
  publishAnnouncement,
  unpublishAnnouncement,
  deleteAnnouncement,
} from "@/lib/actions/announcements";

type Props = {
  id:          string;
  isPublished: boolean;
};

export default function OutreachCardActions({ id, isPublished }: Props) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  function run(action: () => Promise<{ error?: string; created?: number; queued?: number }>) {
    setMsg(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setMsg({ text: result.error, ok: false });
      } else if ("created" in result) {
        const parts: string[] = [];
        if (result.created) parts.push(`${result.created} in-app`);
        if (result.queued)  parts.push(`${result.queued} email${result.queued === 1 ? "" : "s"} queued`);
        setMsg({ text: parts.length ? `Published — ${parts.join(", ")}` : "Published", ok: true });
      } else {
        setMsg({ text: "Done", ok: true });
      }
    });
  }

  return (
    <div>
      <div className="outreach-card-actions">
        {!isPublished ? (
          <button
            className="outreach-action-btn"
            disabled={pending}
            onClick={() => run(() => publishAnnouncement(id))}
          >
            {pending ? "Publishing…" : "Publish"}
          </button>
        ) : (
          <button
            className="outreach-action-btn"
            disabled={pending}
            onClick={() => run(() => unpublishAnnouncement(id))}
          >
            {pending ? "Unpublishing…" : "Unpublish"}
          </button>
        )}
        <button
          className="outreach-action-btn outreach-action-btn--danger"
          disabled={pending}
          onClick={() => {
            if (confirm("Delete this announcement? This cannot be undone.")) {
              run(() => deleteAnnouncement(id));
            }
          }}
        >
          Delete
        </button>
      </div>
      {msg && (
        <p className={`outreach-action-msg ${msg.ok ? "outreach-action-msg--ok" : "outreach-action-msg--err"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
