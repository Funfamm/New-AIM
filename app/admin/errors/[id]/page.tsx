import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { setErrorStatus, muteError, assignError, addErrorNote, deleteError } from "../error-actions";
import { CopyButton } from "../copy-button";
import { Sparkline } from "../sparkline";
import { formatReport, fmtAbs, timeAgo } from "../format";
import { series, HOUR_MS, DAY_MS } from "@/lib/monitoring/buckets";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, RotateCcw, Trash2, EyeOff, BellOff, UserPlus, X } from "lucide-react";
import type { Metadata } from "next";
import "../errors-admin.css";

export const metadata: Metadata = { title: "Error detail — Admin" };
export const dynamic = "force-dynamic";

export default async function ErrorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const e = await prisma.errorLog.findUnique({
    where: { id },
    include: { notes: { orderBy: { createdAt: "desc" }, take: 50 } },
  }).catch(() => null);
  if (!e) notFound();

  const [day, week] = await Promise.all([
    series(e.fingerprint, 24, HOUR_MS),
    series(e.fingerprint, 7, DAY_MS),
  ]);

  const lvl = e.level.toLowerCase();
  const st  = e.status.toLowerCase();

  return (
    <main className="errmon errmon-detail">
      <Link href="/admin/errors" className="errmon-back"><ArrowLeft size={15} /> Back to errors</Link>

      <header className="errmon-d-head">
        <div className="errmon-d-badges">
          <span className={`errmon-badge errmon-badge--${lvl}`}>{e.level}</span>
          <span className={`errmon-status errmon-status--${st}`}>{e.status}</span>
          <span className="errmon-source">{e.source}</span>
          {e.environment && <span className="errmon-tagchip">{e.environment}</span>}
          {e.regressed && <span className="errmon-regressed">REGRESSED</span>}
          {e.status === "MUTED" && e.mutedUntil && <span className="errmon-tagchip">muted until {fmtAbs(new Date(e.mutedUntil))}</span>}
        </div>
        <h1 className="errmon-d-message">{e.message}</h1>
        {e.route && <p className="errmon-route">{e.method ? `${e.method} ` : ""}{e.route}</p>}
      </header>

      {/* Triage toolbar */}
      <div className="errmon-d-triage">
        <div className="errmon-d-triage-group">
          <form action={setErrorStatus}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value="ACKNOWLEDGED" />
            <button className="errmon-d-btn" disabled={e.status === "ACKNOWLEDGED"}><Check size={14} /> Acknowledge</button>
          </form>
          {e.status === "RESOLVED" ? (
            <form action={setErrorStatus}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value="NEW" />
              <button className="errmon-d-btn"><RotateCcw size={14} /> Reopen</button>
            </form>
          ) : (
            <form action={setErrorStatus}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value="RESOLVED" />
              <button className="errmon-d-btn errmon-d-btn--resolve"><Check size={14} /> Resolve</button>
            </form>
          )}
          <form action={setErrorStatus}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value="IGNORED" />
            <button className="errmon-d-btn" disabled={e.status === "IGNORED"}><EyeOff size={14} /> Ignore</button>
          </form>
          <form action={muteError} className="errmon-d-mute"><input type="hidden" name="id" value={e.id} />
            <BellOff size={14} />
            <select name="hours" className="errmon-select" defaultValue="24" aria-label="Mute duration">
              <option value="1">1h</option>
              <option value="24">24h</option>
              <option value="168">7d</option>
              <option value="720">30d</option>
            </select>
            <button className="errmon-d-btn">Mute</button>
          </form>
        </div>
        <div className="errmon-d-triage-group">
          {e.assignedToEmail ? (
            <form action={assignError} className="errmon-d-assign"><input type="hidden" name="id" value={e.id} /><input type="hidden" name="action" value="unassign" />
              <span className="errmon-d-assignee">Assigned to {e.assignedToEmail}</span>
              <button className="errmon-d-btn" title="Unassign"><X size={14} /></button>
            </form>
          ) : (
            <form action={assignError}><input type="hidden" name="id" value={e.id} />
              <button className="errmon-d-btn"><UserPlus size={14} /> Assign to me</button>
            </form>
          )}
          <CopyButton text={formatReport(e)} label="Copy report" title="Copy full error report" />
          <form action={deleteError}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="from" value="detail" />
            <button className="errmon-d-btn errmon-d-btn--delete"><Trash2 size={14} /> Delete</button>
          </form>
        </div>
      </div>

      <div className="errmon-d-stats">
        <div className="errmon-d-stat"><span className="errmon-d-stat-num">{e.count}</span><span className="errmon-d-stat-lbl">Occurrences</span></div>
        <div className="errmon-d-stat"><span className="errmon-d-stat-num">{timeAgo(new Date(e.firstSeenAt))}</span><span className="errmon-d-stat-lbl" title={fmtAbs(new Date(e.firstSeenAt))}>First seen</span></div>
        <div className="errmon-d-stat"><span className="errmon-d-stat-num">{timeAgo(new Date(e.lastSeenAt))}</span><span className="errmon-d-stat-lbl" title={fmtAbs(new Date(e.lastSeenAt))}>Last seen</span></div>
        <div className="errmon-d-stat"><span className="errmon-d-stat-num errmon-d-stat-mono">{e.lastRelease ?? "—"}</span><span className="errmon-d-stat-lbl">Last release{e.firstRelease && e.firstRelease !== e.lastRelease ? ` (first ${e.firstRelease})` : ""}</span></div>
      </div>

      <section className="errmon-d-charts">
        <div className="errmon-d-chart">
          <div className="errmon-d-chart-head"><span>Last 24 hours</span><span className="errmon-fp">hourly</span></div>
          <Sparkline points={day} width={520} height={56} />
        </div>
        <div className="errmon-d-chart">
          <div className="errmon-d-chart-head"><span>Last 7 days</span><span className="errmon-fp">daily</span></div>
          <Sparkline points={week} width={520} height={56} />
        </div>
      </section>

      {e.stack && (
        <section className="errmon-d-block">
          <h2 className="errmon-d-block-title">Stack trace</h2>
          <pre className="errmon-stack">{e.stack}</pre>
        </section>
      )}

      {e.metadata != null && (
        <section className="errmon-d-block">
          <h2 className="errmon-d-block-title">Context</h2>
          <pre className="errmon-stack">{JSON.stringify(e.metadata, null, 2)}</pre>
        </section>
      )}

      {/* Notes / triage activity */}
      <section className="errmon-d-block">
        <h2 className="errmon-d-block-title">Notes</h2>
        <form action={addErrorNote} className="errmon-note-form"><input type="hidden" name="id" value={e.id} />
          <textarea name="body" className="errmon-textarea" rows={2} placeholder="Add a triage note…" maxLength={2000} required />
          <button className="errmon-d-btn">Add note</button>
        </form>
        {e.notes.length > 0 ? (
          <ul className="errmon-notes">
            {e.notes.map((n) => (
              <li key={n.id} className="errmon-note">
                <div className="errmon-note-head">
                  <span className="errmon-note-author">{n.authorEmail || "admin"}</span>
                  <span className="errmon-note-time" title={fmtAbs(new Date(n.createdAt))}>{timeAgo(new Date(n.createdAt))}</span>
                </div>
                <p className="errmon-note-body">{n.body}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="errmon-note-empty">No notes yet.</p>
        )}
      </section>

      <p className="errmon-fp errmon-d-fp">Fingerprint: {e.fingerprint}</p>
    </main>
  );
}
