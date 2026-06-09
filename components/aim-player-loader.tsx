"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

// AimPlayer is heavy (~700 lines) — defer its JS until needed.
// This "use client" wrapper lets the Server Component watch page use dynamic import with ssr: false.
const AimPlayer = dynamic(() => import("./aim-player"), {
  ssr: false,
  loading: () => (
    <div
      className="skeleton"
      style={{
        width: "100%",
        aspectRatio: "16/9",
        borderRadius: "var(--radius-lg)",
        maxHeight: "80vh",
      }}
    />
  ),
});

type AimPlayerProps = ComponentProps<typeof AimPlayer>;

export default function AimPlayerLoader(props: AimPlayerProps) {
  return <AimPlayer {...props} />;
}
