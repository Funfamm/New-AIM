import { auth } from "@/lib/auth";
import { getAllWatchProgress } from "@/lib/actions/progress";
import { getSavedWorks, unsaveWork } from "@/lib/actions/watchlist";
import { logoutUser } from "@/lib/actions/auth";
import Link from "next/link";
import "./dashboard.css";
import { Clock, Play, LogOut, X } from "lucide-react";
import NavWrapper from "@/components/nav-wrapper";
import Footer from "@/components/footer";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

const TYPE_LABEL: Record<string, string> = {
  SHORT_FILM: "Short Film", FULL_FILM: "Film", SERIES: "Series",
  TRAILER: "Trailer", COMMERCIAL: "Commercial", BRANDING: "Branding",
  CAMPAIGN: "Campaign", CASE_STUDY: "Case Study",
};

export default async function DashboardPage() {
  const session = await auth();
  const [progress, savedWorks] = await Promise.all([
    getAllWatchProgress(),
    getSavedWorks(),
  ]);

  return (
    <>
      <NavWrapper />
      <div style={{ paddingTop: "60px" }}>
        <main className="dashboard-page">
          <div className="container-app">

            {/* ── Header ── */}
            <div className="dashboard-header">
              <div>
                <h1 className="dashboard-title">
                  Hello, {session?.user?.name ?? "there"}
                </h1>
                <p className="dashboard-sub">{session?.user?.email}</p>
              </div>
              <form action={logoutUser}>
                <button type="submit" className="logout-btn">
                  <LogOut size={15} /> Sign Out
                </button>
              </form>
            </div>

            {/* ── Continue Watching ── */}
            <h2 className="section-heading">Continue Watching</h2>
            {progress.length > 0 ? (
              <div className="progress-grid">
                {progress.map((p) => {
                  // Episodes and series navigate directly; everything else needs ?full=1
                  // so the watch page plays the main video, not the trailer
                  const watchHref =
                    p.work.type === "EPISODE" || p.work.type === "SERIES"
                      ? `/watch/${p.work.slug}`
                      : `/watch/${p.work.slug}?full=1`;
                  return (
                  <Link key={p.id} href={watchHref} className="progress-card">
                    {p.work.posterUrl ? (
                      <img src={p.work.posterUrl} alt={p.work.title} className="progress-poster" />
                    ) : (
                      <div className="progress-poster-placeholder">
                        {p.work.title.charAt(0)}
                      </div>
                    )}
                    <div className="progress-info">
                      <h3 className="progress-title">{p.work.title}</h3>
                      <div className="progress-meta">
                        <Clock size={12} />
                        {Math.floor(p.seconds / 60)}m {p.seconds % 60}s watched
                      </div>
                      {p.work.duration && (
                        <div className="progress-bar-wrap">
                          <div
                            className="progress-bar-fill"
                            style={{
                              width: `${Math.min(100, (p.seconds / (p.work.duration * 60)) * 100)}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="progress-play"><Play size={18} fill="currentColor" /></div>
                  </Link>
                  );
                })}
              </div>
            ) : (
              <div className="dashboard-empty">
                <p>No watch history yet.</p>
                <Link href="/works" className="browse-btn">Browse Works</Link>
              </div>
            )}

            {/* ── Watchlist ── */}
            <h2 className="section-heading" style={{ marginTop: "3rem" }}>My Watchlist</h2>
            {savedWorks.length > 0 ? (
              <div className="watchlist-grid">
                {savedWorks.map((item) => {
                  const removeAction = unsaveWork.bind(null, item.work.id);
                  return (
                    <div key={item.id} className="watchlist-card">
                      <Link href={`/works/${item.work.slug}`} className="watchlist-link">
                        {item.work.posterUrl ? (
                          <img
                            src={item.work.posterUrl}
                            alt={item.work.title}
                            className="progress-poster"
                          />
                        ) : (
                          <div className="progress-poster-placeholder">
                            {item.work.title.charAt(0)}
                          </div>
                        )}
                        <div className="progress-info">
                          <h3 className="progress-title">{item.work.title}</h3>
                          <div className="progress-meta">
                            {TYPE_LABEL[item.work.type] ?? item.work.type}
                            {item.work.year ? ` · ${item.work.year}` : ""}
                          </div>
                        </div>
                      </Link>
                      <form action={removeAction}>
                        <button
                          type="submit"
                          className="watchlist-remove-btn"
                          aria-label={`Remove ${item.work.title} from watchlist`}
                        >
                          <X size={14} />
                        </button>
                      </form>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="dashboard-empty">
                <p>Your watchlist is empty.</p>
                <Link href="/works" className="browse-btn">Browse Works</Link>
              </div>
            )}

          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
