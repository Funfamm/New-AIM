"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { ChevronLeft, ChevronDown } from "lucide-react";
import R2FileUpload from "@/components/r2-file-upload";
import ProcessingPanel from "@/components/admin/processing-panel";
import type { PanelJob } from "@/components/admin/processing-panel";
import "./work-form.css";

type WorkType =
  | "SHORT_FILM" | "FULL_FILM" | "SERIES" | "EPISODE" | "TRAILER"
  | "COMMERCIAL" | "BRANDING" | "CAMPAIGN" | "CASE_STUDY";

type WorkStatus = "DRAFT" | "IN_PRODUCTION" | "UPCOMING" | "PUBLISHED" | "PRIVATE";

const TYPE_LABELS: Record<WorkType, string> = {
  SHORT_FILM: "Short Film",
  FULL_FILM:  "Full Film",
  SERIES:     "Series",
  EPISODE:    "Episode",
  TRAILER:    "Trailer",
  COMMERCIAL: "Commercial",
  BRANDING:   "Branding",
  CAMPAIGN:   "Campaign",
  CASE_STUDY: "Case Study",
};

type WorkData = {
  slug: string;
  type: WorkType; status: WorkStatus; title: string;
  description: string | null;
  posterUrl: string | null; heroMobileUrl: string | null;
  heroDesktopUrl: string | null; thumbnailUrl: string | null;
  videoUrl: string | null; trailerUrl: string | null; previewClipUrl: string | null; teaserUrl: string | null;
  masterVideoKey: string | null; masterTrailerKey: string | null; masterPreviewKey: string | null;
  year: number | null; duration: number | null; director: string | null; genres: string[];
  clientName: string | null; industry: string | null; projectGoal: string | null;
  deliverables: string | null; caseStudy: string | null; galleryUrls: string[];
  requiresAuth: boolean; requiresLoginToViewTrailer: boolean;
  featured: boolean; showOnHome: boolean;
  featuredOnHome: boolean; featuredOnWorks: boolean;
  commentsEnabled: boolean; order: number;
  parentId: string | null; episodeNumber: number | null; seasonNumber: number | null;
  introStart: number | null; introEnd: number | null; creditsStart: number | null;
  heroPreviewDuration: number | null;
  contentRating: string | null; contentDescriptors: string[];
};

type VideoJobStatus = "PENDING" | "PROCESSING" | "READY" | "FAILED" | "CANCELLED";

type LatestJob = {
  id: string;
  status: VideoJobStatus;
  progress: number;
  hlsUrl: string | null;
  errorMessage: string | null;
};

type Props = {
  work: WorkData | null;
  workId: string | null;
  workTitle?: string;
  action: (formData: FormData) => Promise<void>;
  seriesList: { id: string; title: string }[];
  error?: string;
  defaultType?: WorkType;
  defaultParentId?: string;
  rows: Array<{ id: string; title: string; placement: string }>;
  assignedRowIds: string[];
  latestJobVideo?:   LatestJob | null;
  latestJobTrailer?: LatestJob | null;
  latestJobPreview?: LatestJob | null;
};

const CLIENT_TYPES: WorkType[] = ["COMMERCIAL", "BRANDING", "CAMPAIGN", "CASE_STUDY"];

const GENRES = [
  "Drama", "Action", "Horror", "Thriller", "Documentary",
  "Comedy", "Romance", "Family", "Faith", "Mystery",
  "Survival", "Commercial", "Branding", "Campaign",
];

// ── Sub-components ───────────────────────────────────────────────────────────

function SaveButton({ isNew }: { isNew: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="form-submit" disabled={pending}>
      {pending ? "Saving…" : isNew ? "Add Work" : "Save Changes"}
    </button>
  );
}

