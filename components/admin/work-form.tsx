"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

type WorkType =
  | "SHORT_FILM" | "FULL_FILM" | "SERIES" | "EPISODE" | "TRAILER"
  | "COMMERCIAL" | "BRANDING" | "CAMPAIGN" | "CASE_STUDY";

type WorkStatus = "DRAFT" | "PUBLISHED" | "PRIVATE";

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
  type: WorkType; status: WorkStatus; title: string;
  description: string | null; posterUrl: string | null;
  videoUrl: string | null; trailerUrl: string | null; teaserUrl: string | null;
  year: number | null; duration: number | null; director: string | null; genre: string | null;
  clientName: string | null; industry: string | null; projectGoal: string | null;
  deliverables: string | null; caseStudy: string | null; galleryUrls: string[];
  requiresAuth: boolean; featured: boolean; showOnHome: boolean; order: number;
  parentId: string | null; episodeNumber: number | null; seasonNumber: number | null;
};

type Props = {
  work: WorkData | null;
  workTitle?: string;
  action: (formData: FormData) => Promise<void>;
  seriesList: { id: string; title: string }[];
  error?: string;
};

const CLIENT_TYPES: WorkType[] = ["COMMERCIAL", "BRANDING", "CAMPAIGN", "CASE_STUDY"];

