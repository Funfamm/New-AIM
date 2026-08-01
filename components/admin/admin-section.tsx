"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import "./admin-section.css";

interface Props {
  title: string;
  icon?: string;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  lazy?: boolean;
  children: React.ReactNode;
}

export default function AdminSection({
  title,
  icon,
  badge,
  defaultOpen = false,
  lazy = false,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [everOpened, setEverOpened] = useState(defaultOpen);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) setEverOpened(true);
  }

  const shouldRender = lazy ? everOpened : true;

  return (
    <div className={`adm-sec ${open ? "adm-sec--open" : ""}`}>
      <button
        type="button"
        className="adm-sec-hdr"
        onClick={toggle}
        aria-expanded={open}
      >
        <span className="adm-sec-ttl">
          {icon && <span className="adm-sec-ico">{icon}</span>}
          {title}
          {badge != null && <span className="adm-sec-badge">{badge}</span>}
        </span>
        <ChevronDown
          size={14}
          className={`adm-sec-chevron ${open ? "adm-sec-chevron--open" : ""}`}
        />
      </button>
      {shouldRender && (
        <div
          className="adm-sec-body"
          style={open ? undefined : { display: "none" }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