function WfSection({
  title,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`wf-section ${open ? "wf-section--open" : ""}`}>
      <button
        type="button"
        className="wf-section-hdr"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="wf-section-ttl">
          <span className="wf-section-ico">{icon}</span>
          {title}
        </span>
        <ChevronDown
          size={13}
          className={`wf-section-chevron ${open ? "wf-section-chevron--open" : ""}`}
        />
      </button>
      {/* Keep body in DOM (display:none) so form fields are always submitted */}
      <div className="wf-section-body" style={open ? undefined : { display: "none" }}>
        {children}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WorkForm({
  work, workId, workTitle, action, seriesList, error, defaultType, defaultParentId,
  rows, assignedRowIds, latestJobVideo, latestJobTrailer, latestJobPreview,
}: Props) {
  const [type, setType]             = useState<WorkType>(work?.type ?? defaultType ?? "SHORT_FILM");
  const [title, setTitle]           = useState(work?.title ?? "");
  const [heroMobileUrl,  setHeroMobileUrl]  = useState(work?.heroMobileUrl  ?? "");
  const [heroDesktopUrl, setHeroDesktopUrl] = useState(work?.heroDesktopUrl ?? "");
  const [posterUrl,      setPosterUrl]      = useState(work?.posterUrl      ?? "");
  const [thumbnailUrl,   setThumbnailUrl]   = useState(work?.thumbnailUrl   ?? "");
  const [trailerUrl,     setTrailerUrl]     = useState(work?.trailerUrl     ?? "");
  const [previewClipUrl, setPreviewClipUrl] = useState(work?.previewClipUrl ?? "");
  const [videoUrl,       setVideoUrl]       = useState(work?.videoUrl       ?? "");
  const [teaserUrl,      setTeaserUrl]      = useState(work?.teaserUrl      ?? "");
  const [masterVideoKey,   setMasterVideoKey]   = useState(work?.masterVideoKey   ?? "");
  const [masterTrailerKey, setMasterTrailerKey] = useState(work?.masterTrailerKey ?? "");
  const [masterPreviewKey, setMasterPreviewKey] = useState(work?.masterPreviewKey ?? "");

  const showFilmMeta       = ["SHORT_FILM", "FULL_FILM", "SERIES", "TRAILER"].includes(type);
  const showDuration       = !["SERIES", ...CLIENT_TYPES].includes(type);
  const showDirector       = ["SHORT_FILM", "FULL_FILM", "SERIES"].includes(type);
  const showTrailerUrl     = ["SHORT_FILM", "FULL_FILM", "SERIES"].includes(type);
  const showVideoUrl       = type !== "SERIES";
  const showTeaserUrl      = type === "COMMERCIAL";
  const isEpisode          = type === "EPISODE";
  const isClientType       = CLIENT_TYPES.includes(type);
  const showDeliverables   = ["BRANDING", "CAMPAIGN", "CASE_STUDY"].includes(type);
  const showCaseStudy      = ["BRANDING", "CAMPAIGN", "CASE_STUDY"].includes(type);
  const showGallery        = ["BRANDING", "CAMPAIGN", "CASE_STUDY"].includes(type);
  const showPlayerTimings  = ["SERIES", "FULL_FILM", "SHORT_FILM"].includes(type);
  const showContentAdvisory = !isEpisode;

  const videoLabel =
    type === "TRAILER"    ? "Trailer Video URL" :
    type === "EPISODE"    ? "Episode Video URL" :
    type === "COMMERCIAL" ? "Commercial Video URL" :
    "Main Video URL";

  // Section default-open: open if work already has content in that section
  const hasImages = !!(work?.heroMobileUrl || work?.heroDesktopUrl || work?.posterUrl || work?.thumbnailUrl);
  const hasVideo  = !!(work?.videoUrl || work?.trailerUrl || work?.previewClipUrl || work?.masterVideoKey || work?.masterTrailerKey || work?.masterPreviewKey);
  const hasCaseStudyContent = !!(work?.caseStudy || work?.deliverables || (work?.galleryUrls?.length ?? 0) > 0);

  return (
    <div className="admin-form-page">
      <Link href="/admin/works" className="admin-back">
        <ChevronLeft size={15} /> All Works
      </Link>
      <h1 className="admin-page-title">
        {work ? `Edit: ${workTitle}` : "Add Work"}
      </h1>

      {error && <div className="form-error">{error}</div>}

      <form action={action} className="work-form">

        {/* ── Sticky save bar ──────────────────────────────────────── */}
        <div className="wf-save-bar">
          <span className="wf-save-label">
            {work ? (workTitle ?? "Edit Work") : "New Work"}
          </span>
          <div className="wf-save-actions">
            <Link href="/admin/works" className="wf-cancel-link">Cancel</Link>
            <SaveButton isNew={!work} />
          </div>
        </div>

        {/* ── Section 1: Basics ────────────────────────────────────── */}
        <WfSection title="Basics" icon="📋" defaultOpen={true}>
          <div className="wf-sec-inner">

            {/* Type + Status */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Work Type *</label>
                <select
                  name="type"
                  className="form-input"
                  value={type}
                  onChange={(e) => setType(e.target.value as WorkType)}
                  required
                >
                  {(Object.entries(TYPE_LABELS) as [WorkType, string][]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select name="status" className="form-input" defaultValue={work?.status ?? "DRAFT"}>
                  <option value="DRAFT">Draft</option>
                  <option value="IN_PRODUCTION">In Production</option>
                  <option value="UPCOMING">Upcoming / Coming Soon</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="PRIVATE">Private</option>
                </select>
              </div>
            </div>

            {/* Episode parent + numbering */}
            {isEpisode && (
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Parent Series *</label>
                  <select name="parentId" className="form-input" defaultValue={work?.parentId ?? defaultParentId ?? ""} required>
                    <option value="">Select a series…</option>
                    {seriesList.map((s) => (
                      <option key={s.id} value={s.id}>{s.title}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Season</label>
                  <input type="number" name="seasonNumber" className="form-input"
                    defaultValue={work?.seasonNumber ?? 1} min={1} />
                </div>
                <div className="form-group">
                  <label className="form-label">Episode Number *</label>
                  <input type="number" name="episodeNumber" className="form-input"
                    defaultValue={work?.episodeNumber ?? ""} min={1} required />
                </div>
              </div>
            )}

            {/* Title */}
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input type="text" name="title" className="form-input"
                value={title} onChange={(e) => setTitle(e.target.value)}
                required placeholder="Work title" />
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea name="description" className="form-textarea" rows={3}
                defaultValue={work?.description ?? ""} placeholder="Short description…" />
            </div>

            {/* Genres */}
            {!isEpisode && (
              <div className="form-group">
                <label className="form-label">Genres</label>
                <div className="form-check-grid">
                  {GENRES.map((g) => (
                    <label key={g} className="form-check">
                      <input type="checkbox" name="genres" value={g}
                        defaultChecked={work?.genres?.includes(g) ?? false} />
                      <span>{g}</span>
                    </label>
                  ))}
                </div>
                <span className="form-hint">Select all that apply.</span>
              </div>
            )}

            {/* Film metadata */}
            {showFilmMeta && (
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Year</label>
                  <input type="number" name="year" className="form-input"
                    defaultValue={work?.year ?? ""} placeholder="2025" min={1900} max={2099} />
                </div>
                {showDuration && (
                  <div className="form-group">
                    <label className="form-label">Duration (min)</label>
                    <input type="number" name="duration" className="form-input"
                      defaultValue={work?.duration ?? ""} placeholder="90" min={1} />
                  </div>
                )}
                {showDirector && (
                  <div className="form-group">
                    <label className="form-label">Director</label>
                    <input type="text" name="director" className="form-input"
                      defaultValue={work?.director ?? ""} placeholder="Director name" />
                  </div>
                )}
              </div>
            )}

            {/* Episode duration */}
            {isEpisode && (
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Duration (min)</label>
                  <input type="number" name="duration" className="form-input"
                    defaultValue={work?.duration ?? ""} placeholder="45" min={1} />
                </div>
              </div>
            )}

            {/* Client fields */}
            {isClientType && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Client / Brand Name</label>
                    <input type="text" name="clientName" className="form-input"
                      defaultValue={work?.clientName ?? ""} placeholder="Brand name" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Industry</label>
                    <input type="text" name="industry" className="form-input"
                      defaultValue={work?.industry ?? ""} placeholder="Fashion, Tech, FMCG…" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Project Goal</label>
                  <input type="text" name="projectGoal" className="form-input"
                    defaultValue={work?.projectGoal ?? ""} placeholder="Campaign objective or brief…" />
                </div>
              </>
            )}

          </div>
        </WfSection>

        {/* ── Section 2: Artwork ───────────────────────────────────── */}
        <WfSection title="Artwork" icon="🖼" defaultOpen={hasImages}>
          <div className="wf-sec-inner">

            {!isEpisode && (
              <>
                <div className="form-group">
                  <label className="form-label">Mobile Image URL</label>
                  <input type="url" name="heroMobileUrl" className="form-input"
                    value={heroMobileUrl} onChange={(e) => setHeroMobileUrl(e.target.value)}
                    placeholder="https://…" />
                  <div style={{ marginTop: "0.5rem" }}>
                    <R2FileUpload targetField="heroMobileUrl" projectTitle={title || "untitled"}
                      projectSlug={work?.slug} onSuccess={setHeroMobileUrl} accept="image/*" />
                  </div>
                  <span className="form-hint">Recommended 9:16 portrait. Used for mobile hero sections, cards, and posters.</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Desktop Image URL</label>
                  <input type="url" name="heroDesktopUrl" className="form-input"
                    value={heroDesktopUrl} onChange={(e) => setHeroDesktopUrl(e.target.value)}
                    placeholder="https://…" />
                  <div style={{ marginTop: "0.5rem" }}>
                    <R2FileUpload targetField="heroDesktopUrl" projectTitle={title || "untitled"}
                      projectSlug={work?.slug} onSuccess={setHeroDesktopUrl} accept="image/*" />
                  </div>
                  <span className="form-hint">Recommended 16:9 or wider cinematic. Used for desktop hero sections and wide previews.</span>
                </div>
              </>
            )}

            {isEpisode && (
              <div className="form-group">
                <label className="form-label">Episode Image URL</label>
                <input type="url" name="heroMobileUrl" className="form-input"
                  value={heroMobileUrl} onChange={(e) => setHeroMobileUrl(e.target.value)}
                  placeholder="https://…" />
                <div style={{ marginTop: "0.5rem" }}>
                  <R2FileUpload targetField="heroMobileUrl" projectTitle={title || "untitled"}
                    projectSlug={work?.slug} onSuccess={setHeroMobileUrl} accept="image/*" />
                </div>
                <span className="form-hint">Thumbnail or still for this episode. Falls back to series images if empty.</span>
              </div>
            )}

            {/* Advanced overrides */}
            <details style={{ marginTop: "0.25rem" }}>
              <summary style={{
                fontFamily: "var(--font-body)", fontSize: "0.75rem", fontWeight: 600,
                color: "var(--color-brand-muted)", cursor: "pointer", letterSpacing: "0.04em",
                listStyle: "none", userSelect: "none",
              }}>
                Advanced image overrides ▸
              </summary>
              <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div className="form-group">
                  <label className="form-label">Card / Poster override</label>
                  <input type="url" name="posterUrl" className="form-input"
                    value={posterUrl} onChange={(e) => setPosterUrl(e.target.value)}
                    placeholder="https://…" />
                  <div style={{ marginTop: "0.5rem" }}>
                    <R2FileUpload targetField="posterUrl" projectTitle={title || "untitled"}
                      projectSlug={work?.slug} onSuccess={setPosterUrl} accept="image/*" />
                  </div>
                  <span className="form-hint">Overrides the portrait card/poster. Defaults to Mobile Image if empty.</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Thumbnail override</label>
                  <input type="url" name="thumbnailUrl" className="form-input"
                    value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)}
                    placeholder="https://…" />
                  <div style={{ marginTop: "0.5rem" }}>
                    <R2FileUpload targetField="thumbnailUrl" projectTitle={title || "untitled"}
                      projectSlug={work?.slug} onSuccess={setThumbnailUrl} accept="image/*" />
                  </div>
                  <span className="form-hint">Overrides episode row thumbnail. Defaults to Desktop Image if empty.</span>
                </div>
              </div>
            </details>

          </div>
        </WfSection>

        {/* ── Section 3: Video Assets ──────────────────────────────── */}
        <WfSection title="Video Assets" icon="🎬" defaultOpen={hasVideo}>
          <div className="wf-sec-inner">

            {/* Trailer */}
            {showTrailerUrl && (
              <>
                <div className="form-group">
                  <label className="form-label">Trailer URL</label>
                  <input type="url" name="trailerUrl" className="form-input"
                    value={trailerUrl} onChange={(e) => setTrailerUrl(e.target.value)}
                    placeholder="YouTube, Vimeo, .mp4, or .m3u8 (HLS) URL" />
                  <div style={{ marginTop: "0.5rem" }}>
                    <R2FileUpload targetField="trailerUrl" projectTitle={title || "untitled"}
                      projectSlug={work?.slug} onSuccess={setTrailerUrl} accept="video/*" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Master Trailer Source</label>
                  <input type="hidden" name="masterTrailerKey" value={masterTrailerKey} />
                  {masterTrailerKey && (
                    <div style={{ marginBottom: "0.5rem", fontSize: "0.75rem", color: "var(--color-brand-muted)", fontFamily: "var(--font-body)", wordBreak: "break-all" }}>
                      Stored: <code style={{ color: "var(--color-brand-light)" }}>{masterTrailerKey}</code>
                    </div>
                  )}
                  <R2FileUpload targetField="masterTrailerKey" projectTitle={title || "untitled"}
                    projectSlug={work?.slug} onSuccess={setMasterTrailerKey}
                    accept="video/mp4,video/quicktime,video/webm" returnKey />
                  <ProcessingPanel
                    workId={workId} targetField="trailerUrl" buttonLabel="Process Trailer"
                    readyMessage="Streaming version is ready. Trailer URL has been filled automatically."
                    masterKey={masterTrailerKey} initialJob={latestJobTrailer ?? null}
                    onUrlReady={setTrailerUrl}
                  />
                  <span className="form-hint">Private source for HLS trailer processing. Not shown publicly.</span>
                </div>
              </>
            )}

            {/* Preview Clip */}
            {showTrailerUrl && (
              <>
                <div className="form-group">
                  <label className="form-label">Preview Clip URL (optional)</label>
                  <input type="url" name="previewClipUrl" className="form-input"
                    value={previewClipUrl} onChange={(e) => setPreviewClipUrl(e.target.value)}
                    placeholder="YouTube, Vimeo, .mp4, or .m3u8 (HLS) URL" />
                  <div style={{ marginTop: "0.5rem" }}>
                    <R2FileUpload targetField="previewClipUrl" projectTitle={title || "untitled"}
                      projectSlug={work?.slug} onSuccess={setPreviewClipUrl} accept="video/*" />
                  </div>
                  <span className="form-hint">Short preview/sample shown only if trailer is unavailable.</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Master Preview Source</label>
                  <input type="hidden" name="masterPreviewKey" value={masterPreviewKey} />
                  {masterPreviewKey && (
                    <div style={{ marginBottom: "0.5rem", fontSize: "0.75rem", color: "var(--color-brand-muted)", fontFamily: "var(--font-body)", wordBreak: "break-all" }}>
                      Stored: <code style={{ color: "var(--color-brand-light)" }}>{masterPreviewKey}</code>
                    </div>
                  )}
                  <R2FileUpload targetField="masterPreviewKey" projectTitle={title || "untitled"}
                    projectSlug={work?.slug} onSuccess={setMasterPreviewKey}
                    accept="video/mp4,video/quicktime,video/webm" returnKey />
                  <ProcessingPanel
                    workId={workId} targetField="previewClipUrl" buttonLabel="Process Preview"
                    readyMessage="Streaming version is ready. Preview Clip URL has been filled automatically."
                    masterKey={masterPreviewKey} initialJob={latestJobPreview ?? null}
                    onUrlReady={setPreviewClipUrl}
                  />
                  <span className="form-hint">Private source for HLS preview processing. Not shown publicly.</span>
                </div>

                {/* Hero Preview Duration */}
                <div className="form-group">
                  <label className="form-label">Hero Preview Duration (seconds)</label>
                  <input
                    type="number"
                    name="heroPreviewDuration"
                    className="form-input"
                    defaultValue={work?.heroPreviewDuration ?? 12}
                    min={5}
                    max={30}
                    step={1}
                    placeholder="12"
                  />
                  <span className="form-hint">Controls how long the desktop hero preview video plays before returning to the poster. Mobile stays static.</span>
                </div>
              </>
            )}

            {/* Main Video */}
            {showVideoUrl && (
              <>
                <div className="form-group">
                  <label className="form-label">{videoLabel}</label>
                  <input type="url" name="videoUrl" className="form-input"
                    value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="YouTube, Vimeo, .mp4, or .m3u8 (HLS) URL" />
                  <div style={{ marginTop: "0.5rem" }}>
                    <R2FileUpload targetField="videoUrl" projectTitle={title || "untitled"}
                      projectSlug={work?.slug} onSuccess={setVideoUrl} accept="video/*" />
                  </div>
                  <span className="form-hint">Public playback URL. Use an HLS master.m3u8 URL here for adaptive streaming.</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Master Video Source</label>
                  <input type="hidden" name="masterVideoKey" value={masterVideoKey} />
                  {masterVideoKey && (
                    <div style={{ marginBottom: "0.5rem", fontSize: "0.75rem", color: "var(--color-brand-muted)", fontFamily: "var(--font-body)", wordBreak: "break-all" }}>
                      Stored: <code style={{ color: "var(--color-brand-light)" }}>{masterVideoKey}</code>
                    </div>
                  )}
                  <R2FileUpload targetField="masterVideoKey" projectTitle={title || "untitled"}
                    projectSlug={work?.slug} onSuccess={setMasterVideoKey}
                    accept="video/mp4,video/quicktime,video/webm" returnKey />
                  <ProcessingPanel
                    workId={workId} targetField="videoUrl" buttonLabel="Process Video"
                    readyMessage="Streaming version is ready. Main Video URL has been filled automatically."
                    masterKey={masterVideoKey} initialJob={latestJobVideo ?? null}
                    onUrlReady={setVideoUrl}
                  />
                  <span className="form-hint">Private source file for background HLS processing. Not shown publicly.</span>
                </div>
              </>
            )}

            {/* Teaser (commercial) */}
            {showTeaserUrl && (
              <div className="form-group">
                <label className="form-label">Teaser URL (optional)</label>
                <input type="url" name="teaserUrl" className="form-input"
                  value={teaserUrl} onChange={(e) => setTeaserUrl(e.target.value)}
                  placeholder="Short teaser video URL" />
                <div style={{ marginTop: "0.5rem" }}>
                  <R2FileUpload targetField="teaserUrl" projectTitle={title || "untitled"}
                    projectSlug={work?.slug} onSuccess={setTeaserUrl} accept="video/*" />
                </div>
              </div>
            )}

          </div>
        </WfSection>

        {/* ── Section 4: Case Study & Deliverables (client types) ── */}
        {isClientType && (
          <WfSection title="Case Study & Deliverables" icon="📁" defaultOpen={hasCaseStudyContent}>
            <div className="wf-sec-inner">
              {showDeliverables && (
                <div className="form-group">
                  <label className="form-label">Deliverables</label>
                  <textarea name="deliverables" className="form-textarea" rows={3}
                    defaultValue={work?.deliverables ?? ""}
                    placeholder="Brand identity, Social campaign, TV spot…" />
                </div>
              )}
              {showCaseStudy && (
                <div className="form-group">
                  <label className="form-label">Case Study</label>
                  <textarea name="caseStudy" className="form-textarea" rows={6}
                    defaultValue={work?.caseStudy ?? ""} placeholder="Full case study description…" />
                </div>
              )}
              {showGallery && (
                <div className="form-group">
                  <label className="form-label">Gallery Image URLs (one per line)</label>
                  <textarea name="galleryUrls" className="form-textarea" rows={4}
                    defaultValue={work?.galleryUrls.join("\n") ?? ""}
                    placeholder={"https://cdn.example.com/img1.jpg\nhttps://cdn.example.com/img2.jpg"} />
                </div>
              )}
            </div>
          </WfSection>
        )}

        {/* ── Section 5: Display & Settings ───────────────────────── */}
        <WfSection title="Display & Settings" icon="⚙" defaultOpen={false}>
          <div className="wf-sec-inner">

            {/* Display controls */}
            {!isEpisode && (
              <>
                <div className="form-section-title">Display &amp; Featuring</div>
                <div className="form-row form-row--checks">
                  <label className="form-check">
                    <input type="hidden" name="featuredOnHome" value="false" />
                    <input type="checkbox" name="featuredOnHome" value="true"
                      defaultChecked={work?.featuredOnHome ?? false} />
                    <span>Feature on Home hero</span>
                  </label>
                  <label className="form-check">
                    <input type="hidden" name="featuredOnWorks" value="false" />
                    <input type="checkbox" name="featuredOnWorks" value="true"
                      defaultChecked={work?.featuredOnWorks ?? false} />
                    <span>Feature on Works hero</span>
                  </label>
                  <label className="form-check">
                    <input type="hidden" name="showOnHome" value="false" />
                    <input type="checkbox" name="showOnHome" value="true"
                      defaultChecked={work?.showOnHome ?? false} />
                    <span>Show in Home rails</span>
                  </label>
                  <label className="form-check">
                    <input type="hidden" name="featured" value="false" />
                    <input type="checkbox" name="featured" value="true"
                      defaultChecked={work?.featured ?? false} />
                    <span>Featured</span>
                  </label>
                  <label className="form-check">
                    <input type="hidden" name="commentsEnabled" value="false" />
                    <input type="checkbox" name="commentsEnabled" value="true"
                      defaultChecked={work?.commentsEnabled ?? true} />
                    <span>Enable viewer comments</span>
                  </label>
                </div>
                <div className="form-divider" />
              </>
            )}

            {/* Access control */}
            {isEpisode ? (
              <div className="form-episode-access-note">
                <span className="form-hint">
                  🔒 Episode access is controlled by the parent series. Set login requirements on the series itself.
                </span>
              </div>
            ) : (
              <div className="form-row form-row--checks">
                <label className="form-check">
                  <input type="hidden" name="requiresAuth" value="false" />
                  <input type="checkbox" name="requiresAuth" value="true"
                    defaultChecked={work?.requiresAuth ?? false} />
                  <span>
                    {type === "SERIES"
                      ? "Requires login to watch series & episodes"
                      : "Requires login to watch"}
                  </span>
                </label>
                {showTrailerUrl && (
                  <label className="form-check">
                    <input type="hidden" name="requiresLoginToViewTrailer" value="false" />
                    <input type="checkbox" name="requiresLoginToViewTrailer" value="true"
                      defaultChecked={work?.requiresLoginToViewTrailer ?? false} />
                    <span>Requires login to watch trailer</span>
                  </label>
                )}
              </div>
            )}

            {/* Episode player timing override */}
            {isEpisode && (
              <>
                <div className="form-divider" />
                <div className="form-section-title">Player Timings</div>
                <span className="form-hint" style={{ display: "block", marginBottom: "0.75rem" }}>
                  Override the series intro/credits timing for this episode. Leave blank to use the Series settings.
                </span>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Intro Start (s)</label>
                    <input type="number" name="introStart" className="form-input"
                      defaultValue={work?.introStart ?? ""} min={0} placeholder="Series default" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Intro End (s)</label>
                    <input type="number" name="introEnd" className="form-input"
                      defaultValue={work?.introEnd ?? ""} min={0} placeholder="Series default" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Credits Start (s)</label>
                    <input type="number" name="creditsStart" className="form-input"
                      defaultValue={work?.creditsStart ?? ""} min={0} placeholder="Series default" />
                  </div>
                </div>
                <div className="form-episode-access-note">
                  <span className="form-hint">
                    Content rating and content descriptors are controlled by the parent Series.
                  </span>
                </div>
              </>
            )}

            {/* Content Advisory */}
            {showContentAdvisory && (
              <>
                <div className="form-divider" />
                <div className="form-section-title">Content Advisory</div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Content Rating</label>
                    <select name="contentRating" className="form-input" defaultValue={work?.contentRating ?? ""}>
                      <option value="">Not Rated / Not Set</option>
                      <option value="G">G — General Audiences</option>
                      <option value="PG">PG — Parental Guidance</option>
                      <option value="PG-13">PG-13 — Parents Strongly Cautioned</option>
                      <option value="R">R — Restricted</option>
                      <option value="NC-17">NC-17 — Adults Only</option>
                      <option value="TV-G">TV-G — All Ages</option>
                      <option value="TV-PG">TV-PG — Parental Guidance</option>
                      <option value="TV-14">TV-14 — Parents Strongly Cautioned</option>
                      <option value="TV-MA">TV-MA — Mature Audiences</option>
                      <option value="NR">NR — Not Rated</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Content Descriptors</label>
                  <div className="form-check-grid">
                    {[
                      ["VIOLENCE",          "Violence"],
                      ["STRONG_LANGUAGE",   "Strong Language"],
                      ["MILD_LANGUAGE",     "Mild Language"],
                      ["NUDITY",            "Nudity"],
                      ["SEXUAL_CONTENT",    "Sexual Content"],
                      ["DRUG_USE",          "Drug Use"],
                      ["ALCOHOL",           "Alcohol Use"],
                      ["SMOKING",           "Smoking"],
                      ["FRIGHTENING",       "Frightening Scenes"],
                      ["THEMATIC_ELEMENTS", "Thematic Elements"],
                    ].map(([val, label]) => (
                      <label key={val} className="form-check">
                        <input type="checkbox" name="contentDescriptors" value={val}
                          defaultChecked={work?.contentDescriptors?.includes(val) ?? false} />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                  <span className="form-hint">Checked items appear in the content warning shown to viewers.</span>
                </div>

                {/* Player Timings (non-episode) */}
                {showPlayerTimings && (
                  <>
                    <div className="form-divider" />
                    <div className="form-section-title">Player Timings</div>
                    <span className="form-hint" style={{ display: "block", marginBottom: "0.75rem" }}>
                      All values in seconds. Leave blank to disable. For Series, these apply to every episode.
                    </span>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Intro Start (s)</label>
                        <input type="number" name="introStart" className="form-input"
                          defaultValue={work?.introStart ?? ""} min={0} placeholder="e.g. 30" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Intro End (s) — Skip Intro seeks here</label>
                        <input type="number" name="introEnd" className="form-input"
                          defaultValue={work?.introEnd ?? ""} min={0} placeholder="e.g. 105" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Credits Start (s)</label>
                        <input type="number" name="creditsStart" className="form-input"
                          defaultValue={work?.creditsStart ?? ""} min={0} placeholder="e.g. 2520" />
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Sort Order */}
            {!isEpisode && (
              <>
                <div className="form-divider" />
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Sort Order</label>
                    <input type="number" name="order" className="form-input"
                      defaultValue={work?.order ?? 0} min={0} />
                  </div>
                </div>
              </>
            )}

            {/* Rows & Collections */}
            {!isEpisode && rows.length > 0 && (
              <>
                <div className="form-divider" />
                <div className="form-section-title">Rows &amp; Collections</div>
                <input type="hidden" name="hasRowsSection" value="1" />
                <span className="form-hint" style={{ display: "block", marginBottom: "0.75rem" }}>
                  Choose the custom rows where this project should appear.
                </span>
                <div className="form-check-grid">
                  {rows.map((row) => (
                    <label key={row.id} className="form-check">
                      <input type="checkbox" name="rowIds" value={row.id}
                        defaultChecked={assignedRowIds.includes(row.id)} />
                      <span>{row.title} — {row.placement}</span>
                    </label>
                  ))}
                </div>
              </>
            )}

          </div>
        </WfSection>

        {/* Bottom save actions — preserved as fallback below the fold */}
        <div className="form-actions">
          <Link href="/admin/works" className="form-cancel">Cancel</Link>
          <SaveButton isNew={!work} />
        </div>

      </form>
    </div>
  );
}
