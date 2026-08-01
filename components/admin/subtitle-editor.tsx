"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Undo2, Redo2, Save, CheckCircle, Download, Upload, RotateCcw, Languages } from "lucide-react";
import { getLangName } from "@/lib/subtitles/subtitle-languages";
import "./subtitle-editor.css";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SubtitleCue = { start: number; end: number; text: string };

type PlacementState = {
  verticalAnchor: "bottom" | "lower_third" | "middle" | "upper_third" | "top";
  horizontalAlign: "left" | "center" | "right";
  offsetYPercent: number;
  offsetXPercent: number;
  safeAreaMarginPx: number;
  backgroundStyle: "none" | "shadow" | "box";
  fontScale: number;
  cueOverrides: Record<string, Partial<PlacementState>>;
};

type MobilePlacementState = Omit<PlacementState, "backgroundStyle" | "cueOverrides">;

type PreviewDevice = "desktop" | "portrait" | "landscape";

type ZoomMode = "fit" | "fit-height" | "fit-width" | "100" | "75" | "50" | "custom";

type ClearAction = "clear_only" | "archive_and_clear" | "reset_and_clear" | "delete_drafts";

type RevisionItem = { id: string; reason: string; savedAt: string; segmentCount: number };

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_PLACEMENT: PlacementState = {
  verticalAnchor: "lower_third",
  horizontalAlign: "center",
  offsetYPercent: 0,
  offsetXPercent: 0,
  safeAreaMarginPx: 12,
  backgroundStyle: "shadow",
  fontScale: 1.0,
  cueOverrides: {},
};

const DEFAULT_MOBILE: MobilePlacementState = {
  verticalAnchor: "lower_third",
  horizontalAlign: "center",
  offsetYPercent: 0,
  offsetXPercent: 0,
  safeAreaMarginPx: 20,
  fontScale: 1.0,
};

const ANCHOR_PRESETS = [
  { id: "bottom"      , label: "Bottom"      },
  { id: "lower_third" , label: "Lower ⅓"     },
  { id: "middle"      , label: "Middle"       },
  { id: "upper_third" , label: "Upper ⅓"     },
  { id: "top"         , label: "Top"          },
] as const;

const DEVICE_DIMS = {
  desktop: { w: 480, h: 270 },
  portrait: { w: 375, h: 667 },
  landscape: { w: 568, h: 320 },
};

