"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, X, Check, Instagram } from "lucide-react";
import "./work-cast-panel.css";

type CastMember = {
  id: string;
  name: string;
  jobTitle: string;
  character: string | null;
  bio: string | null;
  photoUrl: string | null;
  instagramUrl: string | null;
  sortOrder: number;
};

const EMPTY_FORM = {
  name: "",
  jobTitle: "",
  character: "",
  bio: "",
  photoUrl: "",
  instagramUrl: "",
  sortOrder: 0,
};

type Props = { workId: string };

export default function WorkCastPanel({ workId }: Props) {
  const [cast, setCast]       = useState<CastMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // null = list view; "new" = add form; string id = edit form
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm]           = useState(EMPTY_FORM);

  // Inline confirmation — avoids window.confirm() which blocks the main thread
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/cast?workId=${workId}`);
      if (!res.ok) throw new Error("Failed to load cast");
      setCast(await res.json());
    } catch { setError("Could not load cast members."); }
    finally { setLoading(false); }
  }, [workId]);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setForm({ ...EMPTY_FORM, sortOrder: cast.length });
    setEditingId("new");
    setError(null);
  }

  function openEdit(m: CastMember) {
    setForm({
      name:         m.name,
      jobTitle:     m.jobTitle,
      character:    m.character ?? "",
      bio:          m.bio ?? "",
      photoUrl:     m.photoUrl ?? "",
      instagramUrl: m.instagramUrl ?? "",
      sortOrder:    m.sortOrder,
    });
    setEditingId(m.id);
    setError(null);
  }

  function cancel() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  }

  async function save() {
    if (!form.name.trim() || !form.jobTitle.trim()) {
      setError("Name and job title are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        workId,
        name:         form.name.trim(),
        jobTitle:     form.jobTitle.trim(),
        character:    form.character.trim() || null,
        bio:          form.bio.trim() || null,
        photoUrl:     form.photoUrl.trim() || null,
        instagramUrl: form.instagramUrl.trim() || null,
        sortOrder:    Number(form.sortOrder) || 0,
      };

      const res = editingId === "new"
        ? await fetch("/api/admin/cast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch(`/api/admin/cast/${editingId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Save failed");
      }
      await load();
      cancel();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally { setSaving(false); }
  }

  async function remove(id: string) {
    // Optimistic: remove immediately so the UI paints before the network round-trip
    const removed = cast.find(m => m.id === id);
    setCast(prev => prev.filter(m => m.id !== id));
    setConfirmDeleteId(null);

    try {
      const res = await fetch(`/api/admin/cast/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    } catch {
      // Revert: put the item back in sort order
      if (removed) {
        setCast(prev =>
          [...prev, removed].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
        );
      }
      setError("Could not delete cast member.");
    }
  }

  const field = (key: keyof typeof EMPTY_FORM) => ({
    value: form[key] as string | number,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value })),
  });

  return (
    <div className="wcp">
      <div className="wcp-header">
        <h2 className="wcp-title">
          Cast &amp; Crew
          {cast.length > 0 && <span className="wcp-count">{cast.length}</span>}
        </h2>
        {editingId === null && (
          <button type="button" className="wcp-add-btn" onClick={openNew}>
            <Plus size={13} /> Add Member
          </button>
        )}
      </div>

      {error && <p className="wcp-error">{error}</p>}

      {/* ── Add / Edit form ── */}
      {editingId !== null && (
        <div className="wcp-form">
          <div className="wcp-form-title">
            {editingId === "new" ? "New Cast Member" : "Edit Cast Member"}
          </div>
          <div className="wcp-form-grid">
            <label className="wcp-label">
              Name <span className="wcp-req">*</span>
              <input className="wcp-input" placeholder="Full name" {...field("name")} />
            </label>
            <label className="wcp-label">
              Job Title <span className="wcp-req">*</span>
              <input className="wcp-input" placeholder="Actor / Director / Producer…" {...field("jobTitle")} />
            </label>
            <label className="wcp-label">
              Character
              <input className="wcp-input" placeholder="Character name (optional)" {...field("character")} />
            </label>
            <label className="wcp-label">
              Photo URL
              <input className="wcp-input" placeholder="https://…" type="url" {...field("photoUrl")} />
            </label>
            <label className="wcp-label">
              Instagram URL
              <input className="wcp-input" placeholder="https://instagram.com/…" type="url" {...field("instagramUrl")} />
            </label>
            <label className="wcp-label">
              Sort Order
              <input className="wcp-input wcp-input--sm" type="number" min={0} {...field("sortOrder")} />
            </label>
          </div>
          <label className="wcp-label">
            Bio
            <textarea
              className="wcp-textarea"
              placeholder="Short bio (optional, max 4000 chars)"
              rows={3}
              maxLength={4000}
              {...field("bio")}
            />
          </label>
          <div className="wcp-form-actions">
            <button type="button" className="wcp-save-btn" onClick={save} disabled={saving}>
              <Check size={13} /> {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" className="wcp-cancel-btn" onClick={cancel} disabled={saving}>
              <X size={13} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Cast list ── */}
      {loading ? (
        <p className="wcp-empty">Loading…</p>
      ) : cast.length === 0 && editingId === null ? (
        <p className="wcp-empty">No cast members yet.</p>
      ) : (
        editingId === null && (
          <ul className="wcp-list">
            {cast.map(m => (
              <li key={m.id} className="wcp-member">
                <div className="wcp-member-photo" aria-hidden="true">
                  {m.photoUrl
                    ? <img src={m.photoUrl} alt={m.name} className="wcp-member-img" />
                    : <span className="wcp-member-initials">{m.name.charAt(0).toUpperCase()}</span>
                  }
                </div>
                <div className="wcp-member-info">
                  <span className="wcp-member-name">{m.name}</span>
                  <span className="wcp-member-role">{m.jobTitle}{m.character ? ` · ${m.character}` : ""}</span>
                </div>
                {m.instagramUrl && (
                  <a href={m.instagramUrl} target="_blank" rel="noopener noreferrer" className="wcp-ig-link" title="Instagram">
                    <Instagram size={12} />
                  </a>
                )}
                <div className="wcp-member-actions">
                  {confirmDeleteId === m.id ? (
                    <>
                      <button type="button" className="wcp-action-btn wcp-action-btn--danger" onClick={() => remove(m.id)} title="Confirm delete">
                        <Check size={12} />
                      </button>
                      <button type="button" className="wcp-action-btn" onClick={() => setConfirmDeleteId(null)} title="Cancel">
                        <X size={12} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="wcp-action-btn" onClick={() => openEdit(m)} title="Edit">
                        <Pencil size={12} />
                      </button>
                      <button type="button" className="wcp-action-btn wcp-action-btn--danger" onClick={() => setConfirmDeleteId(m.id)} title="Delete">
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
