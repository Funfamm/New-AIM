"use client";

import { useState } from "react";
import { createRow } from "@/lib/actions/rows";
import { useFormState } from "react-dom";
import { Plus } from "lucide-react";

export default function RowCreateForm() {
  const [state, formAction] = useFormState(createRow, null);

  return (
    <form action={formAction} className="quick-create-form">
      <div className="form-group">
        <label className="form-label">Title</label>
        <input
          type="text"
          name="title"
          className="form-input"
          placeholder="e.g. Featured Works, New Releases"
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label">Placement</label>
        <select name="placement" className="form-input form-select" defaultValue="HOME">
          <option value="HOME">Homepage only</option>
          <option value="WORKS">Works page only</option>
          <option value="BOTH">Both pages</option>
        </select>
      </div>

      <div className="form-group" style={{ justifyContent: "flex-end" }}>
        <label className="form-label" style={{ opacity: 0 }}>.</label>
        <button type="submit" className="btn-primary">
          <Plus size={14} />
          Create
        </button>
      </div>

      {state?.error && (
        <div className="form-error" style={{ gridColumn: "1 / -1" }}>{state.error}</div>
      )}
    </form>
  );
}
