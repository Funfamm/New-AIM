"use client";

import { useState, useTransition } from "react";
import { previewTestEmail, sendTestEmailByType } from "@/lib/actions/email-admin";

type Work = { id: string; title: string; type: string; slug: string };

type PreviewResult = {
  subject:              string;
  html:                 string;
  ctaLabel?:            string;
  ctaUrl?:              string;
  recipientType:        string;
  estimatedRecipients?: number;
};

// Email types that require a work to be selected
const NEEDS_WORK = new Set(["NEW_RELEASE", "NEW_EPISODE", "NOTIFY_ME_FOLLOWUP"]);

const ALL_TYPES = [
  { value: "PASSWORD_RESET",            label: "Password Reset" },
  { value: "WELCOME",                   label: "Welcome" },
  { value: "SECURITY_ALERT",            label: "Security Alert" },
  { value: "ACCOUNT",                   label: "Account Update" },
  { value: "ADMIN_ALERT",               label: "Admin Alert" },
  { value: "NEW_RELEASE",               label: "New Release" },
  { value: "NEW_EPISODE",               label: "New Episode" },
  { value: "ANNOUNCEMENT",              label: "Announcement" },
  { value: "NOTIFY_ME_FOLLOWUP",        label: "Notify Me / Coming Soon" },
  { value: "CASTING_RECEIVED",          label: "Casting — Received" },
  { value: "CASTING_REQUIREMENTS_NOT_MET", label: "Casting — Requirements Not Met" },
  { value: "CASTING_READY_FOR_REVIEW",  label: "Casting — Ready for Review" },
  { value: "CASTING_SHORTLISTED",       label: "Casting — Shortlisted" },
  { value: "CASTING_CONTACTED",         label: "Casting — Contacted" },
  { value: "CASTING_SELECTED",          label: "Casting — Selected" },
  { value: "CASTING_NOT_SELECTED",      label: "Casting — Not Selected" },
  { value: "CASTING_WITHDRAWN",         label: "Casting — Withdrawn" },
];

const INPUT_STYLE = {
  width: "100%",
  background: "#0d0d0d",
  border: "1px solid #2a2a2a",
  borderRadius: 4,
  color: "#e5e7eb",
  fontFamily: "var(--font-body)",
  fontSize: "0.875rem",
  padding: "0.6rem 0.85rem",
  outline: "none",
  boxSizing: "border-box" as const,
};

const SELECT_STYLE = { ...INPUT_STYLE };

const LABEL_STYLE = {
  display: "block" as const,
  fontFamily: "var(--font-body)",
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase" as const,
  color: "rgba(107,114,128,0.75)",
  marginBottom: "0.5rem",
};

