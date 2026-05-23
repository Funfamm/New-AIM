import type { Metadata } from "next";
export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <main className="about-page">
      <div className="container-app">
        <div className="about-hero">
          <span className="about-eyebrow">Our Story</span>
          <h1 className="about-title">Cinema, Reimagined by AI</h1>
          <p className="about-lead">
            AIM Studio is a pioneering platform at the intersection of artificial intelligence
            and cinematic storytelling. We create, distribute, and stream AI-generated films
            that challenge what's possible in modern filmmaking.
          </p>
        </div>

        <div className="about-grid">
          {[
            { num: "01", title: "Our Mission", body: "To democratise filmmaking by using AI to produce high-quality, visually stunning films that tell meaningful stories — without the traditional barriers of cost and production complexity." },
            { num: "02", title: "The Technology", body: "We leverage cutting-edge generative AI models for every stage of production — from script generation and storyboarding to visual synthesis and post-production. Every frame is intentional." },
            { num: "03", title: "The Community", body: "AIM Studio is built for creators, film lovers, and technologists. Our platform gives audiences early access to the future of cinema and gives creators the tools to participate." },
            { num: "04", title: "The Future", body: "We are building toward a world where anyone with a story can produce a film. AIM Studio Lite is our first step — a fast, mobile-first streaming platform for the next generation." },
          ].map((item) => (
            <div key={item.num} className="about-card">
              <span className="about-card-num">{item.num}</span>
              <h2 className="about-card-title">{item.title}</h2>
              <p className="about-card-body">{item.body}</p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .about-page { padding: 4rem 0 8rem; }
        .about-hero {
          max-width: 680px;
          padding: 2rem 0 4rem;
          border-bottom: 1px solid var(--color-brand-border);
          margin-bottom: 4rem;
        }
        .about-eyebrow {
          display: block;
          font-family: var(--font-body);
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--color-brand-accent);
          margin-bottom: 1rem;
        }
        .about-title {
          font-family: var(--font-display);
          font-size: clamp(2.2rem, 6vw, 3.5rem);
          font-weight: 900;
          color: var(--color-brand-white);
          margin: 0 0 1.25rem;
          line-height: 1.1;
        }
        .about-lead {
          font-family: var(--font-body);
          font-size: 1.05rem;
          color: var(--color-brand-light);
          line-height: 1.75;
          opacity: 0.85;
          margin: 0;
        }
        .about-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2rem;
        }
        @media (min-width: 640px)  { .about-grid { grid-template-columns: repeat(2, 1fr); } }
        .about-card {
          padding: 2rem;
          border: 1px solid var(--color-brand-border);
          border-radius: 8px;
          background: var(--color-brand-dark);
          transition: border-color 0.2s;
        }
        .about-card:hover { border-color: var(--color-brand-accent); }
        .about-card-num {
          font-family: var(--font-display);
          font-size: 2.5rem;
          font-weight: 900;
          color: var(--color-brand-border);
          display: block;
          margin-bottom: 0.75rem;
          line-height: 1;
        }
        .about-card-title {
          font-family: var(--font-display);
          font-size: 1.2rem;
          font-weight: 700;
          color: var(--color-brand-white);
          margin: 0 0 0.75rem;
        }
        .about-card-body {
          font-family: var(--font-body);
          font-size: 0.9rem;
          color: var(--color-brand-muted);
          line-height: 1.7;
          margin: 0;
        }
      `}</style>
    </main>
  );
}
