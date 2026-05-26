import { auth } from "@/lib/auth";
import { getUserNotifications, markNotificationRead, markAllNotificationsRead } from "@/lib/actions/notifications";
import Link from "next/link";
import { ChevronLeft, Bell } from "lucide-react";
import NavWrapper from "@/components/nav-wrapper";
import Footer from "@/components/footer";
import type { Metadata } from "next";
import "./notifications.css";

export const metadata: Metadata = { title: "Notifications — AIM Studio" };

const NOTIF_ICON: Record<string, string> = {
  NEW_RELEASE:  "🎬",
  NEW_EPISODE:  "🎞️",
  ANNOUNCEMENT: "📣",
  WATCH_PROGRESS: "⏱️",
  ACCOUNT:  "👤",
  SYSTEM:   "⚙️",
  SECURITY: "🔒",
};

const NOTIF_LABEL: Record<string, string> = {
  NEW_RELEASE:  "New Release",
  NEW_EPISODE:  "New Episode",
  ANNOUNCEMENT: "Announcement",
  WATCH_PROGRESS: "Watch Progress",
  ACCOUNT:  "Account",
  SYSTEM:   "System",
  SECURITY: "Security Alert",
};

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function NotificationsPage() {
  await auth(); // middleware already guards; this confirms session for page
  const notifications = await getUserNotifications();

  const unread = notifications.filter((n) => !n.read);
  const hasUnread = unread.length > 0;

  return (
    <>
      <NavWrapper />
      <div style={{ paddingTop: "68px" }}>
        <main className="notifpage">
          <div className="container-app">

            {/* ── Back + heading ── */}
            <Link href="/dashboard" className="notifpage-back">
              <ChevronLeft size={16} /> Dashboard
            </Link>

            <div className="notifpage-header">
              <h1 className="notifpage-title">
                <Bell size={20} /> Notifications
              </h1>
              {hasUnread && (
                <form action={markAllNotificationsRead}>
                  <button type="submit" className="notifpage-mark-all">
                    Mark all as read
                  </button>
                </form>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="notifpage-empty">
                <p>No notifications yet. Check back when new films drop.</p>
                <Link href="/works" className="notifpage-browse-btn">Browse Works</Link>
              </div>
            ) : (
              <ul className="notifpage-list">
                {notifications.map((n) => {
                  const markRead = markNotificationRead.bind(null, n.id);
                  return (
                    <li key={n.id} className={`notifpage-item${n.read ? "" : " notifpage-item--unread"}`}>
                      <span className="notifpage-icon" aria-hidden="true">{NOTIF_ICON[n.type] ?? "🔔"}</span>

                      <div className="notifpage-body">
                        <div className="notifpage-meta">
                          <span className="notifpage-type">{NOTIF_LABEL[n.type] ?? n.type}</span>
                          <span className="notifpage-time">{timeAgo(new Date(n.createdAt))}</span>
                        </div>
                        {n.href ? (
                          <Link href={n.href} className="notifpage-item-title">{n.title}</Link>
                        ) : (
                          <p className="notifpage-item-title">{n.title}</p>
                        )}
                        {n.body && <p className="notifpage-item-body">{n.body}</p>}
                      </div>

                      <div className="notifpage-actions">
                        {!n.read && (
                          <form action={markRead}>
                            <button type="submit" className="notifpage-read-btn" aria-label="Mark as read">
                              <span className="notifpage-dot" />
                            </button>
                          </form>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
