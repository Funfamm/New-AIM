"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { submitCastingApplication } from "@/lib/actions/casting";
import type { SubmitApplicationInput } from "@/lib/actions/casting";
import "../../casting.css";

// ── Types ─────────────────────────────────────────────────────

type UploadedFile = {
  r2Key:         string;
  mimeType:      string;
  fileSizeBytes: number;
  originalFilename: string;
  previewUrl?:   string;
};

type UploadedAudio = UploadedFile & { durationSeconds?: number };

type StepId = "intro" | "media" | "details" | "policy" | "review" | "done";

const STEPS: StepId[] = ["intro", "media", "details", "policy", "review", "done"];
const STEP_LABELS: Record<StepId, string> = {
  intro:   "Overview",
  media:   "Media",
  details: "Details",
  policy:  "Policy",
  review:  "Review",
  done:    "Done",
};

// ── Role type (passed as prop from server) ────────────────────

type Role = {
  id:                 string;
  slug:               string;
  title:              string;
  description:        string;
  requireVoiceSample: boolean;
  requireGender:      boolean;
  allowedGender:      string | null;
  requireAgeRange:    boolean;
  minAge:             number | null;
  maxAge:             number | null;
};

// ── Main component ────────────────────────────────────────────

export default function ApplyForm({ role }: { role: Role }) {
  const router = useRouter();
  const [step, setStep] = useState<StepId>("intro");
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Media
  const [images, setImages] = useState<UploadedFile[]>([]);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [audio, setAudio] = useState<UploadedAudio | null>(null);
  const [audioUploading, setAudioUploading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Details
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [socialHandle, setSocialHandle] = useState("");
  const [roleInterest, setRoleInterest] = useState("");
  const [shortNote, setShortNote] = useState("");
  const [gender, setGender] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [detailsError, setDetailsError] = useState<string | null>(null);

  // Policy
  const [consented, setConsented] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [isAdult, setIsAdult] = useState(false);
  const [unpaidAccepted, setUnpaidAccepted] = useState(false);
  const [likenessRelease, setLikenessRelease] = useState(false);
  const [withdrawalTerms, setWithdrawalTerms] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);

  const stepIndex = STEPS.indexOf(step);

  const goTo = useCallback((s: StepId) => {
    setGlobalError(null);
    setStep(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // ── Upload helpers ────────────────────────────────────────

  async function uploadFile(
    file: File,
    mediaType: "IMAGE" | "AUDIO",
  ): Promise<UploadedFile & { durationSeconds?: number }> {
    const res = await fetch("/api/casting/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mediaType,
        mimeType:      file.type,
        fileSizeBytes: file.size,
        filename:      file.name,
      }),
    });

    if (!res.ok) {
      const { error } = await res.json();
      throw new Error(error ?? "Upload failed");
    }

    const { uploadUrl, r2Key } = await res.json();

    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });

    if (!putRes.ok) throw new Error("File upload to storage failed");

    let durationSeconds: number | undefined;
    if (mediaType === "AUDIO") {
      durationSeconds = await getAudioDuration(file);
    }

    return {
      r2Key,
      mimeType:         file.type,
      fileSizeBytes:    file.size,
      originalFilename: file.name,
      previewUrl:       mediaType === "IMAGE" ? URL.createObjectURL(file) : undefined,
      durationSeconds,
    };
  }

  async function getAudioDuration(file: File): Promise<number | undefined> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const audio = new Audio(url);
      audio.addEventListener("loadedmetadata", () => {
        URL.revokeObjectURL(url);
        resolve(isFinite(audio.duration) ? Math.round(audio.duration) : undefined);
      });
      audio.addEventListener("error", () => { URL.revokeObjectURL(url); resolve(undefined); });
    });
  }

  async function handleImageFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setImageError(null);

    const remaining = 6 - images.length;
    const toUpload = Array.from(files).slice(0, remaining);

    if (toUpload.length === 0) {
      setImageError("You can upload a maximum of 6 images.");
      return;
    }

    setImageUploading(true);
    const results: UploadedFile[] = [];
    for (const file of toUpload) {
      try {
        const uploaded = await uploadFile(file, "IMAGE");
        results.push(uploaded);
      } catch (err: unknown) {
        setImageError(err instanceof Error ? err.message : "Image upload failed");
        break;
      }
    }
    setImages((prev) => [...prev, ...results]);
    setImageUploading(false);
  }

  async function handleAudioFile(file: File | null) {
    if (!file) return;
    setAudioError(null);
    setAudioUploading(true);
    try {
      const uploaded = await uploadFile(file, "AUDIO");
      setAudio(uploaded);
    } catch (err: unknown) {
      setAudioError(err instanceof Error ? err.message : "Audio upload failed");
    }
    setAudioUploading(false);
  }

  function removeImage(index: number) {
    setImages((prev) => {
      const next = [...prev];
      const removed = next.splice(index, 1)[0];
      if (removed.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  }

  // Cleanup previews on unmount
  useEffect(() => {
    return () => {
      images.forEach((img) => { if (img.previewUrl) URL.revokeObjectURL(img.previewUrl); });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Step navigation ───────────────────────────────────────

  function validateMedia(): boolean {
    if (images.length < 4) { setImageError("Please upload at least 4 images."); return false; }
    if (role.requireVoiceSample && !audio) { setAudioError("An audio voice sample is required for this role."); return false; }
    if (audio?.durationSeconds != null) {
      if (audio.durationSeconds < 60)  { setAudioError("Audio sample must be at least 1 minute long."); return false; }
      if (audio.durationSeconds > 180) { setAudioError("Audio sample must not exceed 3 minutes."); return false; }
    }
    return true;
  }

  function validateDetails(): boolean {
    if (!name.trim())         { setDetailsError("Name is required."); return false; }
    if (!location.trim())     { setDetailsError("Location is required."); return false; }
    if (!socialHandle.trim()) { setDetailsError("Social media handle is required."); return false; }
    if (!shortNote.trim())    { setDetailsError("Short note is required."); return false; }
    return true;
  }

  function validatePolicy(): boolean {
    if (!consented)       { setPolicyError("You must accept the consent terms."); return false; }
    if (!policyAccepted)  { setPolicyError("You must accept the Casting Policy."); return false; }
    if (!isAdult)         { setPolicyError("You must confirm you are 18 or older."); return false; }
    if (!unpaidAccepted)  { setPolicyError("You must acknowledge this is an unpaid opportunity."); return false; }
    if (!likenessRelease) { setPolicyError("You must accept the Likeness Release terms."); return false; }
    if (!withdrawalTerms) { setPolicyError("You must accept the withdrawal policy terms."); return false; }
    return true;
  }

  function handleNextFromMedia() {
    setImageError(null);
    setAudioError(null);
    if (validateMedia()) goTo("details");
  }

  function handleNextFromDetails() {
    setDetailsError(null);
    if (validateDetails()) goTo("policy");
  }

  function handleNextFromPolicy() {
    setPolicyError(null);
    if (validatePolicy()) goTo("review");
  }

  async function handleSubmit() {
    setGlobalError(null);
    setSubmitting(true);

    const input: SubmitApplicationInput = {
      roleId:       role.id,
      name:         name.trim(),
      location:     location.trim(),
      socialHandle: socialHandle.trim(),
      roleInterest: roleInterest.trim(),
      shortNote:    shortNote.trim(),
      gender:       gender.trim() || undefined,
      ageRange:     ageRange.trim() || undefined,
      imageKeys:    images.map((img) => ({
        r2Key:         img.r2Key,
        mimeType:      img.mimeType,
        fileSizeBytes: img.fileSizeBytes,
        originalFilename: img.originalFilename,
      })),
      audioKey: audio ? {
        r2Key:           audio.r2Key,
        mimeType:        audio.mimeType,
        fileSizeBytes:   audio.fileSizeBytes,
        durationSeconds: audio.durationSeconds,
        originalFilename: audio.originalFilename,
      } : undefined,
      consentAccepted:         consented,
      policyAccepted:          policyAccepted,
      isAdultConfirmed:        isAdult,
      unpaidAccepted:          unpaidAccepted,
      likenessReleaseAccepted: likenessRelease,
      withdrawalTermsAccepted: withdrawalTerms,
    };

    const result = await submitCastingApplication(input);

    if (result.ok && result.trackingToken) {
      router.push(`/casting/applications/track/${result.trackingToken}`);
    } else {
      setGlobalError(result.error ?? "Submission failed. Please try again.");
      setSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <main className="casting-apply-page">
      {/* Back link */}
      <div className="casting-apply-back">
        <Link href={`/casting/${role.slug}`} className="casting-back-link">← {role.title}</Link>
      </div>

      {/* Step progress */}
      {step !== "done" && (
        <div className="casting-steps">
          {STEPS.filter((s) => s !== "done").map((s, i) => (
            <div
              key={s}
              className={`casting-step ${i < stepIndex ? "casting-step--done" : ""} ${s === step ? "casting-step--active" : ""}`}
            >
              <span className="casting-step-dot">{i < stepIndex ? "✓" : i + 1}</span>
              <span className="casting-step-label">{STEP_LABELS[s]}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Step: intro ── */}
      {step === "intro" && (
        <div className="casting-step-content">
          <h1 className="casting-apply-title">Apply for {role.title}</h1>
          <p className="casting-apply-sub">
            Before you begin, please read the requirements below carefully.
            This application is in four steps: upload your media, fill in your details, accept the policy, then review and submit.
          </p>
          <div className="casting-apply-requirements">
            <h2 className="casting-detail-section-title">What You Need</h2>
            <ul className="casting-req-list">
              <li>4–6 photos (JPEG, PNG, or WebP — max 10 MB each)</li>
              {role.requireVoiceSample && <li>1 audio voice sample, 1–3 minutes (MP3, M4A, WAV — max 50 MB)</li>}
              {role.requireGender && role.allowedGender && <li>Gender: {role.allowedGender}</li>}
              {role.requireAgeRange && role.minAge != null && role.maxAge != null && <li>Age range: {role.minAge}–{role.maxAge}</li>}
              <li>Active social media handle</li>
              <li>Short personal note about your interest in this role</li>
            </ul>
            <p className="casting-apply-policy-note">
              This is an unpaid opportunity. You must be 18 or older. You may withdraw before your application enters review.
            </p>
          </div>
          <div className="casting-apply-actions">
            <button className="casting-btn casting-btn--primary" onClick={() => goTo("media")}>
              Begin Application
            </button>
          </div>
        </div>
      )}

      {/* ── Step: media ── */}
      {step === "media" && (
        <div className="casting-step-content">
          <h2 className="casting-apply-title">Upload Your Media</h2>

          <section className="casting-media-section">
            <div className="casting-media-header">
              <h3 className="casting-media-title">Photos <span className="casting-media-count">({images.length}/6 — min 4)</span></h3>
            </div>

            {images.length < 6 && (
              <button
                type="button"
                className={`casting-upload-zone${imageUploading ? " casting-upload-zone--disabled" : ""}`}
                onClick={() => imageInputRef.current?.click()}
                disabled={imageUploading}
                aria-label="Upload photos"
              >
                <span className="casting-upload-zone-icon">↑</span>
                <p className="casting-upload-zone-text">
                  {imageUploading ? "Uploading…" : "Click to upload photos"}
                </p>
                <p className="casting-upload-zone-hint">
                  JPEG, PNG or WebP · max 10 MB each · {images.length}/6 uploaded
                </p>
              </button>
            )}

            <div className="casting-image-grid">
              {images.map((img, i) => (
                <div key={img.r2Key} className="casting-image-thumb">
                  {img.previewUrl ? (
                    <img src={img.previewUrl} alt={`Photo ${i + 1}`} className="casting-image-preview" />
                  ) : (
                    <div className="casting-image-placeholder">Photo {i + 1}</div>
                  )}
                  <button
                    type="button"
                    className="casting-image-remove"
                    onClick={() => removeImage(i)}
                    aria-label="Remove photo"
                  >×</button>
                </div>
              ))}
            </div>

            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              multiple
              className="casting-hidden-input"
              onChange={(e) => handleImageFiles(e.target.files)}
            />
            {imageError && <p className="casting-field-error">{imageError}</p>}
          </section>

          {role.requireVoiceSample && (
            <section className="casting-media-section">
              <div className="casting-media-header">
                <h3 className="casting-media-title">Voice Sample <span className="casting-media-required">Required</span></h3>
                <p className="casting-media-hint">1–3 minutes · MP3, M4A, WAV, OGG, or WEBM · max 50 MB</p>
              </div>
              {audio ? (
                <div className="casting-audio-uploaded">
                  <span className="casting-audio-name">{audio.originalFilename}</span>
                  {audio.durationSeconds != null && (
                    <span className="casting-audio-duration">{Math.floor(audio.durationSeconds / 60)}:{String(audio.durationSeconds % 60).padStart(2, "0")}</span>
                  )}
                  <button type="button" className="casting-audio-remove" onClick={() => setAudio(null)}>Remove</button>
                </div>
              ) : (
                <button
                  type="button"
                  className="casting-btn casting-btn--outline"
                  onClick={() => audioInputRef.current?.click()}
                  disabled={audioUploading}
                >
                  {audioUploading ? "Uploading…" : "Upload Audio Sample"}
                </button>
              )}
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/mpeg,audio/mp3,audio/mp4,audio/m4a,audio/wav,audio/ogg,audio/webm"
                className="casting-hidden-input"
                onChange={(e) => handleAudioFile(e.target.files?.[0] ?? null)}
              />
              {audioError && <p className="casting-field-error">{audioError}</p>}
            </section>
          )}

          <div className="casting-apply-actions">
            <button className="casting-btn casting-btn--ghost" onClick={() => goTo("intro")}>Back</button>
            <button className="casting-btn casting-btn--primary" onClick={handleNextFromMedia}>
              Next: Details
            </button>
          </div>
        </div>
      )}

      {/* ── Step: details ── */}
      {step === "details" && (
        <div className="casting-step-content">
          <h2 className="casting-apply-title">Your Details</h2>

          <div className="casting-form">
            <div className="casting-field">
              <label className="casting-label" htmlFor="ca-name">Full Name <span className="casting-req-star">*</span></label>
              <input id="ca-name" className="casting-input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
            </div>

            <div className="casting-field">
              <label className="casting-label" htmlFor="ca-location">Location <span className="casting-req-star">*</span></label>
              <input id="ca-location" className="casting-input" type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, Country" />
            </div>

            <div className="casting-field">
              <label className="casting-label" htmlFor="ca-social">Social Media Handle <span className="casting-req-star">*</span></label>
              <input id="ca-social" className="casting-input" type="text" value={socialHandle} onChange={(e) => setSocialHandle(e.target.value)} placeholder="@username or profile URL" />
            </div>

            {role.requireGender && (
              <div className="casting-field">
                <label className="casting-label" htmlFor="ca-gender">Gender</label>
                <input id="ca-gender" className="casting-input" type="text" value={gender} onChange={(e) => setGender(e.target.value)} placeholder="As you identify" />
              </div>
            )}

            {role.requireAgeRange && (
              <div className="casting-field">
                <label className="casting-label" htmlFor="ca-age">Age Range</label>
                <input id="ca-age" className="casting-input" type="text" value={ageRange} onChange={(e) => setAgeRange(e.target.value)} placeholder="e.g. 25–30" />
              </div>
            )}

            <div className="casting-field">
              <label className="casting-label" htmlFor="ca-interest">Why This Role?</label>
              <textarea id="ca-interest" className="casting-textarea" value={roleInterest} onChange={(e) => setRoleInterest(e.target.value)} placeholder="Tell us why you're interested in this role." rows={3} />
            </div>

            <div className="casting-field">
              <label className="casting-label" htmlFor="ca-note">Short Note About Yourself <span className="casting-req-star">*</span></label>
              <textarea id="ca-note" className="casting-textarea" value={shortNote} onChange={(e) => setShortNote(e.target.value)} placeholder="Brief introduction — background, experience, or anything relevant." rows={4} />
            </div>

            {detailsError && <p className="casting-field-error">{detailsError}</p>}
          </div>

          <div className="casting-apply-actions">
            <button className="casting-btn casting-btn--ghost" onClick={() => goTo("media")}>Back</button>
            <button className="casting-btn casting-btn--primary" onClick={handleNextFromDetails}>
              Next: Policy
            </button>
          </div>
        </div>
      )}

      {/* ── Step: policy ── */}
      {step === "policy" && (
        <div className="casting-step-content">
          <h2 className="casting-apply-title">Policy & Release</h2>
          <p className="casting-apply-sub">
            Please read and accept each item below. You must accept all six to submit your application.
          </p>

          <div className="casting-policy-form">
            <label className="casting-checkbox-label">
              <input type="checkbox" checked={isAdult} onChange={(e) => setIsAdult(e.target.checked)} />
              <span><strong>Age Confirmation</strong> — I confirm I am 18 years of age or older. Applications from minors will not be processed.</span>
            </label>

            <label className="casting-checkbox-label">
              <input type="checkbox" checked={unpaidAccepted} onChange={(e) => setUnpaidAccepted(e.target.checked)} />
              <span><strong>Unpaid Opportunity</strong> — I understand that this is a voluntary, unpaid casting opportunity and that no financial compensation will be provided for my application or potential participation.</span>
            </label>

            <label className="casting-checkbox-label">
              <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)} />
              <span><strong>Data & Privacy Consent</strong> — I consent to AIM Studio collecting and securely storing the personal information, images, and audio I submit as part of this application. This data will only be used for casting evaluation purposes.</span>
            </label>

            <label className="casting-checkbox-label">
              <input type="checkbox" checked={likenessRelease} onChange={(e) => setLikenessRelease(e.target.checked)} />
              <span><strong>Likeness Release</strong> — If selected, I grant AIM Studio a non-exclusive, royalty-free licence to use my name, image, and likeness in connection with the production I am selected for, and for promotional purposes related to that production.</span>
            </label>

            <label className="casting-checkbox-label">
              <input type="checkbox" checked={withdrawalTerms} onChange={(e) => setWithdrawalTerms(e.target.checked)} />
              <span><strong>Withdrawal Policy</strong> — I understand that I may withdraw my application only while it is in SUBMITTED or UNDER AGENT REVIEW status. Once my application moves to a later stage, withdrawal is no longer available.</span>
            </label>

            <label className="casting-checkbox-label">
              <input type="checkbox" checked={policyAccepted} onChange={(e) => setPolicyAccepted(e.target.checked)} />
              <span><strong>Casting Policy (v1.0)</strong> — I have read and agree to the AIM Studio Casting Policy. I understand that AIM Studio makes all final casting decisions, that decisions are based on role suitability and submission quality only, and that I will not be evaluated based on any protected characteristic.</span>
            </label>

            {policyError && <p className="casting-field-error">{policyError}</p>}
          </div>

          <div className="casting-apply-actions">
            <button className="casting-btn casting-btn--ghost" onClick={() => goTo("details")}>Back</button>
            <button className="casting-btn casting-btn--primary" onClick={handleNextFromPolicy}>
              Review & Submit
            </button>
          </div>
        </div>
      )}

      {/* ── Step: review ── */}
      {step === "review" && (
        <div className="casting-step-content">
          <h2 className="casting-apply-title">Review Your Application</h2>
          <p className="casting-apply-sub">Check everything below before submitting. You cannot edit after submission.</p>

          <div className="casting-review-section">
            <h3 className="casting-review-heading">Media</h3>
            <p className="casting-review-line">{images.length} photo{images.length !== 1 ? "s" : ""} uploaded</p>
            {audio && <p className="casting-review-line">Audio: {audio.originalFilename}{audio.durationSeconds ? ` (${Math.floor(audio.durationSeconds / 60)}:${String(audio.durationSeconds % 60).padStart(2, "0")})` : ""}</p>}
          </div>

          <div className="casting-review-section">
            <h3 className="casting-review-heading">Details</h3>
            <div className="casting-review-grid">
              <span className="casting-review-key">Name</span><span className="casting-review-val">{name}</span>
              <span className="casting-review-key">Location</span><span className="casting-review-val">{location}</span>
              <span className="casting-review-key">Social Handle</span><span className="casting-review-val">{socialHandle}</span>
              {gender && <><span className="casting-review-key">Gender</span><span className="casting-review-val">{gender}</span></>}
              {ageRange && <><span className="casting-review-key">Age Range</span><span className="casting-review-val">{ageRange}</span></>}
              {shortNote && <><span className="casting-review-key">Note</span><span className="casting-review-val">{shortNote.slice(0, 200)}{shortNote.length > 200 ? "…" : ""}</span></>}
            </div>
          </div>

          <div className="casting-review-section">
            <h3 className="casting-review-heading">Policy</h3>
            <p className="casting-review-line casting-review-confirmed">All 6 policy items accepted (Policy v1.0)</p>
          </div>

          {globalError && <p className="casting-field-error casting-field-error--global">{globalError}</p>}

          <div className="casting-apply-actions">
            <button className="casting-btn casting-btn--ghost" onClick={() => goTo("policy")} disabled={submitting}>Back</button>
            <button className="casting-btn casting-btn--primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit Application"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
