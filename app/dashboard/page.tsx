import { auth } from "@/lib/auth";
import { getAllWatchProgress } from "@/lib/actions/progress";
import { logoutUser } from "@/lib/actions/auth";
import Link from "next/link";
import "./dashboard.css";
import { Clock, Play, LogOut } from "lucide-react";
import NavWrapper from "@/components/nav-wrapper";
import Footer from "@/components/footer";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await auth();
  const progress = await getAllWatchProgress();

  return (
    <>
      <NavWrapper />
      <div style={{ paddingTop: "60px" }}>
        <main className="dashboard-page">
          <div className="container-app">
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

            <h2 className="section-heading">Continue Watching</h2>

            {progress.length > 0 ? (
              <div className="progress-grid">
                {progress.map((p) => (
                  <Link key={p.id} href={`/watch/${p.work.slug}`} className="progress-card">
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
                ))}
              </div>
            ) : (
              <div className="dashboard-empty">
                <p>No watch history yet.</p>
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
