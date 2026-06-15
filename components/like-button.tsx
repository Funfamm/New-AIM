"use client";

import { useState, useEffect, useTransition } from "react";
import { Heart } from "lucide-react";
import { likeWork, unlikeWork } from "@/lib/actions/likes";
import { useToast } from "./toast-context";
// CSS imported at route level (app/(public)/works/[slug]/page.tsx) to avoid
// late-loading during client-side navigation.

const guestLikeKey = (workId: string) => `aim-liked-${workId}`;

type Props = {
  workId: string;
  initialLiked: boolean;
  likeCount: number;
  isGuest: boolean;
  size?: "default" | "sm";
};

export default function LikeButton({
  workId,
  initialLiked,
  likeCount,
  isGuest,
  size = "default",
}: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(likeCount);
  const [anim, setAnim] = useState(false);
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  // Guest: restore liked state from localStorage on mount
  useEffect(() => {
    if (!isGuest) return;
    try {
      const stored = localStorage.getItem(guestLikeKey(workId));
      if (stored === "1") {
        setLiked(true);
        setCount((c) => c + 1);
      }
    } catch { /* localStorage unavailable */ }
  }, [isGuest, workId]);

  function toggle() {
    if (isGuest) {
      const next = !liked;
      setLiked(next);
      setCount((c) => (next ? c + 1 : Math.max(0, c - 1)));
      try {
        if (next) localStorage.setItem(guestLikeKey(workId), "1");
        else localStorage.removeItem(guestLikeKey(workId));
      } catch { /* localStorage unavailable */ }
      if (next) {
        setAnim(true);
        setTimeout(() => setAnim(false), 380);
        showToast("Liked");
      } else {
        showToast("Like removed", "info");
      }
      return;
    }
    const next = !liked;
    setLiked(next);
    setCount((c) => (next ? c + 1 : Math.max(0, c - 1)));
    if (next) {
      setAnim(true);
      setTimeout(() => setAnim(false), 380);
      showToast("Liked");
    } else {
      showToast("Like removed", "info");
    }
    startTransition(async () => {
      try {
        if (next) await likeWork(workId);
        else await unlikeWork(workId);
      } catch {
        setLiked(!next);
        setCount((c) => (!next ? c + 1 : Math.max(0, c - 1)));
      }
    });
  }

  const cls = [
    "action-btn",
    "action-btn--like",
    liked ? "action-btn--liked" : "",
    anim ? "action-btn--like-pop" : "",
    size === "sm" ? "action-btn--sm" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={cls}
      aria-label={liked ? "Unlike this work" : "Like this work"}
      aria-pressed={liked}
    >
      <Heart size={size === "sm" ? 13 : 14} fill={liked ? "currentColor" : "none"} />
      <span>{count > 0 ? `${count} ` : ""}{liked ? "Liked" : "Like"}</span>
    </button>
  );
}
