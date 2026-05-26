"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface Props {
  name: string;
  placeholder?: string;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
}

export function PasswordInput({
  name,
  placeholder = "••••••••",
  autoComplete,
  minLength,
  required,
}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="pw-field">
      <input
        type={visible ? "text" : "password"}
        name={name}
        className="form-input pw-field-input"
        placeholder={placeholder}
        autoComplete={autoComplete}
        minLength={minLength}
        required={required}
      />
      <button
        type="button"
        className="pw-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
