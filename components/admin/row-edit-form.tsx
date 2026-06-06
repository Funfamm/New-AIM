"use client";

import { updateRow, getRowById } from "@/lib/actions/rows";
import { useFormState } from "react-dom";

type RowData = Awaited<ReturnType<typeof getRowById>>;

export default function RowEditForm({ row }: { row: RowData | null }) {
  if (!row) return null;

  const [state, formAction] = useFormState(
    (_prev: { ok: boolean; error?: string } | null, formData: FormData) => updateRow(row.id, _prev, formData),
    null
  );

  return (
    <form action={formAction} className="edit-form">
      <div className="form-group">
        <label className="form-label">Title *</label>
        <input
          type="text"
          name="title"
          defaultValue={row.title}
          className="form-input"
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label">Slug</label>
        <input
          type="text"
          name="slug"
          defaultValue={row.slug}
          className="form-input"
          disabled
          title="Slug is auto-generated and immutable"
        />
        <span className="form-hint">Auto-generated from title</span>
      </div>

      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea
          name="description"
          defaultValue={row.description ?? ""}
          className="form-textarea"
          rows={2}
          placeholder="Optional subtitle or description"
        />
      </div>

      <div className="form-group">
        <label className="form-label">Placement</label>
        <select name="placement" className="form-input" defaultValue={row.placement}>
          <option value="HOME">Homepage only</option>
          <option value="WORKS">Works page only</option>
          <option value="BOTH">Both pages</option>
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Sort Order</label>
        <input
          type="number"
          name="sortOrder"
          defaultValue={row.sortOrder}
          className="form-input"
        />
        <span className="form-hint">Lower numbers appear first</span>
      </div>

      <div className="form-group">
        <label className="form-checkbox">
          <input
            type="checkbox"
            name="active"
            defaultChecked={row.active}
            value="1"
          />
          <span>Active</span>
        </label>
      </div>

      {state?.error && (
        <div className="form-error">{state.error}</div>
      )}

      {state?.ok && (
        <div className="form-success">Row updated successfully</div>
      )}

      <button type="submit" className="btn btn-primary">
        Save Changes
      </button>
    </form>
  );
}
