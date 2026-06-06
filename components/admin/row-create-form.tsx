"use client";

import { useState } from "react";
import { createRow } from "@/lib/actions/rows";
import { useFormState } from "react-dom";

export default function RowCreateForm() {
  const [state, formAction] = useFormState(createRow, null);
  const [title, setTitle] = useState("");

  const handleReset = () => {
    setTitle("");
  };

  return (
    <form action={formAction} className="quick-create-form" onSubmit={() => {
      if (state?.ok) handleReset();
    }}>
      <div className="form-group">
        <label className="form-label">Row Title</label>
        <input
          type="text"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Featured Works, New Releases"
          className="form-input"
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label">Placement</label>
        <select name="placement" className="form-input" defaultValue="HOME">
          <option value="HOME">Homepage only</option>
          <option value="WORKS">Works page only</option>
          <option value="BOTH">Both pages</option>
        </select>
      </div>

      {state?.error && (
        <div className="form-error">{state.error}</div>
      )}

      <button type="submit" className="btn btn-primary">
        Create Row
      </button>
    </form>
  );
}