export default function WorkForm({ work, workTitle, action, seriesList, error }: Props) {
  const [type, setType] = useState<WorkType>(work?.type ?? "SHORT_FILM");

  const showFilmMeta   = ["SHORT_FILM", "FULL_FILM", "SERIES", "TRAILER"].includes(type);
  const showDuration   = !["SERIES", ...CLIENT_TYPES].includes(type);
  const showDirector   = ["SHORT_FILM", "FULL_FILM", "SERIES"].includes(type);
  const showTrailerUrl = ["SHORT_FILM", "FULL_FILM", "SERIES"].includes(type);
  const showVideoUrl   = type !== "SERIES";
  const showTeaserUrl  = type === "COMMERCIAL";
  const isEpisode      = type === "EPISODE";
  const isClientType   = CLIENT_TYPES.includes(type);
  const showDeliverables = ["BRANDING", "CAMPAIGN", "CASE_STUDY"].includes(type);
  const showCaseStudy  = ["BRANDING", "CAMPAIGN", "CASE_STUDY"].includes(type);
  const showGallery    = ["BRANDING", "CAMPAIGN", "CASE_STUDY"].includes(type);

  const videoLabel =
    type === "TRAILER"  ? "Trailer Video URL" :
    type === "EPISODE"  ? "Episode Video URL" :
    type === "COMMERCIAL" ? "Commercial Video URL" :
    "Main Video URL";

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
              <select name="parentId" className="form-input" defaultValue={work?.parentId ?? ""} required>
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
            defaultValue={work?.title ?? ""} required placeholder="Work title" />
        </div>

        {/* Description */}
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea name="description" className="form-textarea" rows={3}
            defaultValue={work?.description ?? ""} placeholder="Short description…" />
        </div>

        {/* Film metadata */}
        {showFilmMeta && (
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Genre</label>
              <input type="text" name="genre" className="form-input"
                defaultValue={work?.genre ?? ""} placeholder="Drama, Sci-Fi…" />
            </div>
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

        {/* Episode duration (separate row) */}
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

        {/* Poster */}
        <div className="form-group">
          <label className="form-label">Poster / Thumbnail URL</label>
          <input type="url" name="posterUrl" className="form-input"
            defaultValue={work?.posterUrl ?? ""} placeholder="https://…" />
        </div>

        {/* Trailer URL */}
        {showTrailerUrl && (
          <div className="form-group">
            <label className="form-label">Trailer URL</label>
            <input type="url" name="trailerUrl" className="form-input"
              defaultValue={work?.trailerUrl ?? ""} placeholder="YouTube, Vimeo, or .mp4 URL" />
          </div>
        )}

        {/* Main video URL */}
        {showVideoUrl && (
          <div className="form-group">
            <label className="form-label">{videoLabel}</label>
            <input type="url" name="videoUrl" className="form-input"
              defaultValue={work?.videoUrl ?? ""} placeholder="YouTube, Vimeo, or .mp4 URL" />
          </div>
        )}

        {/* Teaser (commercial only) */}
        {showTeaserUrl && (
          <div className="form-group">
            <label className="form-label">Teaser URL (optional)</label>
            <input type="url" name="teaserUrl" className="form-input"
              defaultValue={work?.teaserUrl ?? ""} placeholder="Short teaser video URL" />
          </div>
        )}

        {/* Deliverables */}
        {showDeliverables && (
          <div className="form-group">
            <label className="form-label">Deliverables</label>
            <textarea name="deliverables" className="form-textarea" rows={3}
              defaultValue={work?.deliverables ?? ""}
              placeholder="Brand identity, Social campaign, TV spot…" />
          </div>
        )}

        {/* Case study */}
        {showCaseStudy && (
          <div className="form-group">
            <label className="form-label">Case Study</label>
            <textarea name="caseStudy" className="form-textarea" rows={6}
              defaultValue={work?.caseStudy ?? ""} placeholder="Full case study description…" />
          </div>
        )}

        {/* Gallery URLs */}
        {showGallery && (
          <div className="form-group">
            <label className="form-label">Gallery Image URLs (one per line)</label>
            <textarea name="galleryUrls" className="form-textarea" rows={4}
              defaultValue={work?.galleryUrls.join("\n") ?? ""}
              placeholder={"https://cdn.example.com/img1.jpg\nhttps://cdn.example.com/img2.jpg"} />
          </div>
        )}

        {/* Display controls */}
        <div className="form-divider" />
        <div className="form-row form-row--checks">
          <label className="form-check">
            <input type="hidden" name="featured" value="false" />
            <input type="checkbox" name="featured" value="true"
              defaultChecked={work?.featured ?? false} />
            <span>Featured</span>
          </label>
          <label className="form-check">
            <input type="hidden" name="showOnHome" value="false" />
            <input type="checkbox" name="showOnHome" value="true"
              defaultChecked={work?.showOnHome ?? false} />
            <span>Show on Home page</span>
          </label>
          <label className="form-check">
            <input type="hidden" name="requiresAuth" value="false" />
            <input type="checkbox" name="requiresAuth" value="true"
              defaultChecked={work?.requiresAuth ?? false} />
            <span>Requires login to watch</span>
          </label>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Sort Order</label>
            <input type="number" name="order" className="form-input"
              defaultValue={work?.order ?? 0} min={0} />
          </div>
        </div>

        <div className="form-actions">
          <Link href="/admin/works" className="form-cancel">Cancel</Link>
          <button type="submit" className="form-submit">
            {work ? "Save Changes" : "Add Work"}
          </button>
        </div>
      </form>

      <style>{`
        .admin-form-page { max-width: 760px; }
        .admin-back {
          display: inline-flex; align-items: center; gap: 0.3rem;
          font-family: var(--font-body); font-size: 0.8rem;
          letter-spacing: 0.06em; text-transform: uppercase;
          color: var(--color-brand-muted); text-decoration: none;
          margin-bottom: 1.5rem; transition: color 0.2s;
        }
        .admin-back:hover { color: var(--color-brand-white); }
        .admin-page-title {
          font-family: var(--font-display); font-size: 1.6rem;
          font-weight: 700; color: var(--color-brand-white); margin: 0 0 2rem;
        }
        .form-error {
          background: rgba(192,57,43,0.12); border: 1px solid var(--color-brand-red);
          color: #e74c3c; font-family: var(--font-body); font-size: 0.85rem;
          padding: 0.75rem 1rem; border-radius: 4px; margin-bottom: 1.25rem;
        }
        .work-form { display: flex; flex-direction: column; gap: 1.25rem; }
        .form-row { display: grid; grid-template-columns: 1fr; gap: 1.25rem; }
        @media (min-width: 640px) {
          .form-row { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
        }
        .form-row--checks { grid-template-columns: 1fr; gap: 0.75rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.4rem; }
        .form-label {
          font-family: var(--font-body); font-size: 0.8rem;
          font-weight: 500; color: var(--color-brand-light);
        }
        .form-input, .form-textarea {
          font-family: var(--font-body); font-size: 0.9rem;
          color: var(--color-brand-white); background: var(--color-brand-surface);
          border: 1px solid var(--color-brand-border); border-radius: 4px;
          padding: 0.65rem 0.9rem; outline: none; transition: border-color 0.2s;
          width: 100%; box-sizing: border-box; resize: vertical;
        }
        .form-input::placeholder, .form-textarea::placeholder { color: var(--color-brand-muted); }
        .form-input:focus, .form-textarea:focus { border-color: var(--color-brand-accent); }
        select.form-input { cursor: pointer; }
        .form-divider { border-top: 1px solid var(--color-brand-border); margin: 0.25rem 0; }
        .form-check {
          display: flex; align-items: center; gap: 0.6rem; cursor: pointer;
          font-family: var(--font-body); font-size: 0.875rem; color: var(--color-brand-light);
        }
        .form-check input[type="checkbox"] {
          width: 16px; height: 16px; accent-color: var(--color-brand-accent); cursor: pointer;
        }
        .form-actions { display: flex; gap: 0.75rem; align-items: center; padding-top: 0.5rem; }
        .form-cancel {
          font-family: var(--font-body); font-size: 0.875rem; color: var(--color-brand-muted);
          text-decoration: none; padding: 0.65rem 1.25rem;
          border: 1px solid var(--color-brand-border); border-radius: 4px; transition: color 0.2s;
        }
        .form-cancel:hover { color: var(--color-brand-white); }
        .form-submit {
          font-family: var(--font-body); font-size: 0.875rem; font-weight: 600;
          color: var(--color-brand-black); background: var(--color-brand-accent);
          border: none; border-radius: 4px; padding: 0.65rem 1.75rem;
          cursor: pointer; transition: filter 0.2s;
        }
        .form-submit:hover { filter: brightness(1.05); }
      `}</style>
    </div>
  );
}
