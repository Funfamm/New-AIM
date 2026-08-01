import { auth } from "@/lib/auth";
import { getUserPreferences } from "@/lib/actions/preferences";
import { updateUserProfile, getUserProfile, getUserPasswordState } from "@/lib/actions/user";
import { logoutUser } from "@/lib/actions/auth";
import Link from "next/link";
import { ChevronLeft, ChevronDown, LogOut } from "lucide-react";
import NavWrapper from "@/components/nav-wrapper";
import Footer from "@/components/footer";
import PasswordSection from "./password-section";
import { NotifPrefsForm, PlaybackPrefsForm, SettingsSubmitBtn } from "./settings-forms";
import type { Metadata } from "next";
import "./settings.css";

export const metadata: Metadata = { title: "Settings — AIM Studio" };

type Props = {
  searchParams: Promise<{ saved?: string; error?: string }>;
};

export default async function SettingsPage({ searchParams }: Props) {
  const [, profile, prefs, { hasPassword }, params] = await Promise.all([
    auth(),
    getUserProfile(),
    getUserPreferences(),
    getUserPasswordState(),
    searchParams,
  ]);

  const savedSection = params.saved;
  const errorMsg = params.error;

  return (
    <>
      <NavWrapper />
      <div style={{ paddingTop: "68px" }}>
        <main className="settingspage">
          <div className="container-app">

            <Link href="/dashboard" className="settingspage-back">
              <ChevronLeft size={16} /> Dashboard
            </Link>

            <h1 className="settingspage-title">Settings</h1>

            {errorMsg && (
              <p className="settings-feedback settings-feedback--error">
                {decodeURIComponent(errorMsg)}
              </p>
            )}

            {/* ── Profile ── */}
            <details className="settings-accordion" open>
              <summary className="settings-accordion-summary">
                <span>Profile</span>
                {savedSection === "profile" && (
                  <span className="settings-saved-chip">Saved</span>
                )}
                <ChevronDown size={16} className="settings-accordion-chevron" aria-hidden="true" />
              </summary>
              <div className="settings-accordion-body">
                <form action={updateUserProfile} className="settings-form">
                  <div className="settings-field-row">
                    <label className="settings-field-label" htmlFor="name">
                      Display name
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      defaultValue={profile.name ?? ""}
                      maxLength={80}
                      className="settings-text-input"
                      autoComplete="name"
                    />
                  </div>
                  <div className="settings-field-row">
                    <label className="settings-field-label">Email</label>
                    <span className="settings-field-readonly">{profile.email ?? "—"}</span>
                  </div>
                  <div className="settings-form-footer">
                    <SettingsSubmitBtn label="Save Profile" />
                  </div>
                </form>
              </div>
            </details>

            {/* ── Notification Preferences ── */}
            <details className="settings-accordion">
              <summary className="settings-accordion-summary">
                <span>Notification Preferences</span>
                <ChevronDown size={16} className="settings-accordion-chevron" aria-hidden="true" />
              </summary>
              <div className="settings-accordion-body">
                <NotifPrefsForm
                  inAppNotifications={prefs.inAppNotifications}
                  emailNotifications={prefs.emailNotifications}
                  newReleaseNotifications={prefs.newReleaseNotifications}
                  newEpisodeNotifications={prefs.newEpisodeNotifications}
                  announcementNotifications={prefs.announcementNotifications}
                  studioUpdates={prefs.studioUpdates}
                  notifyMeFollowupEmails={prefs.notifyMeFollowupEmails}
                  savedWorkNotifications={prefs.savedWorkNotifications}
                  watchReminderNotifications={prefs.watchReminderNotifications}
                />
              </div>
            </details>

            {/* ── Playback Preferences ── */}
            <details className="settings-accordion" id="playback">
              <summary className="settings-accordion-summary">
                <span>Playback Preferences</span>
                <ChevronDown size={16} className="settings-accordion-chevron" aria-hidden="true" />
              </summary>
              <div className="settings-accordion-body">
                <PlaybackPrefsForm
                  autoplayNextEpisode={prefs.autoplayNextEpisode}
                  resumePlayback={prefs.resumePlayback}
                  reducedMotion={prefs.reducedMotion}
                />
              </div>
            </details>

            {/* ── Account & Security ── */}
            <details className="settings-accordion">
              <summary className="settings-accordion-summary">
                <span>Account &amp; Security</span>
                <ChevronDown size={16} className="settings-accordion-chevron" aria-hidden="true" />
              </summary>
              <div className="settings-accordion-body">
                <PasswordSection hasPassword={hasPassword} />
                <div className="settings-toggle-row settings-toggle-row--plain settings-toggle-row--last">
                  <div>
                    <p className="settings-toggle-label">Sign out</p>
                    <p className="settings-toggle-desc">Sign out of this device</p>
                  </div>
                  <form action={logoutUser}>
                    <button type="submit" className="settings-logout-btn">
                      <LogOut size={14} /> Sign Out
                    </button>
                  </form>
                </div>
              </div>
            </details>

          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
