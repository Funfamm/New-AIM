"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  toggleTemplateActive,
  duplicateTemplate,
  deleteTemplate,
  getTemplatePreview,
  resetTemplateToDefault,
} from "@/lib/actions/email-templates";
import { sendTemplateTestEmail } from "@/lib/actions/email-admin";

// Default-template names that support Reset to Premium Default
const HAS_DEFAULT = new Set([
  "PASSWORD_RESET", "WELCOME", "SECURITY_ALERT", "ADMIN_ALERT",
  "NEW_RELEASE", "NEW_EPISODE", "ANNOUNCEMENT", "NOTIFY_ME_FOLLOWUP", "ACCOUNT",
]);

type Props = {
  id:       string;
  name:     string;
  isActive: boolean;
  isSystem: boolean;
};

export default function TemplateListActions({ id, name, isActive, isSystem }: Props) {
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReset,  setConfirmReset]  = useState(false);
  const [msg,      setMsg]      = useState<string | null>(null);
  const [msgOk,    setMsgOk]    = useState(false);

  // Preview state
  const [previewOpen,    setPreviewOpen]    = useState(false);
  const [previewSubject, setPreviewSubject] = useState("");
  const [previewHtml,    setPreviewHtml]    = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  const router = useRouter();

  function flash(m: string, ok = false) {
    setMsg(m); setMsgOk(ok);
    setTimeout(() => setMsg(null), 4000);
  }

  // ── Toggle active ──
  function handleToggle() {
    startTransition(async () => {
      const r = await toggleTemplateActive(id, !isActive);
      if (r.error) flash(r.error); else router.refresh();
    });
  }

  // ── Duplicate ──
  function handleDuplicate() {
    startTransition(async () => {
      const r = await duplicateTemplate(id);
      if (r.error) { flash(r.error); return; }
      router.push(`/admin/email/templates/${r.id}`);
    });
  }

  // ── Delete ──
  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    startTransition(async () => {
      const r = await deleteTemplate(id);
      if (r.error) { flash(r.error); setConfirmDelete(false); return; }
      router.refresh();
    });
  }

  // ── Preview ──
  async function handlePreview() {
    setPreviewLoading(true);
    setPreviewOpen(true);
    const r = await getTemplatePreview(id);
    setPreviewLoading(false);
    if ("error" in r) { flash(r.error); setPreviewOpen(false); return; }
    setPreviewSubject(r.subject);
    setPreviewHtml(r.renderedHtml);
  }

  // ── Send Test ──
  function handleSendTest() {
    startTransition(async () => {
      const r = await sendTemplateTestEmail(id);
      flash(r.message, r.ok);
    });
  }

  // ── Reset to Default ──
  function handleReset() {
    if (!confirmReset) { setConfirmReset(true); return; }
    startTransition(async () => {
      const r = await resetTemplateToDefault(id);
      setConfirmReset(false);
      if (r.error) { flash(r.error); return; }
      flash("Template reset to premium default.", true);
      router.refresh();
    });
  }

  const canReset = HAS_DEFAULT.has(name);

  return (
    <>
      {/* ── Action row ── */}
      <span className="tmpl-actions">

        <Link href={`/admin/email/templates/${id}`} className="tmpl-action-btn">
          Edit
        </Link>

        <button className="tmpl-action-btn" onClick={handlePreview} disabled={pending || previewLoading}>
          {previewLoading ? "…" : "Preview"}
        </button>

        <button className="tmpl-action-btn tmpl-action-btn--test" onClick={handleSendTest} disabled={pending}>
          Send Test
        </button>

        {canReset && !confirmReset && (
          <button className="tmpl-action-btn tmpl-action-btn--reset" onClick={handleReset} disabled={pending}>
            Reset Default
          </button>
        )}
        {canReset && confirmReset && (
          <>
            <button className="tmpl-action-btn tmpl-action-btn--reset-confirm" onClick={handleReset} disabled={pending}>
              {pending ? "Resetting…" : "Confirm Reset"}
            </button>
            <button className="tmpl-action-btn" onClick={() => setConfirmReset(false)} disabled={pending}>
              Cancel
            </button>
          </>
        )}

        {!isSystem && (
          <button className="tmpl-action-btn" onClick={handleToggle} disabled={pending}>
            {isActive ? "Deactivate" : "Activate"}
          </button>
        )}

        <button className="tmpl-action-btn" onClick={handleDuplicate} disabled={pending}>
          Duplicate
        </button>

        {!isSystem && !confirmDelete && (
          <button className="tmpl-action-btn tmpl-action-btn--danger" onClick={handleDelete} disabled={pending}>
            Delete
          </button>
        )}
        {!isSystem && confirmDelete && (
          <>
            <button className="tmpl-action-btn tmpl-action-btn--danger" onClick={handleDelete} disabled={pending}>
              {pending ? "Deleting…" : "Confirm delete"}
            </button>
            <button className="tmpl-action-btn" onClick={() => setConfirmDelete(false)} disabled={pending}>
              Cancel
            </button>
          </>
        )}

      </span>

      {/* ── Inline message ── */}
      {msg && (
        <p className={msgOk ? "tmpl-msg tmpl-msg--ok" : "tmpl-msg tmpl-msg--err"}>{msg}</p>
      )}

      {/* ── Preview modal ── */}
      {previewOpen && (
        <div className="tmpl-modal-overlay" onClick={() => setPreviewOpen(false)}>
          <div className="tmpl-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tmpl-modal-header">
              <div>
                <p className="tmpl-modal-label">Preview</p>
                {previewSubject && (
                  <p className="tmpl-modal-subject">{previewSubject}</p>
                )}
              </div>
              <button className="tmpl-modal-close" onClick={() => setPreviewOpen(false)} aria-label="Close preview">
                ✕
              </button>
            </div>
            {previewLoading ? (
              <div className="tmpl-modal-loading">Loading preview…</div>
            ) : (
              <iframe
                sandbox=""
                srcDoc={previewHtml}
                title="Email template preview"
                className="tmpl-preview-frame"
              />
            )}
            <p className="tmpl-modal-note">
              Rendered with sample data. No emails were sent.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
