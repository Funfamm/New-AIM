"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  updateNotificationPreferences,
  updatePlaybackPreferences,
  type UserPreferencesData,
} from "@/lib/actions/preferences";

// ── Submit button with pending state ─────────────────────────
export function SettingsSubmitBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="settings-save-btn" disabled={pending}>
      {pending ? "Saving…" : label}
    </button>
  );
}

// ── Inline save feedback ──────────────────────────────────────
function SaveFeedback({ state }: { state: { ok: boolean; error?: string } | null }) {
  if (!state) return null;
  if (state.ok) {
    return <span className="settings-saved-chip">Saved</span>;
  }
  return <span className="settings-feedback settings-feedback--error">{state.error ?? "Save failed."}</span>;
}

// ── Notification preferences form ────────────────────────────
type NotifProps = Pick<
  UserPreferencesData,
  | "inAppNotifications"
  | "emailNotifications"
  | "newReleaseNotifications"
  | "newEpisodeNotifications"
  | "announcementNotifications"
  | "studioUpdates"
  | "notifyMeFollowupEmails"
  | "savedWorkNotifications"
  | "watchReminderNotifications"
>;

export function NotifPrefsForm(props: NotifProps) {
  const [state, formAction] = useActionState(updateNotificationPreferences, null);

  return (
    <form action={formAction}>
      <label className="settings-toggle-row">
        <div>
          <p className="settings-toggle-label">In-app notifications</p>
          <p className="settings-toggle-desc">Show notifications inside your dashboard</p>
        </div>
        <input type="checkbox" name="inAppNotifications"
          defaultChecked={props.inAppNotifications} className="settings-checkbox" />
      </label>
      <label className="settings-toggle-row">
        <div>
          <p className="settings-toggle-label">Email notifications</p>
          <p className="settings-toggle-desc">Receive notifications by email</p>
        </div>
        <input type="checkbox" name="emailNotifications"
          defaultChecked={props.emailNotifications} className="settings-checkbox" />
      </label>
      <div className="settings-divider" />
      <label className="settings-toggle-row">
        <div>
          <p className="settings-toggle-label">New releases</p>
          <p className="settings-toggle-desc">When a new film or series drops</p>
        </div>
        <input type="checkbox" name="newReleaseNotifications"
          defaultChecked={props.newReleaseNotifications} className="settings-checkbox" />
      </label>
      <label className="settings-toggle-row">
        <div>
          <p className="settings-toggle-label">New episodes</p>
          <p className="settings-toggle-desc">When a new episode is added to a series</p>
        </div>
        <input type="checkbox" name="newEpisodeNotifications"
          defaultChecked={props.newEpisodeNotifications} className="settings-checkbox" />
      </label>
      <label className="settings-toggle-row">
        <div>
          <p className="settings-toggle-label">Announcements</p>
          <p className="settings-toggle-desc">Studio news and major updates</p>
        </div>
        <input type="checkbox" name="announcementNotifications"
          defaultChecked={props.announcementNotifications} className="settings-checkbox" />
      </label>
      <label className="settings-toggle-row">
        <div>
          <p className="settings-toggle-label">Studio updates</p>
          <p className="settings-toggle-desc">Behind-the-scenes and production updates</p>
        </div>
        <input type="checkbox" name="studioUpdates"
          defaultChecked={props.studioUpdates} className="settings-checkbox" />
      </label>
      <div className="settings-divider" />
      <label className="settings-toggle-row">
        <div>
          <p className="settings-toggle-label">Notify Me follow-up emails</p>
          <p className="settings-toggle-desc">Email when a work you signed up for is released</p>
        </div>
        <input type="checkbox" name="notifyMeFollowupEmails"
          defaultChecked={props.notifyMeFollowupEmails} className="settings-checkbox" />
      </label>
      <label className="settings-toggle-row">
        <div>
          <p className="settings-toggle-label">Saved work updates</p>
          <p className="settings-toggle-desc">Notify me when a saved series gets new content</p>
        </div>
        <input type="checkbox" name="savedWorkNotifications"
          defaultChecked={props.savedWorkNotifications} className="settings-checkbox" />
      </label>
      <label className="settings-toggle-row">
        <div>
          <p className="settings-toggle-label">Watch reminders</p>
          <p className="settings-toggle-desc">Occasional prompts to resume something you started</p>
        </div>
        <input type="checkbox" name="watchReminderNotifications"
          defaultChecked={props.watchReminderNotifications} className="settings-checkbox" />
      </label>
      <div className="settings-toggle-row settings-toggle-row--plain">
        <div>
          <p className="settings-toggle-label">Security emails</p>
          <p className="settings-toggle-desc">
            Login alerts, password resets, and account security — always on
          </p>
        </div>
        <span className="settings-field-readonly" style={{ fontSize: "0.78rem" }}>Always on</span>
      </div>
      <div className="settings-form-footer">
        <SettingsSubmitBtn label="Save" />
        <SaveFeedback state={state} />
      </div>
    </form>
  );
}

// ── Playback preferences form ─────────────────────────────────
type PlaybackProps = Pick<
  UserPreferencesData,
  "autoplayNextEpisode" | "resumePlayback" | "reducedMotion"
>;

export function PlaybackPrefsForm(props: PlaybackProps) {
  const [state, formAction] = useActionState(updatePlaybackPreferences, null);

  return (
    <form action={formAction}>
      <label className="settings-toggle-row">
        <div>
          <p className="settings-toggle-label">Autoplay next episode</p>
          <p className="settings-toggle-desc">Automatically play the next episode when one ends</p>
        </div>
        <input type="checkbox" name="autoplayNextEpisode"
          defaultChecked={props.autoplayNextEpisode} className="settings-checkbox" />
      </label>
      <label className="settings-toggle-row">
        <div>
          <p className="settings-toggle-label">Resume playback</p>
          <p className="settings-toggle-desc">Continue from where you left off</p>
        </div>
        <input type="checkbox" name="resumePlayback"
          defaultChecked={props.resumePlayback} className="settings-checkbox" />
      </label>
      <label className="settings-toggle-row">
        <div>
          <p className="settings-toggle-label">Reduce motion</p>
          <p className="settings-toggle-desc">Minimize animations across the site</p>
        </div>
        <input type="checkbox" name="reducedMotion"
          defaultChecked={props.reducedMotion} className="settings-checkbox" />
      </label>
      <div className="settings-form-footer">
        <SettingsSubmitBtn label="Save" />
        <SaveFeedback state={state} />
      </div>
    </form>
  );
}
