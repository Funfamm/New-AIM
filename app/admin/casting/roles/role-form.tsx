"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminCreateRole, adminUpdateRole } from "@/lib/actions/casting";
import type { RoleInput } from "@/lib/actions/casting";
import type { CastingRole } from "@prisma/client";

export default function RoleForm({ existing }: { existing?: CastingRole }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title,              setTitle]              = useState(existing?.title        ?? "");
  const [slug,               setSlug]               = useState(existing?.slug         ?? "");
  const [description,        setDescription]        = useState(existing?.description  ?? "");
  const [isOpen,             setIsOpen]             = useState(existing?.isOpen       ?? true);
  const [requireGender,      setRequireGender]      = useState(existing?.requireGender ?? false);
  const [allowedGender,      setAllowedGender]      = useState(existing?.allowedGender ?? "");
  const [requireAgeRange,    setRequireAgeRange]    = useState(existing?.requireAgeRange ?? false);
  const [minAge,             setMinAge]             = useState<string>(existing?.minAge != null ? String(existing.minAge) : "");
  const [maxAge,             setMaxAge]             = useState<string>(existing?.maxAge != null ? String(existing.maxAge) : "");
  const [requireVoiceSample, setRequireVoiceSample] = useState(existing?.requireVoiceSample ?? false);
  const [minAgentScore,      setMinAgentScore]      = useState<string>(existing?.minAgentScore != null ? String(existing.minAgentScore) : "70");
  const [sortOrder,          setSortOrder]          = useState<string>(existing?.sortOrder != null ? String(existing.sortOrder) : "0");

  function autoSlug(t: string) {
    return t.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60);
  }

  function handleTitleChange(v: string) {
    setTitle(v);
    if (!existing) setSlug(autoSlug(v));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const input: RoleInput = {
      slug,
      title,
      description,
      isOpen,
      requireGender,
      allowedGender: allowedGender || undefined,
      requireAgeRange,
      minAge:             minAge ? parseInt(minAge, 10) : undefined,
      maxAge:             maxAge ? parseInt(maxAge, 10) : undefined,
      requireVoiceSample,
      minAgentScore:      parseInt(minAgentScore, 10) || 70,
      sortOrder:          parseInt(sortOrder, 10) || 0,
    };

    startTransition(async () => {
      const result = existing
        ? await adminUpdateRole(existing.id, input)
        : await adminCreateRole(input);

      if (result.ok) {
        router.push("/admin/casting/roles");
        router.refresh();
      } else {
        setError(result.error ?? "Save failed.");
      }
    });
  }

  return (
    <form className="ca-role-form" onSubmit={handleSubmit}>
      <div className="ca-form-grid">

        <div className="ca-field">
          <label className="ca-label">Title <span className="ca-req-star">*</span></label>
          <input className="ca-input" type="text" value={title} onChange={(e) => handleTitleChange(e.target.value)} required />
        </div>

        <div className="ca-field">
          <label className="ca-label">Slug <span className="ca-req-star">*</span></label>
          <input className="ca-input ca-input--mono" type="text" value={slug} onChange={(e) => setSlug(e.target.value)} required />
          <p className="ca-field-hint">URL: /casting/{slug || "…"}</p>
        </div>

        <div className="ca-field ca-field--full">
          <label className="ca-label">Description <span className="ca-req-star">*</span></label>
          <textarea className="ca-textarea" value={description} onChange={(e) => setDescription(e.target.value)} rows={5} required />
        </div>

        <div className="ca-field">
          <label className="ca-label">Min Agent Score (0–100)</label>
          <input className="ca-input" type="number" min={0} max={100} value={minAgentScore} onChange={(e) => setMinAgentScore(e.target.value)} />
          <p className="ca-field-hint">Applications below this score go to REQUIREMENTS_NOT_MET</p>
        </div>

        <div className="ca-field">
          <label className="ca-label">Sort Order</label>
          <input className="ca-input" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </div>

        {/* Toggles */}
        <div className="ca-field ca-field--full">
          <div className="ca-toggle-group">

            <label className="ca-toggle-label">
              <input type="checkbox" checked={isOpen} onChange={(e) => setIsOpen(e.target.checked)} />
              <span>Open for Applications</span>
            </label>

            <label className="ca-toggle-label">
              <input type="checkbox" checked={requireVoiceSample} onChange={(e) => setRequireVoiceSample(e.target.checked)} />
              <span>Require Voice Sample</span>
            </label>

            <label className="ca-toggle-label">
              <input type="checkbox" checked={requireGender} onChange={(e) => setRequireGender(e.target.checked)} />
              <span>Require Gender</span>
            </label>

            {requireGender && (
              <div className="ca-field ca-field--inline">
                <label className="ca-label">Allowed Gender</label>
                <input className="ca-input" type="text" value={allowedGender} onChange={(e) => setAllowedGender(e.target.value)} placeholder="e.g. Female, Male, Any" />
              </div>
            )}

            <label className="ca-toggle-label">
              <input type="checkbox" checked={requireAgeRange} onChange={(e) => setRequireAgeRange(e.target.checked)} />
              <span>Require Age Range</span>
            </label>

            {requireAgeRange && (
              <div className="ca-field-row">
                <div className="ca-field">
                  <label className="ca-label">Min Age</label>
                  <input className="ca-input ca-input--sm" type="number" min={18} value={minAge} onChange={(e) => setMinAge(e.target.value)} />
                </div>
                <div className="ca-field">
                  <label className="ca-label">Max Age</label>
                  <input className="ca-input ca-input--sm" type="number" value={maxAge} onChange={(e) => setMaxAge(e.target.value)} />
                </div>
              </div>
            )}

          </div>
        </div>

      </div>

      {error && <p className="ca-field-error ca-field-error--banner">{error}</p>}

      <div className="ca-form-actions">
        <button type="button" className="ca-btn ca-btn--ghost" onClick={() => router.back()}>Cancel</button>
        <button type="submit" className="ca-btn ca-btn--primary" disabled={isPending}>
          {isPending ? "Saving…" : existing ? "Save Changes" : "Create Role"}
        </button>
      </div>
    </form>
  );
}
