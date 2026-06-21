import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { resolveError, reopenError, deleteError } from "../error-actions";
import { CopyButton } from "../copy-button";
import { Sparkline } from "../sparkline";
import { formatReport, fmtAbs, timeAgo } from "../format";
import { series, HOUR_MS, DAY_MS } from "@/lib/monitoring/buckets";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, RotateCcw, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import "../errors-admin.css";

export const metadata: Metadata = { title: "Error detail — Admin" };
export const dynamic = "force-dynamic";

export default async function ErrorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const e = await prisma.errorLog.findUnique({ where: { id } }).catch(() => null);
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
        </div>
        <h1 className="errmon-d-message">{e.message}</h1>
        {e.route && <p className="errmon-route">{e.method ? `${e.method} ` : ""}{e.route}</p>}
      </header>

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

      <div className="errmon-d-actions">
        <CopyButton text={formatReport(e)} label="Copy report" title="Copy full error report" />
        {e.resolved ? (
          <form action={reopenError}><input type="hidden" name="id" value={e.id} />
            <button className="errmon-d-btn"><RotateCcw size={14} /> Reopen</button>
          </form>
        ) : (
          <form action={resolveError}><input type="hidden" name="id" value={e.id} />
            <button className="errmon-d-btn errmon-d-btn--resolve"><Check size={14} /> Mark resolved</button>
          </form>
        )}
        <form action={deleteError}><input type="hidden" name="id" value={e.id} />
          <button className="errmon-d-btn errmon-d-btn--delete"><Trash2 size={14} /> Delete</button>
        </form>
      </div>

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

      <p className="errmon-fp errmon-d-fp">Fingerprint: {e.fingerprint}</p>
    </main>
  );
}
