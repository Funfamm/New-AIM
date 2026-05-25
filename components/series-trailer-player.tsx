"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Play, X } from "lucide-react";
import "./series-trailer-player.css";

type Props = {
  posterUrl: string | null;
  trailerUrl: string | null;
  title: string;
};

export default function SeriesTrailerPlayer({ posterUrl, trailerUrl, title }: Props) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  function handlePlay() {
    setPlaying(true);
    // Let the browser start loading; autoPlay handles the rest
  }

  function handleStop() {
    setPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = ""; // release the resource
    }
  }

  return (
    <div className="stp-wrap">
      {playing && trailerUrl ? (
        <>
          <video
            ref={videoRef}
            src={trailerUrl}
            className="stp-video"
            controls
            autoPlay
            playsInline
            preload="metadata"
          />
          <button className="stp-close" onClick={handleStop} aria-label="Close trailer">
            <X size={15} />
          </button>
        </>
      ) : (
        <>
          {posterUrl ? (
            <Image
              src={posterUrl}
              alt={title}
              fill
              className="stp-poster"
              priority
              quality={85}
              sizes="100vw"
            />
          ) : (
            <div className="stp-poster-placeholder" aria-hidden="true">
              {title.charAt(0)}
            </div>
          )}

          <div className="stp-gradient" aria-hidden="true" />

          {/* Only show button if a trailer exists */}
          {trailerUrl && (
            <button className="stp-play-btn" onClick={handlePlay}>
              <Play size={16} fill="currentColor" />
              Watch Trailer
            </button>
          )}
        </>
      )}
    </div>
  );
}
