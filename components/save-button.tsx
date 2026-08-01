"use client";

import { useState, useTransition } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { saveWork, unsaveWork } from "@/lib/actions/watchlist";
import { useToast } from "./toast-context";
// Co-locate the CSS with the component so the pill styles always load with it,
// preventing unstyled-box flashes on client-side navigation (e.g. on hero overlays).
import "./action-buttons.css";

type Props = {
  workId: string;
  initialSaved: boolean;
  className?: string;
};

export default function SaveButton({ workId, initialSaved, className }: Props) {
  const [saved, setSaved] = useState(initialSaved);
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  function toggle() {
    const next = !saved;
    setSaved(next);
    showToast(next ? "Saved to your list" : "Removed from list", next ? "success" : "info");
    startTransition(async () => {
      try {
        if (next) await saveWork(workId);
        else await unsaveWork(workId);
      } catch {
        setSaved(!next);
      }
    });
  }

  const cls = [
    "action-btn",
    "action-btn--save",
    saved ? "action-btn--liked" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={cls}
      aria-label={saved ? "Remove from watchlist" : "Save to watchlist"}
      aria-pressed={saved}
    >
      {saved
        ? <BookmarkCheck size={14} />
        : <Bookmark size={14} />}
      <span>{saved ? "Saved" : "Save"}</span>
    </button>
  );
}

