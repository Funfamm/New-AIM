import { auth } from "@/lib/auth";
import { getAllWatchProgress } from "@/lib/actions/progress";
import { logoutUser } from "@/lib/actions/auth";
import Link from "next/link";
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
                  <Link key={p.id} href={`/watch/${p.film.slug}`} className="progress-card">
                    {p.film.posterUrl ? (
                      <img src={p.film.posterUrl} alt={p.film.title} className="progress-poster" />
                    ) : (
                      <div className="progress-poster-placeholder">
                        {p.film.title.charAt(0)}
                      </div>
                    )}
                    <div className="progress-info">
                      <h3 className="progress-title">{p.film.title}</h3>
                      <div className="progress-meta">
                        <Clock size={12} />
                        {Math.floor(p.seconds / 60)}m {p.seconds % 60}s watched
                      </div>
                      {p.film.duration && (
                        <div className="progress-bar-wrap">
                          <div
                            className="progress-bar-fill"
                            style={{ width: `${Math.min(100, (p.seconds / (p.film.duration * 60)) * 100)}%` }}
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
                <Link href="/works" className="browse-btn">Browse Films</Link>
              </div>
            )}
          </div>
        </main>
        <Footer />
      </div>

      <style>{`
        .dashboard-page { padding: 3rem 0 6rem; min-height: 80dvh; }
        .dashboard-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 3rem;
          flex-wrap: wrap;
        }
        .dashboard-title {
          font-family: var(--font-display);
          font-size: clamp(1.8rem, 5vw, 2.5rem);
          font-weight: 900;
          color: var(--color-brand-white);
          margin: 0 0 0.3rem;
        }
        .dashboard-sub {
          font-family: var(--font-body);
          font-size: 0.875rem;
          color: var(--color-brand-muted);
          margin: 0;
        }
        .logout-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          font-family: var(--font-body);
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--color-brand-muted);
          background: none;
          border: 1px solid var(--color-brand-border);
          border-radius: 6px;
          padding: 0.5rem 1rem;
          cursor: pointer;
          transition: color 0.2s, border-color 0.2s;
        }
        .logout-btn:hover { color: var(--color-brand-white); border-color: var(--color-brand-white); }
        .section-heading {
          font-family: var(--font-display);
          font-size: 1.2rem;
          font-weight: 700;
          color: var(--color-brand-white);
          margin: 0 0 1.5rem;
        }
        .progress-grid {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .progress-card {
          display: flex;
          align-items: center;
          gap: 1rem;
          background: var(--color-brand-dark);
          border: 1px solid var(--color-brand-border);
          border-radius: 8px;
          padding: 0.75rem;
          text-decoration: none;
          transition: border-color 0.2s;
        }
        .progress-card:hover { border-color: var(--color-brand-accent); }
        .progress-poster {
          width: 60px;
          height: 90px;
          object-fit: cover;
          border-radius: 4px;
          flex-shrink: 0;
        }
        .progress-poster-placeholder {
          width: 60px;
          height: 90px;
          background: var(--color-brand-surface);
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-display);
          font-size: 1.5rem;
          color: var(--color-brand-border);
          flex-shrink: 0;
        }
        .progress-info { flex: 1; min-width: 0; }
        .progress-title {
          font-family: var(--font-display);
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--color-brand-white);
          margin: 0 0 0.35rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .progress-meta {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          font-family: var(--font-body);
          font-size: 0.75rem;
          color: var(--color-brand-muted);
          margin-bottom: 0.5rem;
        }
        .progress-bar-wrap {
          height: 3px;
          background: var(--color-brand-border);
          border-radius: 2px;
          overflow: hidden;
        }
        .progress-bar-fill {
          height: 100%;
          background: var(--color-brand-accent);
          border-radius: 2px;
        }
        .progress-play {
          color: var(--color-brand-accent);
          flex-shrink: 0;
          opacity: 0;
          transition: opacity 0.2s;
        }
        .progress-card:hover .progress-play { opacity: 1; }
        .dashboard-empty {
          text-align: center;
          padding: 4rem 0;
          color: var(--color-brand-muted);
          font-family: var(--font-body);
        }
        .browse-btn {
          display: inline-block;
          margin-top: 1rem;
          font-family: var(--font-body);
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--color-brand-black);
          background: var(--color-brand-accent);
          padding: 0.65rem 1.5rem;
          border-radius: 4px;
          text-decoration: none;
        }
      `}</style>
    </>
  );
}
