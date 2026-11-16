import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import Link from "next/link";
import { ClipboardList, ExternalLink, Plus, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import {
  COLOR_KEYS, DEFAULT_RATES, RATE_LABELS, estimate, money, normalizeRates, optLabel, question,
  sanitizeAnswers, summarize, type Answers, type Quote, type Rates,
} from "@/lib/client-brief/schema";
import { createClientBrief, deleteClientBrief, saveClientBriefNotes, saveClientBriefRates } from "./brief-actions";
import { CopyTextButton } from "./copy-text-button";
import "./client-briefs.css";

export const metadata: Metadata = { title: "Client Briefs — Admin" };
export const dynamic = "force-dynamic";

type SP = { id?: string; created?: string; saved?: string; error?: string };

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  SUBMITTED:   "Submitted",
};
const FIT_LABEL = {
  ok:   "Fits their budget",
  warn: "Stretches their budget",
  bad:  "Over budget — offer a phased plan",
} as const;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://impactaistudio.com";

// Pinned to UTC and formatted by hand so the text never depends on the server's locale.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function when(d: Date | null): string {
  if (!d) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]}, ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}

function quoteText(club: string, q: Quote): string {
  const lines = [`Quote: ${club}`, ""];
  let group = "";
  for (const l of q.lines) {
    if (l.group !== group) { group = l.group; lines.push(group.toUpperCase()); }
    lines.push(`- ${l.label}: ${money(l.amount)}`);
  }
  if (q.rush) lines.push("", `Rush delivery: ${money(q.rush)}`);
  lines.push("", `Total: ${money(q.total)}`, `Monthly care: ${money(q.monthly)}/mo`);
  return lines.join("\n");
}

export default async function ClientBriefsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const sp = await searchParams;

  // Defensive: before the migration has run, the tables don't exist yet.
  let briefs: Awaited<ReturnType<typeof prisma.clientBrief.findMany>> = [];
  let rates: Rates = DEFAULT_RATES;
  let tableReady = true;
  try {
    const [rows, config] = await Promise.all([
      prisma.clientBrief.findMany({ orderBy: { updatedAt: "desc" }, take: 100 }),
      prisma.clientBriefConfig.findUnique({ where: { id: "singleton" } }),
    ]);
    briefs = rows;
    rates = normalizeRates(config?.rates);
  } catch {
    tableReady = false;
  }

  const now = new Date();
  const priced = briefs.map((b) => {
    const answers = sanitizeAnswers(b.answers);
    return { ...b, answers, quote: estimate(answers, rates, now) };
  });
  const current = priced.find((b) => b.id === sp.id) ?? null;
  const submitted = priced.filter((b) => b.status === "SUBMITTED").length;
  const inProgress = priced.filter((b) => b.status === "IN_PROGRESS").length;

  return (
    <div className="admin-page cbrief">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">
            <ClipboardList size={22} aria-hidden="true" /> Client Briefs
          </h1>
          <p className="cbrief-sub">
            Website briefs from clients. They need no account, and their answers save as they type. Refresh to see the latest.
          </p>
        </div>
        <Link href="/brief/demo" target="_blank" className="admin-ghost-btn">
          <ExternalLink size={14} /> Preview the client experience
        </Link>
      </div>

      {!tableReady && (
        <p className="cbrief-flash cbrief-flash--error">
          The client-brief tables are not in this database yet. They are created by the next deployment&rsquo;s migration.
        </p>
      )}
      {sp.error && <p className="cbrief-flash cbrief-flash--error">{sp.error}</p>}
      {sp.created && current && (
        <p className="cbrief-flash">Link created for {current.club}. Copy it below and send it to the client.</p>
      )}
      {sp.saved === "notes" && <p className="cbrief-flash">Notes saved.</p>}
      {sp.saved === "rates" && <p className="cbrief-flash">Rate card saved. Every quote now uses the new prices.</p>}

      <div className="admin-stat-grid">
        <div className="admin-stat-card"><span className="admin-stat-value">{priced.length}</span><span className="admin-stat-label">Briefs</span></div>
        <div className="admin-stat-card admin-stat-card--green"><span className="admin-stat-value">{submitted}</span><span className="admin-stat-label">Submitted</span></div>
        <div className="admin-stat-card admin-stat-card--warn"><span className="admin-stat-value">{inProgress}</span><span className="admin-stat-label">In progress</span></div>
      </div>

      {/* ── New link ── */}
      <section className="cbrief-card">
        <h2 className="cbrief-h2">New brief link</h2>
        <form action={createClientBrief} className="cbrief-new">
          <input className="cbrief-input" name="club" placeholder="Club or business name *" required maxLength={120} aria-label="Club or business name" />
          <input className="cbrief-input" name="contactName" placeholder="Contact name" maxLength={120} aria-label="Contact name" />
          <input className="cbrief-input" name="currentSite" placeholder="Current website" maxLength={300} aria-label="Current website" />
          <input className="cbrief-input" name="location" placeholder="City" maxLength={120} aria-label="City" />
          <button type="submit" className="admin-add-btn"><Plus size={14} /> Create link</button>
        </form>
      </section>

      <div className="cbrief-grid">
        {/* ── List ── */}
        <section className="cbrief-card cbrief-list" aria-label="Briefs">
          {priced.length === 0 && <p className="cbrief-empty">No briefs yet. Create a link above.</p>}
          {priced.map((b) => (
            <Link
              key={b.id}
              href={`/admin/client-briefs?id=${b.id}`}
              className={`cbrief-row${current?.id === b.id ? " cbrief-row--on" : ""}`}
              scroll={false}
            >
              <span className="cbrief-row-top">
                <strong>{b.club}</strong>
                <span className="cbrief-num">{b.status === "NOT_STARTED" ? "" : money(b.quote.total)}</span>
              </span>
              <span className="cbrief-row-bottom">
                <span>{b.contactName || "No contact yet"} · {when(b.updatedAt)}</span>
                <span className={`cbrief-status cbrief-status--${b.status.toLowerCase()}`}>{STATUS_LABEL[b.status]}</span>
              </span>
            </Link>
          ))}
        </section>

        {/* ── Detail ── */}
        <div className="cbrief-detail">
          {current
            ? <Detail brief={current} rates={rates} />
            : <section className="cbrief-card"><p className="cbrief-empty">Pick a brief to see the client&rsquo;s answers and your quote.</p></section>}
        </div>
      </div>

      <RatesForm rates={rates} currentId={current?.id} />
    </div>
  );
}

