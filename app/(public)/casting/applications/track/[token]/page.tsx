import { getApplicationTracking } from "@/lib/actions/casting";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import TrackingClient from "./tracking-client";
import "../../../casting.css";

type Props = { params: Promise<{ token: string }> };

export const metadata: Metadata = { title: "Application Status — AIM Studio" };

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED:              "Received",
  UNDER_AGENT_REVIEW:     "Under Review",
  REQUIREMENTS_NOT_MET:   "Action Required",
  READY_FOR_ADMIN_REVIEW: "In Consideration",
  SHORTLISTED:            "Shortlisted",
  CONTACTED:              "Contacted",
  SELECTED:               "Selected",
  NOT_SELECTED:           "Not Selected",
  WITHDRAWN:              "Withdrawn",
};

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED:              "casting-status--neutral",
  UNDER_AGENT_REVIEW:     "casting-status--neutral",
  REQUIREMENTS_NOT_MET:   "casting-status--warn",
  READY_FOR_ADMIN_REVIEW: "casting-status--info",
  SHORTLISTED:            "casting-status--good",
  CONTACTED:              "casting-status--good",
  SELECTED:               "casting-status--success",
  NOT_SELECTED:           "casting-status--muted",
  WITHDRAWN:              "casting-status--muted",
};

export default async function TrackingPage({ params }: Props) {
  const { token } = await params;

  const [app, session] = await Promise.all([
    getApplicationTracking(token),
    auth(),
  ]);

  if (!app) notFound();

  const submittedDate = new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  }).format(new Date(app.createdAt));

  return (
    <main className="casting-track-page">
      <div className="casting-apply-back">
        <Link href="/casting" className="casting-back-link">← Casting</Link>
      </div>

      <div className="casting-track-header">
        <span className="casting-hero-rule" />
        <p className="casting-eyebrow">Application Status</p>
        <h1 className="casting-track-role">{app.role.title}</h1>
        <p className="casting-track-date">Submitted {submittedDate}</p>
      </div>

      <div className="casting-track-status-card">
        <span className={`casting-status-badge ${STATUS_COLORS[app.status] ?? ""}`}>
          {STATUS_LABELS[app.status] ?? app.status}
        </span>
        <p className="casting-track-message">{app.nextStepMessage}</p>

        {app.status === "REQUIREMENTS_NOT_MET" && app.requirementsReason && (
          <div className="casting-track-reason">
            <p className="casting-track-reason-label">Details from our review:</p>
            <p className="casting-track-reason-text">{app.requirementsReason}</p>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="casting-track-timeline">
        {[
          { key: "SUBMITTED",              label: "Application Received" },
          { key: "UNDER_AGENT_REVIEW",     label: "Initial Review" },
          { key: "READY_FOR_ADMIN_REVIEW", label: "Casting Team Review" },
          { key: "SHORTLISTED",            label: "Shortlisted" },
          { key: "CONTACTED",              label: "Team Contact" },
          { key: "SELECTED",               label: "Final Decision" },
        ].map(({ key, label }) => {
          const statuses = [
            "SUBMITTED", "UNDER_AGENT_REVIEW", "REQUIREMENTS_NOT_MET",
            "READY_FOR_ADMIN_REVIEW", "SHORTLISTED", "CONTACTED",
            "SELECTED", "NOT_SELECTED",
          ];
          const currentIdx = statuses.indexOf(app.status);
          const nodeIdx    = statuses.indexOf(key);
          const isDone     = currentIdx > nodeIdx;
          const isCurrent  = app.status === key || (key === "SUBMITTED" && app.status === "REQUIREMENTS_NOT_MET") || (key === "SELECTED" && app.status === "NOT_SELECTED");

          return (
            <div
              key={key}
              className={`casting-timeline-step ${isDone ? "casting-timeline-step--done" : ""} ${isCurrent ? "casting-timeline-step--active" : ""}`}
            >
              <div className="casting-timeline-dot" />
              <span className="casting-timeline-label">{label}</span>
            </div>
          );
        })}
      </div>

      {/* Withdraw */}
      {app.canWithdraw && session?.user && (
        <TrackingClient token={token} />
      )}

      <div className="casting-track-footer">
        <p className="casting-track-footer-text">
          Keep this page bookmarked to check your status. You will also receive email updates when your status changes.
        </p>
      </div>
    </main>
  );
}
