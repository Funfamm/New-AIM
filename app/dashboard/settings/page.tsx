import { auth } from "@/lib/auth";
import { getUserPreferences, updateUserPreferences } from "@/lib/actions/preferences";
import { logoutUser } from "@/lib/actions/auth";
import Link from "next/link";
import { ChevronLeft, LogOut } from "lucide-react";
import NavWrapper from "@/components/nav-wrapper";
import Footer from "@/components/footer";
import type { Metadata } from "next";
import "./settings.css";

export const metadata: Metadata = { title: "Settings — AIM Studio" };

export default async function SettingsPage() {
  const session = await auth();
  const prefs = await getUserPreferences();

  const userName = session?.user?.name ?? "—";
  const userEmail = session?.user?.email ?? "—";

  return (
    <>
      <NavWrapper />
      <div style={{ paddingTop: "68px" }}>
        <main className="settingspage">
          <div className="container-app">

            {/* ── Back ── */}
            <Link href="/dashboard" className="settingspage-back">
              <ChevronLeft size={16} /> Dashboard
            </Link>

            <h1 className="settingspage-title">Settings</h1>

            {/* ── Profile (read-only) ── */}
            <section className="settings-section">
              <h2 className="settings-section-heading">Profile</h2>
              <div className="settings-card">
                <div className="settings-row">
                  <span className="settings-label">Name</span>
                  <span className="settings-value">{userName}</span>
                </div>
                <div className="settings-row">
                  <span className="settings-label">Email</span>
                  <span className="settings-value">{userEmail}</span>
                </div>
                <div className="settings-row settings-row--action">
                  <Link href="/forgot-password" className="settings-action-link">
                    Change password
                  </Link>
                </div>
              </div>
            </section>

            {/* ── Notification Preferences ── */}
            <section id="notifications" className="settings-section">
              <h2 className="settings-section-heading">Notification Preferences</h2>
              <form action={updateUserPreferences} className="settings-form">
                <div className="settings-card">

                  <label className="settings-toggle-row">
                    <div>
                      <p className="settings-toggle-label">In-app notifications</p>
                      <p className="settings-toggle-desc">Show notifications inside your dashboard</p>
                    </div>
                    <input
                      type="checkbox"
                      name="inAppNotifications"
                      defaultChecked={prefs.inAppNotifications}
                      className="settings-checkbox"
                    />
                  </label>

                  <label className="settings-toggle-row">
                    <div>
                      <p className="settings-toggle-label">Email notifications</p>
                      <p className="settings-toggle-desc">Receive notifications by email</p>
                    </div>
                    <input
                      type="checkbox"
                      name="emailNotifications"
                      defaultChecked={prefs.emailNotifications}
                      className="settings-checkbox"
                    />
                  </label>

                  <div className="settings-divider" />

                  <label className="settings-toggle-row">
                    <div>
                      <p className="settings-toggle-label">New releases</p>
                      <p className="settings-toggle-desc">When a new film or series drops</p>
                    </div>
                    <input
                      type="checkbox"
                      name="newReleaseNotifications"
                      defaultChecked={prefs.newReleaseNotifications}
                      className="settings-checkbox"
                    />
                  </label>

                  <label className="settings-toggle-row">
                    <div>
                      <p className="settings-toggle-label">New episodes</p>
                      <p className="settings-toggle-desc">When a new episode is added to a series</p>
                    </div>
                    <input
                      type="checkbox"
                      name="newEpisodeNotifications"
                      defaultChecked={prefs.newEpisodeNotifications}
                      className="settings-checkbox"
                    />
                  </label>

                  <label className="settings-toggle-row">
                    <div>
                      <p className="settings-toggle-label">Announcements</p>
                      <p className="settings-toggle-desc">Studio news and major updates</p>
                    </div>
                    <input
                      type="checkbox"
                      name="announcementNotifications"
                      defaultChecked={prefs.announcementNotifications}
                      className="settings-checkbox"
                    />
                  </label>

                  <label className="settings-toggle-row">
                    <div>
                      <p className="settings-toggle-label">Studio updates</p>
                      <p className="settings-toggle-desc">Behind-the-scenes and production updates</p>
                    </div>
                    <input
                      type="checkbox"
                      name="studioUpdates"
                      defaultChecked={prefs.studioUpdates}
                      className="settings-checkbox"
                    />
                  </label>

                </div>

                {/* ── Playback Preferences ── */}
                <h2 id="playback" className="settings-section-heading settings-section-heading--mt">
                  Playback Preferences
                </h2>
                <div className="settings-card">

                  <label className="settings-toggle-row">
                    <div>
                      <p className="settings-toggle-label">Autoplay next episode</p>
                      <p className="settings-toggle-desc">Automatically play the next episode when one ends</p>
                    </div>
                    <input
                      type="checkbox"
                      name="autoplayNextEpisode"
                      defaultChecked={prefs.autoplayNextEpisode}
                      className="settings-checkbox"
                    />
                  </label>

                  <label className="settings-toggle-row">
                    <div>
                      <p className="settings-toggle-label">Resume playback</p>
                      <p className="settings-toggle-desc">Continue from where you left off</p>
                    </div>
                    <input
                      type="checkbox"
                      name="resumePlayback"
                      defaultChecked={prefs.resumePlayback}
                      className="settings-checkbox"
                    />
                  </label>

                  <label className="settings-toggle-row">
                    <div>
                      <p className="settings-toggle-label">Reduce motion</p>
                      <p className="settings-toggle-desc">Minimize animations and transitions across the site</p>
                    </div>
                    <input
                      type="checkbox"
                      name="reducedMotion"
                      defaultChecked={prefs.reducedMotion}
                      className="settings-checkbox"
                    />
                  </label>

                </div>

                <button type="submit" className="settings-save-btn">Save Preferences</button>
              </form>
            </section>

            {/* ── Account / Sign out ── */}
            <section className="settings-section">
              <h2 className="settings-section-heading">Account</h2>
              <div className="settings-card">
                <div className="settings-row settings-row--action">
                  <form action={logoutUser}>
                    <button type="submit" className="settings-logout-btn">
                      <LogOut size={15} /> Sign Out
                    </button>
                  </form>
                </div>
              </div>
            </section>

          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