type Priced = {
  id: string; token: string; club: string; contactName: string | null; email: string | null; phone: string | null;
  status: string; submittedAt: Date | null; lastSeenAt: Date | null; adminNotes: string | null; createdAt: Date;
  answers: Answers; quote: Quote;
};

function Detail({ brief, rates }: { brief: Priced; rates: Rates }) {
  const { answers: a, quote: q } = brief;
  const link = `${APP_URL}/brief/${brief.token}`;
  const colors = COLOR_KEYS.map((k) => a[k]).filter((c): c is string => typeof c === "string");
  const lines = q.lines.map((l, i) => ({ ...l, head: i === 0 || q.lines[i - 1].group !== l.group }));
  const budget = typeof a.budget === "string" && a.budget ? optLabel("budget", a.budget) : "not given";

  return (
    <>
      <section className="cbrief-card">
        <div className="cbrief-detail-head">
          <div>
            <h2 className="cbrief-club">{brief.club}</h2>
            <p className="cbrief-meta">
              {[brief.contactName, brief.email, brief.phone].filter(Boolean).join(" · ") || "The client has not added contact details yet"}
            </p>
            <p className="cbrief-meta cbrief-meta--dim">
              Created {when(brief.createdAt)} · Last opened {when(brief.lastSeenAt)}
              {brief.submittedAt ? ` · Submitted ${when(brief.submittedAt)}` : ""}
            </p>
          </div>
          <span className={`cbrief-status cbrief-status--${brief.status.toLowerCase()}`}>{STATUS_LABEL[brief.status]}</span>
        </div>
        <div className="cbrief-link">
          <code className="cbrief-link-url">{link}</code>
          <CopyTextButton text={link} label="Copy link" />
          <a className="admin-ghost-btn" href={link} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open</a>
        </div>
      </section>

      <section className="cbrief-card">
        <div className="cbrief-quote-head">
          <div><span className="cbrief-label">Quote range</span><span className="cbrief-big">{money(q.low)} – {money(q.high)}</span></div>
          <div><span className="cbrief-label">Monthly care</span><span className="cbrief-big">{money(q.monthly)}</span></div>
        </div>
        <p className="cbrief-meta">
          {q.fit && <strong className={`cbrief-fit cbrief-fit--${q.fit}`}>{FIT_LABEL[q.fit]}</strong>}
          Their budget: {budget}
        </p>
        <table className="cbrief-quote">
          <tbody>
            {lines.flatMap((l, i) => [
              l.head ? <tr key={`g${i}`} className="cbrief-quote-group"><td colSpan={2}>{l.group}</td></tr> : null,
              <tr key={i}><td>{l.label}</td><td className="cbrief-num">{money(l.amount)}</td></tr>,
            ])}
            {q.rush > 0 && (
              <tr><td>Rush — launch in {Math.max(0, Math.round(q.weeks ?? 0))} weeks (+{rates.rush_pct}%)</td><td className="cbrief-num">{money(q.rush)}</td></tr>
            )}
            <tr className="cbrief-quote-total"><td>Total</td><td className="cbrief-num">{money(q.total)}</td></tr>
          </tbody>
        </table>
        <div className="cbrief-actions">
          <CopyTextButton text={quoteText(brief.club, q)} label="Copy quote" />
        </div>
      </section>

      <section className="cbrief-card">
        <h2 className="cbrief-h2">Answers</h2>
        {(colors.length > 0 || typeof a.style === "string") && (
          <div className="cbrief-swatches">
            {colors.map((c) => (
              <svg key={c} className="cbrief-swatch" viewBox="0 0 10 10" role="img" aria-label={c}>
                <title>{c}</title>
                <rect width="10" height="10" rx="2" fill={c} />
              </svg>
            ))}
            {typeof a.style === "string" && a.style && <span className="cbrief-meta">Style: <strong>{optLabel("style", a.style)}</strong></span>}
          </div>
        )}
        {summarize(a).map((sec) => (
          <div key={sec.title} className="cbrief-section">
            <h3 className="cbrief-h3">{sec.title}</h3>
            {sec.rows.length > 0
              ? <dl className="cbrief-dl">{sec.rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
              : <p className="cbrief-meta cbrief-meta--dim">Not answered yet</p>}
          </div>
        ))}
      </section>

      <section className="cbrief-card">
        <h2 className="cbrief-h2">Your notes</h2>
        <form action={saveClientBriefNotes}>
          <input type="hidden" name="id" value={brief.id} />
          <textarea className="cbrief-input cbrief-textarea" name="adminNotes" defaultValue={brief.adminNotes ?? ""} placeholder="Private notes about this client" maxLength={10000} aria-label="Private notes" />
          <div className="cbrief-actions"><button type="submit" className="admin-ghost-btn">Save notes</button></div>
        </form>
        <details className="cbrief-danger">
          <summary>Delete this brief…</summary>
          <p className="cbrief-meta">This removes {brief.club}&rsquo;s answers for good, and their link stops working.</p>
          <form action={deleteClientBrief}>
            <input type="hidden" name="id" value={brief.id} />
            <button type="submit" className="cbrief-delete"><Trash2 size={14} /> Yes, delete it</button>
          </form>
        </details>
      </section>
    </>
  );
}

function RatesForm({ rates, currentId }: { rates: Rates; currentId?: string }) {
  const featureQ = question("features");
  const features = featureQ && featureQ.t === "groups" ? featureQ.groups.flatMap(([, items]) => items) : [];
  const keys = Object.keys(RATE_LABELS) as (keyof typeof RATE_LABELS)[];
  const isTiming = (k: string) => /^(rush|spread|care)/.test(k);
  const row = (name: string, label: string, value: number) => (
    <label key={name} className="cbrief-rate">
      <span>{label}</span>
      <input className="cbrief-input cbrief-rate-input" type="number" min={0} step={1} name={name} defaultValue={value} />
    </label>
  );
  return (
    <details className="cbrief-card cbrief-rates">
      <summary>Rate card (USD) — prices every brief</summary>
      {/* key: remount the inputs when saved rates change, so defaultValue reflects them */}
      <form action={saveClientBriefRates} key={JSON.stringify(rates)}>
        {currentId && <input type="hidden" name="id" value={currentId} />}
        <h3 className="cbrief-h3">Build, content and brand</h3>
        <div className="cbrief-rate-grid">{keys.filter((k) => !isTiming(k)).map((k) => row(`rate.${k}`, RATE_LABELS[k], rates[k]))}</div>
        <h3 className="cbrief-h3">Features</h3>
        <div className="cbrief-rate-grid">{features.map(([k, label]) => row(`feature.${k}`, label, rates.features[k] ?? 0))}</div>
        <h3 className="cbrief-h3">Timing and care</h3>
        <div className="cbrief-rate-grid">{keys.filter(isTiming).map((k) => row(`rate.${k}`, RATE_LABELS[k], rates[k]))}</div>
        <div className="cbrief-actions"><button type="submit" className="admin-add-btn">Save rates</button></div>
      </form>
    </details>
  );
}
