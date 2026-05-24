"use client";
import { useRouter } from "next/navigation";

type Props = {
  src: string;
  poster?: string;
  nextSlug?: string;
};

export default function EpisodePlayer({ src, poster, nextSlug }: Props) {
  const router = useRouter();
  return (
    <video
      src={src}
      className="watch-video"
      controls
      playsInline
      poster={poster}
      onEnded={() => {
        if (nextSlug) router.push(`/watch/${nextSlug}`);
      }}
    />
  );
}