export default function TestEmailForm({
  works,
  adminEmail,
  testEmailRecipient,
}: {
  works:              Work[];
  adminEmail:         string;
  testEmailRecipient: string;
}) {
  const [emailType, setEmailType]   = useState("PASSWORD_RESET");
  const [workId,    setWorkId]      = useState("");
  const [recipient, setRecipient]   = useState(testEmailRecipient || adminEmail);
  const [preview,   setPreview]     = useState<PreviewResult | null>(null);
  const [previewErr, setPreviewErr] = useState("");
  const [sendResult, setSendResult] = useState("");
  const [sendErr,    setSendErr]    = useState("");

  const [previewing, startPreview] = useTransition();
  const [sending,    startSend]    = useTransition();

  const needsWork   = NEEDS_WORK.has(emailType);
  const episodeMode = emailType === "NEW_EPISODE";
  const worksForType = episodeMode
    ? works.filter((w) => w.type === "EPISODE")
    : works.filter((w) => w.type !== "EPISODE");

  function handleTypeChange(v: string) {
    setEmailType(v);
    setWorkId("");
    setPreview(null);
    setPreviewErr("");
    setSendResult("");
    setSendErr("");
  }

  function handlePreview() {
    setPreview(null);
    setPreviewErr("");
    setSendResult("");
    setSendErr("");
    startPreview(async () => {
      const res = await previewTestEmail({ type: emailType, workId: workId || undefined });
      if (res.ok) {
        setPreview(res);
      } else {
        setPreviewErr(res.error);
      }
    });
  }

  function handleSend() {
    if (!preview) return;
    setSendResult("");
    setSendErr("");
    startSend(async () => {
      const fd = new FormData();
      fd.set("type",   emailType);
      fd.set("to",     recipient);
      if (workId) fd.set("workId", workId);
      const res = await sendTestEmailByType(fd);
      if (res.ok) {
        setSendResult(res.message);
      } else {
        setSendErr(res.message);
      }
    });
  }

  return (
    <div>
      {/* ── Form ────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "1.25rem", marginBottom: "1.5rem" }}>

        {/* Email type */}
        <div>
          <label style={LABEL_STYLE}>Email type</label>
          <select
            value={emailType}
            onChange={(e) => handleTypeChange(e.target.value)}
            style={SELECT_STYLE}
          >
            {ALL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Work selector */}
        {needsWork && (
          <div>
            <label style={LABEL_STYLE}>
              {episodeMode ? "Episode" : "Work"}
            </label>
            {worksForType.length === 0 ? (
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#6b7280" }}>
                No {episodeMode ? "episodes" : "works"} found.
              </p>
            ) : (
              <select
                value={workId}
                onChange={(e) => setWorkId(e.target.value)}
                style={SELECT_STYLE}
              >
                <option value="">— select —</option>
                {worksForType.map((w) => (
                  <option key={w.id} value={w.id}>{w.title}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Test recipient */}
        <div>
          <label style={LABEL_STYLE}>Send test to</label>
          <input
            type="email"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder={adminEmail}
            style={INPUT_STYLE}
          />
          <p style={{ margin: "0.35rem 0 0", fontSize: "0.72rem", color: "#4b5563" }}>
            Only this address will receive the test.
          </p>
        </div>
      </div>

      {/* ── Actions ─────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        <button
          onClick={handlePreview}
          disabled={previewing || (needsWork && !workId)}
          style={{
            background: "rgba(232,201,126,0.12)",
            border: "1px solid rgba(232,201,126,0.35)",
            color: "#e8c97e",
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            fontWeight: 600,
            padding: "0.55rem 1.2rem",
            borderRadius: 3,
            cursor: (previewing || (needsWork && !workId)) ? "not-allowed" : "pointer",
            opacity: (previewing || (needsWork && !workId)) ? 0.5 : 1,
          }}
        >
          {previewing ? "Loading preview…" : "Preview Email"}
        </button>

        {preview && (
          <button
            onClick={handleSend}
            disabled={sending || !recipient}
            style={{
              background: "#e8c97e",
              border: "none",
              color: "#0a0a0a",
              fontFamily: "var(--font-body)",
              fontSize: "0.8125rem",
              fontWeight: 700,
              padding: "0.55rem 1.2rem",
              borderRadius: 3,
              cursor: (sending || !recipient) ? "not-allowed" : "pointer",
              opacity: (sending || !recipient) ? 0.5 : 1,
            }}
          >
            {sending ? "Sending…" : "Send Test Email"}
          </button>
        )}
      </div>

      {/* Errors */}
      {previewErr && (
        <p style={{ margin: "0 0 1.25rem", fontSize: "0.8125rem", color: "#f87171", padding: "0.5rem 0.75rem", background: "rgba(248,113,113,0.08)", borderRadius: 3 }}>
          ⚠ {previewErr}
        </p>
      )}
      {sendErr && (
        <p style={{ margin: "0 0 1.25rem", fontSize: "0.8125rem", color: "#f87171", padding: "0.5rem 0.75rem", background: "rgba(248,113,113,0.08)", borderRadius: 3 }}>
          ⚠ {sendErr}
        </p>
      )}
      {sendResult && (
        <p style={{ margin: "0 0 1.25rem", fontSize: "0.8125rem", color: "#4ade80", padding: "0.5rem 0.75rem", background: "rgba(74,222,128,0.08)", borderRadius: 3 }}>
          ✓ {sendResult}
        </p>
      )}

      {/* ── Preview panel ────────────────────────────────────── */}
      {preview && (
        <div style={{ border: "1px solid #2a2a2a", borderRadius: 6 }}>

          {/* Meta strip */}
          <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #1e1e1e", display: "flex", flexWrap: "wrap", gap: "1.5rem" }}>
            <div>
              <p style={{ margin: "0 0 2px", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6b7280" }}>Subject</p>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "#e5e7eb", fontWeight: 500 }}>{preview.subject}</p>
            </div>
            <div>
              <p style={{ margin: "0 0 2px", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6b7280" }}>Recipient type</p>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "#e5e7eb" }}>{preview.recipientType}</p>
            </div>
            {preview.estimatedRecipients !== undefined && (
              <div>
                <p style={{ margin: "0 0 2px", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6b7280" }}>Est. recipients</p>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "#e8c97e", fontWeight: 600 }}>
                  {preview.estimatedRecipients.toLocaleString()}
                </p>
              </div>
            )}
            {preview.ctaLabel && (
              <div>
                <p style={{ margin: "0 0 2px", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6b7280" }}>CTA</p>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "#e5e7eb" }}>
                  <span style={{ color: "#e8c97e", fontWeight: 600 }}>{preview.ctaLabel}</span>
                  {preview.ctaUrl && (
                    <span style={{ color: "#4b5563", fontSize: "0.78rem", marginLeft: "0.5rem" }}>→ {preview.ctaUrl}</span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Email iframe preview */}
          <div style={{ padding: "1rem 1.25rem", background: "#0a0a0a" }}>
            <p style={{ margin: "0 0 0.75rem", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4b5563" }}>
              Email body preview
            </p>
            <iframe
              srcDoc={preview.html}
              sandbox="allow-same-origin"
              title="Email preview"
              style={{ width: "100%", height: 620, border: "none", borderRadius: 4, display: "block" }}
            />
          </div>

        </div>
      )}
    </div>
  );
}
