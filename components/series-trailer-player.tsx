"use client";

import { useState, useRef, useEffect } from "react";
import type HlsType from "hls.js";
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
  const hlsRef = useRef<HlsType | null>(null);

  // HLS support for Chrome/Edge when trailerUrl is a .m3u8 manifest
  useEffect(() => {
    if (!playing || !trailerUrl || !trailerUrl.endsWith(".m3u8")) return;
    const video = videoRef.current;
    if (!video) return;
    // Safari handles HLS natively
    if (video.canPlayType("application/vnd.apple.mpegurl")) return;

    let cancelled = false;
    void (async () => {
      const { default: Hls } = await import("hls.js");
      if (cancelled || !Hls.isSupported()) return;
      const hls = new Hls({ enableWorker: true });
      hlsRef.current = hls;
      // Clear the src React set from JSX before hls.js takes over
      video.removeAttribute("src");
      hls.loadSource(trailerUrl);
      hls.attachMedia(video);
    })();

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [playing, trailerUrl]);

  function handlePlay() {
    setPlaying(true);
    // Let the browser start loading; autoPlay handles the rest
  }

  function handleStop() {
    setPlaying(false);
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
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
            controlsList="nodownload"
            disablePictureInPicture
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

          {/* Play icon only — no text. The duplicate Watch Trailer text CTA
              lives in the main detail-actions group below the genre line. */}
          {trailerUrl && (
            <button className="stp-play-btn" onClick={handlePlay} aria-label="Play trailer">
              <Play size={20} fill="currentColor" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
