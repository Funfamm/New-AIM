"use client";

import { useState } from "react";

type MediaType = "full" | "trailer" | "preview";

type MaskSetting = {
  mediaType: MediaType;
  filmstripMaskEnabled: boolean;
  filmstripMaskHeight: number;
  filmstripMaskOpacity: number;
};

type MediaConfig = {
  key: MediaType;
  label: string;
  available: boolean;
};

type Props = {
  workId: string;
  initialSettings: MaskSetting[];
  hasVideo: boolean;
  hasTrailer: boolean;
  hasPreview: boolean;
};

const DEFAULTS: Omit<MaskSetting, "mediaType"> = {
  filmstripMaskEnabled: false,
  filmstripMaskHeight: 12,
  filmstripMaskOpacity: 96,
};

function getSetting(settings: MaskSetting[], mediaType: MediaType): MaskSetting {
  return settings.find((s) => s.mediaType === mediaType) ?? { mediaType, ...DEFAULTS };
}

export default function VideoMaskPanel({
  workId, initialSettings, hasVideo, hasTrailer, hasPreview,
}: Props) {
  const [settings, setSettings] = useState<MaskSetting[]>(initialSettings);
  const [saving, setSaving] = useState<MediaType | null>(null);
  const [status, setStatus] = useState<Record<MediaType, "idle" | "saved" | "error">>({
    full: "idle", trailer: "idle", preview: "idle",
  });

  const mediaTypes: MediaConfig[] = [
    { key: "full",    label: "Full Film", available: hasVideo },
    { key: "trailer", label: "Trailer",   available: hasTrailer },
    { key: "preview", label: "Preview",   available: hasPreview },
  ];

  function updateSetting(mediaType: MediaType, patch: Partial<MaskSetting>) {
    setSettings((prev) => {
      const existing = getSetting(prev, mediaType);
      const updated = { ...existing, ...patch };
      const filtered = prev.filter((s) => s.mediaType !== mediaType);
      return [...filtered, updated];
    });
  }

  async function saveMask(mediaType: MediaType) {
    const s = getSetting(settings, mediaType);
    setSaving(mediaType);
    setStatus((prev) => ({ ...prev, [mediaType]: "idle" }));
    try {
      const res = await fetch(`/api/admin/works/${workId}/video-display-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaType,
          filmstripMaskEnabled: s.filmstripMaskEnabled,
          filmstripMaskHeight: s.filmstripMaskHeight,
          filmstripMaskOpacity: s.filmstripMaskOpacity,
        }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        console.error("Mask save failed:", d.error);
        setStatus((prev) => ({ ...prev, [mediaType]: "error" }));
      } else {
        setStatus((prev) => ({ ...prev, [mediaType]: "saved" }));
        setTimeout(() => setStatus((prev) => ({ ...prev, [mediaType]: "idle" })), 3000);
      }
    } catch {
      setStatus((prev) => ({ ...prev, [mediaType]: "error" }));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div style={{
      marginTop: "2rem",
      padding: "1.25rem 1.5rem",
      background: "var(--color-brand-dark)",
      border: "1px solid var(--color-brand-border)",
      borderRadius: 4,
    }}>
      <p style={{
        fontFamily: "var(--font-body)",
        fontSize: "0.8125rem",
        color: "var(--color-brand-muted)",
        margin: "0 0 1rem",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        fontWeight: 600,
      }}>
        Player Mask
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {mediaTypes.map(({ key, label, available }) => {
          const s = getSetting(settings, key);
          const isSaving = saving === key;
          const st = status[key];

          return (
            <div key={key} style={{
              padding: "1rem 1.125rem",
              background: "var(--color-brand-surface)",
              border: `1px solid ${s.filmstripMaskEnabled && available ? "var(--color-brand-accent)" : "var(--color-brand-border)"}`,
              borderRadius: 4,
              opacity: available ? 1 : 0.5,
            }}>
              <p style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "var(--color-brand-light)",
                margin: "0 0 0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}>
                {label}
              </p>

              {!available ? (
                <p style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "0.8125rem",
                  color: "var(--color-brand-muted)",
                  margin: 0,
                }}>
                  No {label.toLowerCase()} uploaded yet.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {/* Enable toggle */}
                  <label style={{
                    display: "flex", alignItems: "center", gap: "0.5rem",
                    fontFamily: "var(--font-body)", fontSize: "0.875rem",
                    color: "var(--color-brand-light)", cursor: "pointer",
                  }}>
                    <input
                      type="checkbox"
                      checked={s.filmstripMaskEnabled}
                      onChange={(e) => updateSetting(key, { filmstripMaskEnabled: e.target.checked })}
                      style={{ accentColor: "var(--color-brand-accent)", width: 14, height: 14 }}
                    />
                    Enable Filmstrip Mask
                  </label>

                  {/* Height slider */}
                  <div>
                    <label style={{
                      display: "block",
                      fontFamily: "var(--font-body)", fontSize: "0.8125rem",
                      color: s.filmstripMaskEnabled ? "var(--color-brand-light)" : "var(--color-brand-muted)",
                      marginBottom: "0.3rem",
                    }}>
                      Mask Height: {s.filmstripMaskHeight}%
                    </label>
                    <input
                      type="range"
                      min={5} max={25} step={1}
                      value={s.filmstripMaskHeight}
                      disabled={!s.filmstripMaskEnabled}
                      onChange={(e) => updateSetting(key, { filmstripMaskHeight: Number(e.target.value) })}
                      style={{
                        width: "100%", maxWidth: 240,
                        accentColor: "var(--color-brand-accent)",
                        opacity: s.filmstripMaskEnabled ? 1 : 0.4,
                      }}
                    />
                  </div>

                  {/* Opacity slider */}
                  <div>
                    <label style={{
                      display: "block",
                      fontFamily: "var(--font-body)", fontSize: "0.8125rem",
                      color: s.filmstripMaskEnabled ? "var(--color-brand-light)" : "var(--color-brand-muted)",
                      marginBottom: "0.3rem",
                    }}>
                      Mask Opacity: {s.filmstripMaskOpacity}%
                    </label>
                    <input
                      type="range"
                      min={60} max={100} step={1}
                      value={s.filmstripMaskOpacity}
                      disabled={!s.filmstripMaskEnabled}
                      onChange={(e) => updateSetting(key, { filmstripMaskOpacity: Number(e.target.value) })}
                      style={{
                        width: "100%", maxWidth: 240,
                        accentColor: "var(--color-brand-accent)",
                        opacity: s.filmstripMaskEnabled ? 1 : 0.4,
                      }}
                    />
                  </div>

                  {/* Save button + feedback */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.25rem" }}>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => saveMask(key)}
                      style={{
                        fontFamily: "var(--font-body)", fontSize: "0.8125rem", fontWeight: 600,
                        padding: "0.4rem 0.9rem",
                        background: isSaving ? "var(--color-brand-border)" : "var(--color-brand-accent)",
                        color: isSaving ? "var(--color-brand-muted)" : "#000",
                        border: "none", borderRadius: 3, cursor: isSaving ? "not-allowed" : "pointer",
                        transition: "background 0.15s, color 0.15s",
                      }}
                    >
                      {isSaving ? "Saving…" : "Save Mask Settings"}
                    </button>
                    {st === "saved" && (
                      <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "#4ade80" }}>
                        Mask settings saved.
                      </span>
                    )}
                    {st === "error" && (
                      <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--color-brand-red)" }}>
                        Failed to save mask settings.
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