const WARN_LABELS: Record<string, string> = {
  overlap: "Overlap",
  long: "Long cue",
  short: "Short",
  empty: "Empty",
  invalid: "Bad timing",
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  subtitleId: string;
  workId: string;
  videoUrl: string | null;
  mediaType: string;
  initialSegments: SubtitleCue[];
  currentStatus: string;
  sourceLanguage?: string;
  translationsJson?: Record<string, SubtitleCue[]> | null;
  onClose: () => void;
  onSaved: (newStatus: string, newSegments: SubtitleCue[]) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMs(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const ms = Math.round((s % 1) * 1000);
  return `${h > 0 ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(Math.floor(s)).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

function parseTimeStr(v: string): number {
  const clean = v.replace(",", ".");
  const parts = clean.split(":");
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  }
  if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return parseFloat(clean) || 0;
}

function parseSRT(text: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const blocks = text.trim().split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    const tcIdx = lines.findIndex((l) => l.includes(" --> "));
    if (tcIdx < 0) continue;
    const [s, e] = lines[tcIdx].split(" --> ");
    const start = parseTimeStr(s);
    const end = parseTimeStr(e);
    const txt = lines.slice(tcIdx + 1).join("\n").trim();
    if (txt && end > start) cues.push({ start, end, text: txt });
  }
  return cues;
}

function serializeSRT(cues: SubtitleCue[]): string {
  return cues
    .map((c, i) => {
      const fmt = (s: number) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        const ms = Math.round((sec % 1) * 1000);
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(Math.floor(sec)).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
      };
      return `${i + 1}\n${fmt(c.start)} --> ${fmt(c.end)}\n${c.text}`;
    })
    .join("\n\n");
}

function getSubtitleBottom(p: PlacementState | MobilePlacementState, videoH: number = 100): string {
  const margin = (p.safeAreaMarginPx / videoH) * 100;
  const base: Record<string, number> = {
    bottom: margin,
    lower_third: 20 + margin,
    middle: 45,
    upper_third: 65,
    top: 80,
  };
  const b = (base[p.verticalAnchor] ?? margin) + p.offsetYPercent;
  return `${b}%`;
}

function computeFontPx(scale: number, videoW: number): string {
  return `${Math.round(videoW * 0.028 * scale)}px`;
}

function warnCue(cue: SubtitleCue, idx: number, all: SubtitleCue[]): string[] {
  const w: string[] = [];
  if (cue.end <= cue.start) w.push("invalid");
  if (!cue.text.trim()) w.push("empty");
  if (cue.end - cue.start < 0.5) w.push("short");
  if (cue.text.length > 120) w.push("long");
  if (idx > 0 && cue.start < all[idx - 1].end) w.push("overlap");
  return w;
}

// ── TimeInput sub-component ───────────────────────────────────────────────────

function TimeInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  const display = fmtMs(value);

  function commit() {
    const v = parseTimeStr(raw);
    if (!isNaN(v) && v >= 0) onChange(parseFloat(v.toFixed(3)));
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={ref}
        className="se-time-input se-time-input--editing"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        autoFocus
        spellCheck={false}
      />
    );
  }
  return (
    <span
      className="se-time-input"
      onClick={() => { setRaw(display); setEditing(true); }}
      title="Click to edit"
    >{display}</span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SubtitleEditor({
  subtitleId,
  videoUrl,
  initialSegments,
  currentStatus,
  sourceLanguage = "auto",
  translationsJson,
  onClose,
  onSaved,
}: Props) {
  // ── Cue state ──────────────────────────────────────────────────────────────
  const [cues, setCues] = useState<SubtitleCue[]>(initialSegments);
  const [undoStack, setUndoStack] = useState<SubtitleCue[][]>([]);
  const [redoStack, setRedoStack] = useState<SubtitleCue[][]>([]);
  const [activeCue, setActiveCue] = useState<number>(-1);
  const cueRowRefs = useRef<(HTMLDivElement | null)[]>([]);

  // ── Placement (UI-only, not persisted) ─────────────────────────────────────
  const [placement, setPlacement] = useState<PlacementState>({ ...DEFAULT_PLACEMENT });
  const [mobilePlacement, setMobilePlacement] = useState<MobilePlacementState>({ ...DEFAULT_MOBILE });
  const [landscapePlacement, setLandscapePlacement] = useState<MobilePlacementState>({ ...DEFAULT_MOBILE });

  // ── Device preview ─────────────────────────────────────────────────────────
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");
  const [previewedDevices, setPreviewedDevices] = useState<Set<PreviewDevice>>(new Set());
  const [showSafeZones, setShowSafeZones] = useState(false);
  const [showControlsBar, setShowControlsBar] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  // ── Zoom / Pan ─────────────────────────────────────────────────────────────
  const [zoomMode, setZoomMode] = useState<ZoomMode>("fit");
  const [customZoom, setCustomZoom] = useState(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const stageRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const panDragRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null);

  // ── Video ──────────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoTime, setVideoTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoRect, setVideoRect] = useState({ x: 0, y: 0, w: 0, h: 0 });

  // ── Language selector ─────────────────────────────────────────────────────
  // null = editing source; a string like "es" = editing that translation
  const [editingLang, setEditingLang] = useState<string | null>(null);
  const [isModified, setIsModified] = useState(false);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [status, setStatus] = useState(currentStatus);

  // ── Revision history ───────────────────────────────────────────────────────
  const [showRevisions, setShowRevisions] = useState(false);
  const [revisions, setRevisions] = useState<RevisionItem[]>([]);
  const [loadingRevisions, setLoadingRevisions] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearAction, setClearAction] = useState<ClearAction>("clear_only");
  const [clearReason, setClearReason] = useState("");
  const [clearing, setClearing] = useState(false);

  const dim = DEVICE_DIMS[previewDevice];

  // ── Effective zoom ─────────────────────────────────────────────────────────
  const effectiveScale = useMemo(() => {
    if (!stageRef.current) return 1;
    const stage = stageRef.current.getBoundingClientRect();
    const w = stage.width - 40;
    const h = stage.height - 40;
    if (zoomMode === "fit") return Math.min(w / dim.w, h / dim.h, 1);
    if (zoomMode === "fit-height") return Math.min(h / dim.h, 1);
    if (zoomMode === "fit-width") return Math.min(w / dim.w, 1);
    if (zoomMode === "100") return 1;
    if (zoomMode === "75") return 0.75;
    if (zoomMode === "50") return 0.5;
    return customZoom;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomMode, customZoom, previewDevice, dim.w, dim.h]);

  const canPan = effectiveScale > 0.99;

  function resetView() {
    setZoomMode(previewDevice === "portrait" ? "fit-height" : "fit");
    setPanOffset({ x: 0, y: 0 });
  }

  // Pan drag
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!panDragRef.current) return;
      const dx = e.clientX - panDragRef.current.startX;
      const dy = e.clientY - panDragRef.current.startY;
      setPanOffset({ x: panDragRef.current.startPanX + dx, y: panDragRef.current.startPanY + dy });
    }
    function onMouseUp() { panDragRef.current = null; }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
  }, []);

  // ── Video rect ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    function calcRect() {
      if (!vid || !previewRef.current) return;
      const cw = dim.w;
      const ch = dim.h;
      if (!vid.videoWidth || !vid.videoHeight) { setVideoRect({ x: 0, y: 0, w: cw, h: ch }); return; }
      const r = vid.videoWidth / vid.videoHeight;
      let rw = cw, rh = ch;
      if (cw / ch > r) { rw = ch * r; } else { rh = cw / r; }
      const rx = (cw - rw) / 2;
      const ry = (ch - rh) / 2;
      setVideoRect({ x: Math.round(rx), y: Math.round(ry), w: Math.round(rw), h: Math.round(rh) });
    }
    vid.addEventListener("loadedmetadata", calcRect);
    vid.addEventListener("resize", calcRect);
    calcRect();
    return () => { vid.removeEventListener("loadedmetadata", calcRect); vid.removeEventListener("resize", calcRect); };
  }, [dim.w, dim.h, videoUrl]);

  // ── Video time sync / active cue ───────────────────────────────────────────
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    function onTime() { setVideoTime(vid!.currentTime); }
    function onDuration() { setVideoDuration(vid!.duration); }
    vid.addEventListener("timeupdate", onTime);
    vid.addEventListener("durationchange", onDuration);
    return () => { vid.removeEventListener("timeupdate", onTime); vid.removeEventListener("durationchange", onDuration); };
  }, []);

  useEffect(() => {
    const idx = cues.findIndex((c) => videoTime >= c.start && videoTime < c.end);
    if (idx !== activeCue) setActiveCue(idx);
  }, [videoTime, cues, activeCue]);

  // ── Active cue text ────────────────────────────────────────────────────────
  const activePlacement = previewDevice === "desktop" ? placement : previewDevice === "portrait" ? mobilePlacement : landscapePlacement;
  const activeCueText = activeCue >= 0 && cues[activeCue] ? cues[activeCue].text : null;

  // ── Cue warnings ───────────────────────────────────────────────────────────
  const cueWarnings = useMemo(() => cues.map((c, i) => warnCue(c, i, cues)), [cues]);
  const warningCount = cueWarnings.filter((w) => w.some((x) => x === "long" || x === "short" || x === "overlap")).length;
  const hardErrors = cueWarnings.filter((w) => w.some((x) => x === "invalid" || x === "empty")).length;

  // ── Undo/Redo helpers ──────────────────────────────────────────────────────
  function snapshot(prev: SubtitleCue[]) {
    setUndoStack((s) => [...s.slice(-49), prev]);
    setRedoStack([]);
    setIsModified(true);
  }

  function undo() {
    setUndoStack((s) => {
      if (!s.length) return s;
      const prev = s[s.length - 1];
      setRedoStack((r) => [...r, cues]);
      setCues(prev);
      return s.slice(0, -1);
    });
  }

  function redo() {
    setRedoStack((r) => {
      if (!r.length) return r;
      const next = r[r.length - 1];
      setUndoStack((s) => [...s, cues]);
      setCues(next);
      return r.slice(0, -1);
    });
  }

  // ── Cue operations ─────────────────────────────────────────────────────────
  const updateCue = useCallback((idx: number, patch: Partial<SubtitleCue>) => {
    setCues((prev) => {
      snapshot(prev);
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }, []);

  const deleteCue = useCallback((idx: number) => {
    setCues((prev) => { snapshot(prev); return prev.filter((_, i) => i !== idx); });
    setActiveCue(-1);
  }, []);

  const insertAfter = useCallback((idx: number) => {
    setCues((prev) => {
      snapshot(prev);
      const next = [...prev];
      const after = next[idx];
      const start = after ? after.end + 0.1 : 0;
      const newCue: SubtitleCue = { start, end: start + 2, text: "" };
      next.splice(idx + 1, 0, newCue);
      return next;
    });
    setTimeout(() => setActiveCue(idx + 1), 50);
  }, []);

  const splitCue = useCallback((idx: number) => {
    setCues((prev) => {
      snapshot(prev);
      const c = prev[idx];
      if (!c) return prev;
      const mid = parseFloat(((c.start + c.end) / 2).toFixed(3));
      const next = [...prev];
      const words = c.text.split(" ");
      const half = Math.ceil(words.length / 2);
      next.splice(idx, 1,
        { start: c.start, end: mid, text: words.slice(0, half).join(" ") },
        { start: mid, end: c.end, text: words.slice(half).join(" ") }
      );
      return next;
    });
  }, []);

  const mergeCue = useCallback((idx: number) => {
    setCues((prev) => {
      snapshot(prev);
      if (idx >= prev.length - 1) return prev;
      const a = prev[idx], b = prev[idx + 1];
      const merged = { start: a.start, end: b.end, text: `${a.text} ${b.text}`.trim() };
      const next = [...prev];
      next.splice(idx, 2, merged);
      return next;
    });
  }, []);

  const setCueOverride = useCallback((idx: number, patch: Partial<PlacementState> | null) => {
    setPlacement((prev) => {
      const overrides = { ...prev.cueOverrides };
      if (patch === null) delete overrides[String(idx)];
      else overrides[String(idx)] = { ...overrides[String(idx)], ...patch };
      return { ...prev, cueOverrides: overrides };
    });
  }, []);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if (e.key === "Escape") { onClose(); return; }

      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); saveDraft(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); return; }

      if (isInput) return;

      if (e.key === " ") {
        e.preventDefault();
        const v = videoRef.current;
        if (v) { if (v.paused) v.play().catch(() => {}); else v.pause(); }
        return;
      }
      if (e.key === "j") { const v = videoRef.current; if (v) { v.pause(); v.currentTime = Math.max(0, v.currentTime - 0.04); } return; }
      if (e.key === "l") { const v = videoRef.current; if (v) { v.pause(); v.currentTime += 0.04; } return; }
      if (e.key === "ArrowLeft") { const v = videoRef.current; if (v) v.currentTime = Math.max(0, v.currentTime - 5); return; }
      if (e.key === "ArrowRight") { const v = videoRef.current; if (v) v.currentTime = Math.min(v.duration || 999, v.currentTime + 5); return; }
      if (e.key === "i") {
        const v = videoRef.current;
        if (v && activeCue >= 0) updateCue(activeCue, { start: parseFloat(v.currentTime.toFixed(3)) });
        return;
      }
      if (e.key === "o") {
        const v = videoRef.current;
        if (v && activeCue >= 0) updateCue(activeCue, { end: parseFloat(v.currentTime.toFixed(3)) });
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCue, cues]);

  // ── Subtitle drag ──────────────────────────────────────────────────────────
  const subtitleDragRef = useRef<{ startY: number; startOffset: number } | null>(null);

  function handlePreviewDragStart(e: React.MouseEvent | React.TouchEvent) {
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    subtitleDragRef.current = { startY: clientY, startOffset: activePlacement.offsetYPercent };

    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!subtitleDragRef.current || !stageRef.current) return;
      const cy = "touches" in ev ? (ev as TouchEvent).touches[0].clientY : (ev as MouseEvent).clientY;
      const dy = cy - subtitleDragRef.current.startY;
      const stageH = stageRef.current.getBoundingClientRect().height;
      const pct = (dy / stageH) * 100 * (1 / effectiveScale);
      const newOffsetY = parseFloat((subtitleDragRef.current!.startOffset - pct).toFixed(1));
      setActivePlacement({ offsetYPercent: newOffsetY });
    };
    const onUp = () => {
      subtitleDragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove as EventListener);
      window.removeEventListener("touchend", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove as EventListener);
    window.addEventListener("touchend", onUp);
  }

  // ── Save / Approve ─────────────────────────────────────────────────────────
  async function saveDraft(reason = "manual_edit") {
    setSaving(true);
    try {
      let res: Response;
      if (editingLang) {
        res = await fetch(`/api/admin/subtitles/${subtitleId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ translationLang: editingLang, translationSegments: cues }),
        });
      } else {
        res = await fetch(`/api/admin/subtitles/${subtitleId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ segments: cues, reason }),
        });
      }
      if (!res.ok) throw new Error("Save failed");
      setIsModified(false);
      setMsg("✓ Saved"); setTimeout(() => setMsg(""), 2500);
    } catch (e) {
      setMsg(`✕ ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  function switchLang(lang: string | null) {
    if (isModified && !confirm("You have unsaved changes. Switch language without saving?")) return;
    setEditingLang(lang);
    setIsModified(false);
    setUndoStack([]);
    setRedoStack([]);
    setCues(lang === null ? initialSegments : ((translationsJson ?? {})[lang] ?? []));
  }

  async function handleApprove() {
    if (!confirm("Approve these source subtitles? This enables translation to all languages.")) return;
    setSaving(true);
    try {
      // Save segments first, then set status
      await fetch(`/api/admin/subtitles/${subtitleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segments: cues, reason: "pre_approve_save" }),
      });
      const res = await fetch(`/api/admin/subtitles/${subtitleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved_source" }),
      });
      if (!res.ok) throw new Error("Approve failed");
      setStatus("approved_source");
      setMsg("✓ Approved — translation is now available"); setTimeout(() => setMsg(""), 3000);
      onSaved("approved_source", cues);
    } catch (e) {
      setMsg(`✕ ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  // ── Import / Export SRT ────────────────────────────────────────────────────
  function exportSRT() {
    const srt = serializeSRT(cues);
    const blob = new Blob([srt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subtitles-${subtitleId.slice(-8)}.srt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const importRef = useRef<HTMLInputElement>(null);
  function importSRT(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseSRT(text);
      if (!parsed.length) { setMsg("✕ No subtitle cues found in file"); return; }
      snapshot(cues);
      setCues(parsed);
      setIsModified(true);
      setMsg(`✓ Imported ${parsed.length} cues`); setTimeout(() => setMsg(""), 2500);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  // ── Revision history ───────────────────────────────────────────────────────
  async function loadRevisions() {
    setLoadingRevisions(true);
    try {
      const res = await fetch(`/api/admin/subtitles/${subtitleId}/revisions`);
      if (res.ok) {
        const data = await res.json() as { revisions: RevisionItem[] };
        setRevisions(data.revisions);
      }
    } finally {
      setLoadingRevisions(false);
    }
  }

  async function restoreRevision(revId: string) {
    if (!confirm("Restore this revision? Current cues will be saved as a revision first.")) return;
    const res = await fetch(`/api/admin/subtitles/${subtitleId}/revisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revisionId: revId }),
    });
    if (!res.ok) { setMsg("✕ Restore failed"); return; }
    const data = await res.json() as { subtitle: { segmentsJson: SubtitleCue[] } };
    snapshot(cues);
    setCues(data.subtitle.segmentsJson ?? []);
    setMsg("✓ Revision restored"); setTimeout(() => setMsg(""), 2500);
    loadRevisions();
  }

  async function handleClearHistory() {
    setClearing(true);
    try {
      if (clearAction === "archive_and_clear") {
        const archive = JSON.stringify(revisions, null, 2);
        const blob = new Blob([archive], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `revisions-${subtitleId.slice(-8)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
      setShowClearModal(false);
      setRevisions([]);
      setMsg("✓ History cleared"); setTimeout(() => setMsg(""), 2500);
    } finally {
      setClearing(false);
    }
  }

  useEffect(() => {
    if (showRevisions && revisions.length === 0) loadRevisions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRevisions]);

  // ── Scroll to active cue ───────────────────────────────────────────────────
  useEffect(() => {
    if (activeCue >= 0 && cueRowRefs.current[activeCue]) {
      cueRowRefs.current[activeCue]!.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeCue]);

  // ── Placement setter helpers ───────────────────────────────────────────────
  function setActivePlacement(patch: Partial<MobilePlacementState>) {
    if (previewDevice === "desktop") {
      setPlacement((prev) => ({ ...prev, ...patch }));
    } else if (previewDevice === "portrait") {
      setMobilePlacement((prev) => ({ ...prev, ...patch }));
    } else {
      setLandscapePlacement((prev) => ({ ...prev, ...patch }));
    }
  }

  const activePl = activePlacement as PlacementState;
  const isDesktop = previewDevice === "desktop";

  // ── Timecode display ───────────────────────────────────────────────────────
  function fmtTimeDisplay(s: number): string {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 100);
    return `${m}:${String(sec).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const isApproved = status === "approved_source";

  return createPortal(
    <div className="se-overlay">
      <div className="se-shell">
        {/* ══ HEADER ═══════════════════════════════════════════════════════════ */}
        <div className="se-header">
          <div className="se-header-left">
            <span className="se-header-title">Subtitle Editor</span>
            <span className="se-header-lang">
              <Languages size={11} />
              {editingLang
                ? `${getLangName(editingLang)} (translation)`
                : `${getLangName(sourceLanguage)} (source)`}
            </span>
            {!editingLang && (
              <span className={`se-status-badge ${isApproved ? "se-status-badge--approved" : "se-status-badge--draft"}`}>
                {isApproved ? "✓ Approved" : "Draft"}
              </span>
            )}
            <span className="se-header-meta">{cues.length} cues</span>
            {warningCount > 0 && <span className="se-warn-count">⚠ {warningCount} warning{warningCount !== 1 ? "s" : ""}</span>}
            {hardErrors > 0 && <span className="se-err-count">✕ {hardErrors} error{hardErrors !== 1 ? "s" : ""}</span>}
          </div>

          <div className="se-header-right">
            {msg && <span className="se-msg">{msg}</span>}

            <button className="se-hbtn se-hbtn--ghost" onClick={undo} title="Undo (Ctrl+Z)" disabled={!undoStack.length}>
              <Undo2 size={13} /> Undo
            </button>
            <button className="se-hbtn se-hbtn--ghost" onClick={redo} title="Redo (Ctrl+Y)" disabled={!redoStack.length}>
              <Redo2 size={13} /> Redo
            </button>
            <button className="se-hbtn se-hbtn--ghost" onClick={() => setShowRevisions((v) => !v)} title="Revision history">
              <RotateCcw size={13} /> History
            </button>
            <button className="se-hbtn se-hbtn--ghost" onClick={() => importRef.current?.click()} title="Import SRT">
              <Upload size={13} /> Import
            </button>
            <button className="se-hbtn se-hbtn--ghost" onClick={exportSRT} title="Export SRT">
              <Download size={13} /> Export
            </button>
            <input ref={importRef} type="file" accept=".srt,.vtt" className="se-hidden" onChange={importSRT} />

            <button
              className="se-hbtn se-hbtn--save"
              onClick={() => saveDraft()}
              disabled={saving}
              title="Save draft (Ctrl+S)"
            >
              <Save size={13} /> {saving ? "Saving…" : "Save Draft"}
            </button>

            {!isApproved && !editingLang && (
              <button
                className="se-hbtn se-hbtn--approve"
                onClick={handleApprove}
                disabled={saving || cues.length === 0}
                title="Approve source subtitles (enables translation)"
              >
                <CheckCircle size={13} /> Approve
              </button>
            )}

            <button className="se-hbtn se-hbtn--close" onClick={onClose} title="Close (Esc)">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ══ LANGUAGE BAR ═════════════════════════════════════════════════════ */}
        {translationsJson && Object.keys(translationsJson).length > 0 && (
          <div className="se-lang-bar">
            <span className="se-lang-bar-label">Lang:</span>
            <button
              className={`se-lang-tab ${editingLang === null ? "se-lang-tab--active" : ""}`}
              onClick={() => switchLang(null)}
            >
              {getLangName(sourceLanguage)} (src)
            </button>
            {Object.entries(translationsJson).map(([lang, segs]) => (
              <button
                key={lang}
                className={`se-lang-tab ${editingLang === lang ? "se-lang-tab--active" : ""}`}
                onClick={() => switchLang(lang)}
              >
                {getLangName(lang)} ({(segs as SubtitleCue[]).length})
              </button>
            ))}
          </div>
        )}

        {/* ══ BODY ═════════════════════════════════════════════════════════════ */}
        <div className="se-body">
          {/* ── LEFT PANEL — Placement ────────────────────────────────────── */}
          <div className="se-left">
            {/* Device tabs */}
            <div className="se-device-tabs">
              {(["desktop", "portrait", "landscape"] as PreviewDevice[]).map((d) => (
                <button
                  key={d}
                  className={`se-device-tab ${previewDevice === d ? "se-device-tab--active" : ""}`}
                  onClick={() => { setPreviewDevice(d); setPreviewedDevices((s) => new Set([...s, d])); }}
                >
                  {d === "desktop" ? "🖥" : "📱"} {d === "desktop" ? "Desk." : d === "portrait" ? "Port." : "Land."}
                  {previewedDevices.has(d) && <span className="se-device-check">✓</span>}
                </button>
              ))}
            </div>

            {/* Placement controls */}
            <div className="se-placement">
              <div className="se-placement-label">Vertical Position</div>
              <div className="se-btn-row">
                {ANCHOR_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    className={`se-pbtn ${activePl.verticalAnchor === p.id ? "se-pbtn--active" : ""}`}
                    onClick={() => setActivePlacement({ verticalAnchor: p.id })}
                  >{p.label}</button>
                ))}
              </div>

              <div className="se-placement-label">Horizontal Align</div>
              <div className="se-btn-row">
                {(["left", "center", "right"] as const).map((a) => (
                  <button
                    key={a}
                    className={`se-pbtn ${activePl.horizontalAlign === a ? "se-pbtn--active" : ""}`}
                    onClick={() => setActivePlacement({ horizontalAlign: a })}
                  >{a[0].toUpperCase() + a.slice(1)}</button>
                ))}
              </div>

              <div className="se-placement-label">Offset Y: {activePl.offsetYPercent > 0 ? "+" : ""}{activePl.offsetYPercent}%</div>
              <input type="range" min="-40" max="40" step="1" value={activePl.offsetYPercent}
                onChange={(e) => setActivePlacement({ offsetYPercent: parseInt(e.target.value) })}
                className="se-range"
              />

              <div className="se-placement-label">Font Scale</div>
              <div className="se-btn-row">
                {[0.8, 0.9, 1.0, 1.1, 1.25].map((s) => (
                  <button
                    key={s}
                    className={`se-pbtn ${activePl.fontScale === s ? "se-pbtn--active" : ""}`}
                    onClick={() => setActivePlacement({ fontScale: s })}
                  >{s}×</button>
                ))}
              </div>

              <div className="se-placement-label">Safe Margin: {activePl.safeAreaMarginPx}px</div>
              <input type="range" min="0" max="60" step="1" value={activePl.safeAreaMarginPx}
                onChange={(e) => setActivePlacement({ safeAreaMarginPx: parseInt(e.target.value) })}
                className="se-range"
              />

              {isDesktop && (
                <>
                  <div className="se-placement-label">Background</div>
                  <div className="se-btn-row">
                    {(["none", "shadow", "box"] as const).map((b) => (
                      <button
                        key={b}
                        className={`se-pbtn ${placement.backgroundStyle === b ? "se-pbtn--active" : ""}`}
                        onClick={() => setPlacement((prev) => ({ ...prev, backgroundStyle: b }))}
                      >{b[0].toUpperCase() + b.slice(1)}</button>
                    ))}
                  </div>
                </>
              )}

              <div className="se-placement-label" style={{ marginTop: 8, fontSize: "0.5rem", color: "rgba(255,255,255,0.2)" }}>
                Placement is UI-only preview — not saved to database
              </div>
            </div>

            {/* Preview aids */}
            <div className="se-preview-aids">
              <label className="se-check-label">
                <input type="checkbox" checked={showSafeZones} onChange={(e) => setShowSafeZones(e.target.checked)} />
                Safe zones
              </label>
              <label className="se-check-label">
                <input type="checkbox" checked={showControlsBar} onChange={(e) => setShowControlsBar(e.target.checked)} />
                Controls bar
              </label>
              <label className="se-check-label" style={{ color: "rgba(0,255,136,0.5)" }}>
                <input type="checkbox" checked={showDebug} onChange={(e) => setShowDebug(e.target.checked)} />
                Debug
              </label>
            </div>

            {/* Keyboard shortcuts */}
            <div className="se-shortcuts">
              <kbd>Ctrl+S</kbd> Save &nbsp;<kbd>Ctrl+Z</kbd> Undo &nbsp;<kbd>Ctrl+Y</kbd> Redo<br />
              <kbd>Space</kbd> Play/Pause &nbsp;<kbd>I</kbd>/<kbd>O</kbd> In/Out &nbsp;<kbd>J</kbd>/<kbd>L</kbd> Frame
            </div>
          </div>

          {/* ── CENTER PANEL — Video Preview ──────────────────────────────── */}
          {videoUrl && (
            <div className="se-center">
              {/* Zoom toolbar */}
              <div className="se-zoom-bar">
                {(["fit", "fit-height", "fit-width", "100", "75", "50"] as ZoomMode[]).map((m) => (
                  <button
                    key={m}
                    className={`se-zbtn ${zoomMode === m ? "se-zbtn--active" : ""}`}
                    onClick={() => { setZoomMode(m); setPanOffset({ x: 0, y: 0 }); }}
                  >{m === "fit" ? "Fit" : m === "fit-height" ? "Fit H" : m === "fit-width" ? "Fit W" : m + "%"}</button>
                ))}
                <div className="se-zoom-sep" />
                <button className="se-zbtn" onClick={() => { setCustomZoom((c) => parseFloat(Math.max(0.1, c - 0.1).toFixed(2))); setZoomMode("custom"); }}>−</button>
                <span className="se-zoom-pct">{Math.round(effectiveScale * 100)}%</span>
                <button className="se-zbtn" onClick={() => { setCustomZoom((c) => parseFloat(Math.min(3, c + 0.1).toFixed(2))); setZoomMode("custom"); }}>+</button>
                <div style={{ flex: 1 }} />
                {canPan && <span className="se-pan-hint">✋ drag to pan</span>}
                <button className="se-zbtn se-zbtn--reset" onClick={resetView}>↺ Reset</button>
              </div>

              {/* Stage */}
              <div
                ref={stageRef}
                className="se-stage"
                style={{ cursor: canPan ? "grab" : "default" }}
                onMouseDown={(e) => {
                  if (!canPan) return;
                  if ((e.target as HTMLElement).closest("[data-subtitle-drag]")) return;
                  panDragRef.current = { startX: e.clientX, startY: e.clientY, startPanX: panOffset.x, startPanY: panOffset.y };
                  e.preventDefault();
                }}
              >
                <div style={{
                  position: "absolute", left: "50%", top: "50%",
                  transform: `translate(calc(-50% + ${panOffset.x}px), calc(-50% + ${panOffset.y}px))`,
                  pointerEvents: "none",
                }}>
                  <div ref={previewRef} className={`se-frame se-frame--${previewDevice}`} style={{
                    width: dim.w, height: dim.h,
                    transform: `scale(${effectiveScale})`,
                    transformOrigin: "center center",
                    pointerEvents: "all",
                  }}>
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      controls
                      controlsList="nodownload"
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                    {/* Video rect overlay */}
                    <div style={{
                      position: "absolute",
                      left: videoRect.x, top: videoRect.y,
                      width: videoRect.w, height: videoRect.h,
                      pointerEvents: "none",
                    }}>
                      {/* Safe zones */}
                      {showSafeZones && (
                        <div className="se-safe-zone" />
                      )}
                      {/* Controls bar mock */}
                      {showControlsBar && (
                        <div className="se-controls-mock" />
                      )}
                      {/* Subtitle overlay */}
                      {activeCueText && (() => {
                        const p = activePlacement;
                        const fontPx = computeFontPx(p.fontScale, videoRect.w);
                        const bgStyle = (p as PlacementState).backgroundStyle;
                        return (
                          <div
                            data-subtitle-drag="1"
                            onMouseDown={handlePreviewDragStart}
                            onTouchStart={handlePreviewDragStart}
                            style={{
                              position: "absolute",
                              left: p.horizontalAlign === "left" ? "5%" : p.horizontalAlign === "right" ? "auto" : "50%",
                              right: p.horizontalAlign === "right" ? "5%" : "auto",
                              transform: p.horizontalAlign === "center" ? "translateX(-50%)" : "none",
                              bottom: getSubtitleBottom(p, videoRect.h),
                              cursor: "ns-resize",
                              maxWidth: "90%",
                              padding: "3px 10px",
                              borderRadius: 5,
                              fontSize: fontPx,
                              fontWeight: 600,
                              lineHeight: 1.5,
                              color: "#fff",
                              textAlign: p.horizontalAlign as "left" | "center" | "right",
                              background: bgStyle === "box" ? "rgba(0,0,0,0.82)" : "transparent",
                              textShadow: bgStyle === "shadow" ? "0 0 4px #000, 0 1px 4px rgba(0,0,0,0.8)" : "none",
                              pointerEvents: "all",
                              userSelect: "none",
                              zIndex: 6,
                              whiteSpace: "pre-line",
                            }}
                          >{activeCueText}</div>
                        );
                      })()}
                    </div>
                    {/* Device badge */}
                    <div className="se-device-badge">
                      {previewDevice} · {dim.w}×{dim.h}
                    </div>
                    {/* Debug */}
                    {showDebug && (
                      <div className="se-debug-overlay">
                        {`anchor: ${activePl.verticalAnchor} | align: ${activePl.horizontalAlign}\noffsetY: ${activePl.offsetYPercent}% | margin: ${activePl.safeAreaMarginPx}px\nfont: ${activePl.fontScale}× | zoom: ${Math.round(effectiveScale * 100)}%`}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Transport controls */}
              <div className="se-transport">
                <button className="se-tbtn" onClick={() => { const v = videoRef.current; if (v) v.currentTime = Math.max(0, v.currentTime - 5); }} title="Skip back 5s">⏪</button>
                <button className="se-tbtn" onClick={() => { const v = videoRef.current; if (v) { v.pause(); v.currentTime = Math.max(0, v.currentTime - 0.04); } }} title="Frame back">◀</button>
                <button className="se-tbtn se-tbtn--play" onClick={() => { const v = videoRef.current; if (!v) return; if (v.paused) v.play().catch(() => {}); else v.pause(); }} title="Play/Pause (Space)">▶⏸</button>
                <button className="se-tbtn" onClick={() => { const v = videoRef.current; if (v) { v.pause(); v.currentTime += 0.04; } }} title="Frame forward">▶</button>
                <button className="se-tbtn" onClick={() => { const v = videoRef.current; if (v) v.currentTime = Math.min(v.duration || 999, v.currentTime + 5); }} title="Skip forward 5s">⏩</button>
                <span className="se-timecode">{fmtTimeDisplay(videoTime)} / {fmtTimeDisplay(videoDuration)}</span>
                <div style={{ flex: 1 }} />
                {activeCue >= 0 && (
                  <>
                    <button className="se-tbtn se-tbtn--in" disabled={activeCue < 0}
                      onClick={() => { const v = videoRef.current; if (v && activeCue >= 0) updateCue(activeCue, { start: parseFloat(v.currentTime.toFixed(3)) }); }}
                      title="Snap IN point (I)">⬅ IN</button>
                    <button className="se-tbtn se-tbtn--out" disabled={activeCue < 0}
                      onClick={() => { const v = videoRef.current; if (v && activeCue >= 0) updateCue(activeCue, { end: parseFloat(v.currentTime.toFixed(3)) }); }}
                      title="Snap OUT point (O)">OUT ➡</button>
                  </>
                )}
                <select className="se-speed-sel" onChange={(e) => { const v = videoRef.current; if (v) v.playbackRate = parseFloat(e.target.value); }} defaultValue="1">
                  <option value="0.25">0.25×</option>
                  <option value="0.5">0.5×</option>
                  <option value="0.75">0.75×</option>
                  <option value="1">1×</option>
                  <option value="1.5">1.5×</option>
                  <option value="2">2×</option>
                </select>
              </div>
            </div>
          )}

          {/* ── RIGHT PANEL — Active Cue + Device Summary + Revisions ────── */}
          <div className="se-right">
            <div className="se-right-section">
              <div className="se-right-label">Active Cue</div>
              {activeCue >= 0 && cues[activeCue] ? (
                <>
                  <div className="se-active-cue-id">#{activeCue + 1} · {fmtMs(cues[activeCue].start)} → {fmtMs(cues[activeCue].end)}</div>
                  <div className="se-active-cue-text">{cues[activeCue].text || <em>Empty cue</em>}</div>
                  {(cueWarnings[activeCue]?.length ?? 0) > 0 && (
                    <div className="se-cue-warns">
                      {(cueWarnings[activeCue] ?? []).map((w) => (
                        <span key={w} className={`se-warn-chip ${w === "invalid" || w === "empty" ? "se-warn-chip--err" : ""}`}>{WARN_LABELS[w]}</span>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="se-active-cue-empty">Click a cue to preview</div>
              )}
            </div>

            <div className="se-right-section">
              <div className="se-right-label">Device Summary</div>
              {[
                { label: "🖥 Desktop", p: placement },
                { label: "📱 Portrait", p: mobilePlacement },
                { label: "📱 Landscape", p: landscapePlacement },
              ].map((row) => (
                <div key={row.label} className="se-device-summary-row">
                  <span className="se-device-summary-name">{row.label}</span>
                  <span className="se-device-summary-meta">{row.p.verticalAnchor} · {row.p.horizontalAlign} · {row.p.fontScale}×</span>
                </div>
              ))}
            </div>

            {showRevisions && (
              <div className="se-right-section">
                <div className="se-right-label">🕓 Revisions
                  <button className="se-rev-clear-btn" onClick={() => setShowClearModal(true)}>Manage</button>
                </div>
                {loadingRevisions && <div className="se-active-cue-empty">Loading…</div>}
                {!loadingRevisions && revisions.length === 0 && <div className="se-active-cue-empty">No revisions yet.</div>}
                {revisions.map((rev) => (
                  <div key={rev.id} className="se-rev-row">
                    <div className="se-rev-meta">
                      <span>{new Date(rev.savedAt).toLocaleString()}</span>
                      <span className="se-rev-reason">{rev.reason?.replace(/_/g, " ")} · {rev.segmentCount} cues</span>
                    </div>
                    <button className="se-rev-restore" onClick={() => restoreRevision(rev.id)}>↩</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ flex: 1 }} />
          </div>
        </div>

        {/* ══ BOTTOM PANEL — Cue Timeline ══════════════════════════════════════ */}
        <div className="se-timeline">
          <div className="se-timeline-header">
            <span className="se-timeline-title">Cue Timeline</span>
            <span className="se-timeline-count">{cues.length} cues</span>
            {warningCount > 0 && <span className="se-warn-count">⚠ {warningCount}</span>}
            {hardErrors > 0 && <span className="se-err-count">✕ {hardErrors}</span>}
            {videoUrl && (
              <>
                <div style={{ flex: 1 }} />
                <button className="se-snap-btn se-snap-btn--in"
                  disabled={activeCue < 0}
                  onClick={() => { const v = videoRef.current; if (v && activeCue >= 0) updateCue(activeCue, { start: parseFloat(v.currentTime.toFixed(3)) }); }}
                  title="Snap IN (I)">⬅ IN</button>
                <button className="se-snap-btn se-snap-btn--out"
                  disabled={activeCue < 0}
                  onClick={() => { const v = videoRef.current; if (v && activeCue >= 0) updateCue(activeCue, { end: parseFloat(v.currentTime.toFixed(3)) }); }}
                  title="Snap OUT (O)">OUT ➡</button>
              </>
            )}
            <button className="se-add-cue-btn" onClick={() => insertAfter(cues.length - 1)}>+ Add Cue</button>
          </div>

          <div className="se-cue-list">
            {cues.length === 0 && (
              <div className="se-empty-cues">
                No subtitle cues. Import an SRT file or add cues manually.
                <button className="se-add-first-btn" onClick={() => insertAfter(-1)}>+ Add first cue</button>
              </div>
            )}

            {cues.map((cue, idx) => {
              const warns = cueWarnings[idx] ?? [];
              const isActive = idx === activeCue;
              const hasOverride = !!placement.cueOverrides[String(idx)];
              const override = placement.cueOverrides[String(idx)] as Partial<PlacementState> | undefined;

              return (
                <div
                  key={idx}
                  ref={(el) => { cueRowRefs.current[idx] = el; }}
                  className={`se-cue-row ${isActive ? "se-cue-row--active" : ""} ${warns.length ? "se-cue-row--warn" : ""}`}
                  onClick={() => setActiveCue(idx)}
                >
                  <div className="se-cue-inner">
                    {/* Index / seek */}
                    <button
                      className="se-cue-idx"
                      onClick={(e) => { e.stopPropagation(); const v = videoRef.current; if (v) { v.currentTime = cue.start; v.play().catch(() => {}); } }}
                      title="Jump to this cue"
                    >{idx + 1}</button>

                    {/* Timecodes */}
                    <div className="se-cue-tc">
                      <div className="se-cue-tc-row">
                        <span className="se-cue-tc-label">IN</span>
                        <TimeInput value={cue.start} onChange={(v) => updateCue(idx, { start: v })} />
                      </div>
                      <div className="se-cue-tc-row">
                        <span className="se-cue-tc-label">OUT</span>
                        <TimeInput value={cue.end} onChange={(v) => updateCue(idx, { end: v })} />
                      </div>
                    </div>

                    {/* Text */}
                    <textarea
                      className="se-cue-text"
                      value={cue.text}
                      rows={2}
                      onChange={(e) => updateCue(idx, { text: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                    />

                    {/* Actions */}
                    <div className="se-cue-actions">
                      <button className="se-cue-btn" onClick={(e) => { e.stopPropagation(); splitCue(idx); }} title="Split">⎯</button>
                      <button className="se-cue-btn" onClick={(e) => { e.stopPropagation(); mergeCue(idx); }} title="Merge with next" disabled={idx >= cues.length - 1}>⊔</button>
                      <button className="se-cue-btn se-cue-btn--del" onClick={(e) => { e.stopPropagation(); deleteCue(idx); }} title="Delete">✕</button>
                      <button
                        className={`se-cue-btn ${hasOverride ? "se-cue-btn--override" : ""}`}
                        onClick={(e) => { e.stopPropagation(); setCueOverride(idx, hasOverride ? null : { verticalAnchor: placement.verticalAnchor }); }}
                        title={hasOverride ? "Remove override" : "Add placement override"}
                      >📐</button>
                    </div>
                  </div>

                  {/* Per-cue override */}
                  {hasOverride && (
                    <div className="se-cue-override">
                      <span className="se-override-label">Override:</span>
                      {ANCHOR_PRESETS.map((p) => (
                        <button key={p.id}
                          className={`se-pbtn se-pbtn--sm ${override?.verticalAnchor === p.id ? "se-pbtn--active" : ""}`}
                          onClick={(e) => { e.stopPropagation(); setCueOverride(idx, { verticalAnchor: p.id }); }}
                        >{p.label}</button>
                      ))}
                      {(["left", "center", "right"] as const).map((a) => (
                        <button key={a}
                          className={`se-pbtn se-pbtn--sm ${override?.horizontalAlign === a ? "se-pbtn--active" : ""}`}
                          onClick={(e) => { e.stopPropagation(); setCueOverride(idx, { horizontalAlign: a }); }}
                        >{a[0].toUpperCase() + a.slice(1)}</button>
                      ))}
                      <button className="se-pbtn se-pbtn--sm se-pbtn--danger"
                        onClick={(e) => { e.stopPropagation(); setCueOverride(idx, null); }}
                      >Reset</button>
                    </div>
                  )}

                  {/* Warnings */}
                  {warns.length > 0 && (
                    <div className="se-cue-warn-row">
                      {warns.map((w) => (
                        <span key={w} className={`se-warn-chip ${w === "invalid" || w === "empty" ? "se-warn-chip--err" : ""}`}>{WARN_LABELS[w]}</span>
                      ))}
                    </div>
                  )}

                  {/* Insert below */}
                  <button className="se-insert-below" onClick={(e) => { e.stopPropagation(); insertAfter(idx); }} title="Insert cue below">
                    + insert below
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Manage History Modal ─────────────────────────────────────────────── */}
      {showClearModal && (
        <div className="se-modal-overlay">
          <div className="se-modal">
            <div className="se-modal-title">🗑 Manage Revision History</div>
            <div className="se-modal-desc">
              Choose an action. <strong>This cannot be undone.</strong> Active subtitle content is preserved unless you reset.
            </div>
            <div className="se-modal-options">
              {([
                { id: "clear_only",       label: "Clear revision history only",       desc: "Delete all revision snapshots. Active subtitles unchanged." },
                { id: "archive_and_clear", label: "Archive and clear",                desc: "Download a JSON archive of all revisions, then delete them." },
                { id: "reset_and_clear",  label: "Reset to last approved + clear",    desc: "Restore last approved snapshot as current, then clear history." },
                { id: "delete_drafts",    label: "Delete draft revisions only",        desc: "Only removes manual_edit revisions. Approved snapshots kept." },
              ] as { id: ClearAction; label: string; desc: string }[]).map((opt) => (
                <label key={opt.id} className={`se-modal-opt ${clearAction === opt.id ? "se-modal-opt--active" : ""}`}>
                  <input type="radio" name="clearAction" value={opt.id} checked={clearAction === opt.id} onChange={() => setClearAction(opt.id)} />
                  <div>
                    <div className="se-modal-opt-label">{opt.label}</div>
                    <div className="se-modal-opt-desc">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
            <input type="text" className="se-modal-reason-input" placeholder="Reason (optional)" value={clearReason} onChange={(e) => setClearReason(e.target.value)} />
            <div className="se-modal-actions">
              <button className="se-hbtn se-hbtn--ghost" onClick={() => { setShowClearModal(false); setClearReason(""); }}>Cancel</button>
              <button className="se-hbtn se-hbtn--danger" onClick={handleClearHistory} disabled={clearing}>
                {clearing ? "Clearing…" : "🗑 Confirm Clear"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
