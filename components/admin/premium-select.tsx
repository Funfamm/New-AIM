"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  name: string;
  defaultValue?: string;
  options: SelectOption[];
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function PremiumSelect({
  name, defaultValue = "", options, onChange, placeholder = "All", className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(defaultValue);
  const containerRef = useRef<HTMLDivElement>(null);
  const hiddenRef    = useRef<HTMLInputElement>(null);

  // Sync internal state when the parent changes the filter (e.g. clear filters)
  useEffect(() => { setSelected(defaultValue); }, [defaultValue]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [open]);

  const selectedLabel =
    selected === ""
      ? placeholder
      : (options.find((o) => o.value === selected)?.label ?? placeholder);

  function pick(value: string) {
    // Sync DOM immediately so requestSubmit() picks up the new value
    if (hiddenRef.current) hiddenRef.current.value = value;
    setSelected(value);
    setOpen(false);
    onChange?.(value);
  }

  return (
    <div ref={containerRef} className={`psel ${className}`}>
      {/* Hidden input carries the value into form submissions */}
      <input ref={hiddenRef} type="hidden" name={name} defaultValue={defaultValue} />

      <button
        type="button"
        className="psel-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="psel-label">{selectedLabel}</span>
        <ChevronDown
          size={12}
          className={`psel-arrow${open ? " psel-arrow--open" : ""}`}
        />
      </button>

      {open && (
        <div className="psel-panel" role="listbox">
          <button
            type="button"
            role="option"
            aria-selected={selected === ""}
            className={`psel-option${selected === "" ? " psel-option--active" : ""}`}
            onClick={() => pick("")}
          >
            {placeholder}
          </button>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={selected === o.value}
              className={`psel-option${selected === o.value ? " psel-option--active" : ""}`}
              onClick={() => pick(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
