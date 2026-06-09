"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { likeWork, unlikeWork } from "@/lib/actions/likes";
import { useToast } from "./toast-context";
import "./action-buttons.css";

type Props = {
  workId: string;
  initialLiked: boolean;
  likeCount: number;
  isGuest: boolean;
  slug: string;
  size?: "default" | "sm";
};

export default function LikeButton({
  workId,
  initialLiked,
  likeCount,
  isGuest,
  slug,
  size = "default",
}: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(likeCount);
  const [anim, setAnim] = useState(false);
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  function toggle() {
    if (isGuest) {
      window.location.href = `/login?from=/works/${slug}`;
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
      {count > 0 && <span className="action-btn-count">{count}</span>}
      <span>{liked ? "Liked" : "Like"}</span>
    </button>
  );
}
