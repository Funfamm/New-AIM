import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — AIM Studio",
  description: "Cinema for the moments we can't take back. Why AIM Studio exists.",
};

export default function AboutPage() {
  return (
    <main className="ab">

      {/* ── 1. Hero ─────────────────────────────────────────────── */}
      <section className="ab-hero">
        <div className="container-app ab-hero-inner">
          <span className="ab-eyebrow">Who We Are</span>
          <h1 className="ab-hero-title">
            We make films about
            <br />
            <em className="ab-hero-accent">what we almost lost.</em>
          </h1>
          <div className="ab-hero-rule" aria-hidden="true" />
        </div>
      </section>

      {/* ── 2. Manifesto Card ───────────────────────────────────── */}
      <section className="ab-manifesto-sect">
        <div className="container-app">
          <div className="ab-manifesto-card">
            <div className="ab-manifesto-bar" aria-hidden="true" />
            <div className="ab-manifesto-inner">
              <span className="ab-manifesto-deco" aria-hidden="true">&ldquo;</span>
              <p className="ab-manifesto-p">
                The technology has caught up to imagination. The barriers between idea
                and execution are falling. The question is no longer &ldquo;who gets to
                make films?&rdquo; &mdash; it&apos;s &ldquo;what stories will we choose to tell?&rdquo;
              </p>
              <p className="ab-manifesto-p">
                AIM Studio is the answer. We&apos;re building the platform where
                AI-native filmmakers create, where audiences discover work that
                wouldn&apos;t have existed otherwise, and where the next generation of
                storytellers gets their start.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Vision ───────────────────────────────────────────── */}
      <section className="ab-vision-sect">
        <div className="container-app">
          <div className="ab-vision-layout">
            <div className="ab-vision-left">
              <span className="ab-eyebrow">— The Vision</span>
              <h2 className="ab-h2">
                Cinema for the moments<br />
                we can&apos;t take back.
              </h2>
            </div>
            <div className="ab-vision-right">
              <p className="ab-body-p">
                This isn&apos;t about replacing traditional cinema. It&apos;s about expanding
                what cinema can be. Every story too small for Hollywood, too personal for
                a studio, too honest for a committee &mdash; that&apos;s where we start.
              </p>
              <p className="ab-body-p ab-body-p--gap">
                We make films that wouldn&apos;t have existed otherwise. That&apos;s not a
                marketing line. That&apos;s a standard we hold ourselves to every time we
                begin a new project.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Three Pillars — numbered editorial list ──────────── */}
      <section className="ab-pillars-sect">
        <div className="container-app">
          <span className="ab-eyebrow">— Three Principles</span>
          <ol className="ab-pillar-list">
            <li className="ab-pillar-item">
              <span className="ab-pillar-num" aria-hidden="true">01</span>
              <div className="ab-pillar-content">
                <h3 className="ab-pillar-title">Stories That Matter</h3>
                <p className="ab-pillar-body">
                  Every film we make has to matter &mdash; to someone, somewhere.
                  We don&apos;t make content. We make cinema. The difference is intent.
                </p>
              </div>
            </li>
            <li className="ab-pillar-item">
              <span className="ab-pillar-num" aria-hidden="true">02</span>
              <div className="ab-pillar-content">
                <h3 className="ab-pillar-title">No Story Too Small</h3>
                <p className="ab-pillar-body">
                  The personal is universal. The micro is the macro. If the story is
                  true, it belongs on screen &mdash; no matter the budget or the scale.
                </p>
              </div>
            </li>
            <li className="ab-pillar-item">
              <span className="ab-pillar-num" aria-hidden="true">03</span>
              <div className="ab-pillar-content">
                <h3 className="ab-pillar-title">Every Frame, On Purpose</h3>
                <p className="ab-pillar-body">
                  No wasted shots. No filler. Every creative decision serves the story
                  and nothing else. Craft is the only standard we accept.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      {/* ── 5. Mission & Story ──────────────────────────────────── */}
      <section className="ab-mission-sect">
        <div className="container-app ab-mission-grid">
          <div className="ab-mission-col">
            <span className="ab-eyebrow">— Our Mission</span>
            <h2 className="ab-h2 ab-h2--sm">Why we exist.</h2>
            <p className="ab-body-p">
              Hollywood spends 100 million dollars to make one film.
              We can make ten with the same vision and a fraction of the cost.
            </p>
            <p className="ab-body-p ab-body-p--gap">
              We don&apos;t make films for our audience. We make them with our audience.
              From casting to scripts to feedback &mdash; your voice shapes what we make next.
            </p>
          </div>
          <div className="ab-mission-divider" aria-hidden="true" />
          <div className="ab-mission-col">
            <span className="ab-eyebrow">— Our Story</span>
            <h2 className="ab-h2 ab-h2--sm">Where it started.</h2>
            <p className="ab-body-p">
              AIM Studio was built by a filmmaker tired of waiting for permission.
              The tools existed. The audience existed. The only question was what to make.
            </p>
            <p className="ab-body-p ab-body-p--gap">
              Free to watch. Available globally. The barriers to seeing great films
              should not exist &mdash; and with AIM Studio, they don&apos;t.
            </p>
          </div>
        </div>
      </section>

      {/* ── 6. Philosophy Quote ─────────────────────────────────── */}
      <section className="ab-quote-sect">
        <div className="container-app ab-quote-wrap">
          <span className="ab-quote-deco" aria-hidden="true">&ldquo;</span>
          <blockquote className="ab-blockquote">
            I started AIM Studio because I was tired of waiting for permission.
            The tools exist now. The audience exists now.
            The only question left is: what do we make?
          </blockquote>
          <p className="ab-quote-attr">— Founder, AIM Studio</p>
        </div>
      </section>

      {/* ── 7. Journey Timeline ─────────────────────────────────── */}
      <section className="ab-journey-sect">
        <div className="container-app">
          <span className="ab-eyebrow">— The Journey</span>
          <h2 className="ab-h2 ab-h2--sm">How we got here.</h2>
          <ol className="ab-timeline">
            <li className="ab-tl-item">
              <span className="ab-tl-year">2024</span>
              <div className="ab-tl-content">
                <h3 className="ab-tl-title">The Vision</h3>
                <p className="ab-tl-body">
                  A filmmaker with a dream and no permission. The tools existed.
                  The question was what to do with them.
                </p>
              </div>
            </li>
            <li className="ab-tl-item">
              <span className="ab-tl-year">2025</span>
              <div className="ab-tl-content">
                <h3 className="ab-tl-title">First Showcases</h3>
                <p className="ab-tl-body">
                  The first films premiered. Real stories. Real audience.
                  No Hollywood gate required.
                </p>
              </div>
            </li>
            <li className="ab-tl-item ab-tl-item--last">
              <span className="ab-tl-year">2026</span>
              <div className="ab-tl-content">
                <h3 className="ab-tl-title">The Platform</h3>
                <p className="ab-tl-body">
                  AIM Studio opens as a platform &mdash; built for creators,
                  open to audiences, available worldwide.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      {/* ── 8. Core Values — manifesto rows ─────────────────────── */}
      <section className="ab-values-sect">
        <div className="container-app">
          <span className="ab-eyebrow">— What We Stand For</span>
          <div className="ab-values-list">
            <div className="ab-value-row ab-value-row--first">
              <h3 className="ab-value-label">Stories That Matter</h3>
              <p className="ab-value-desc">
                Every film has to matter &mdash; to someone, somewhere. We don&apos;t chase
                trends or build for algorithms. We build work that endures long after
                the moment that created it.
              </p>
            </div>
            <div className="ab-value-row">
              <h3 className="ab-value-label">No Story Too Small</h3>
              <p className="ab-value-desc">
                The personal is universal. We have never turned away a true story for
                being too small, too quiet, or too niche. Too small is exactly where
                the real things live.
              </p>
            </div>
            <div className="ab-value-row">
              <h3 className="ab-value-label">Every Frame, On Purpose</h3>
              <p className="ab-value-desc">
                Craft is the commitment. No wasted shots, no filler content, no
                shortcuts that betray the story. Every creative decision is deliberate.
                Every frame is earned.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 9. CTA ──────────────────────────────────────────────── */}
      <section className="ab-cta-sect">
        <div className="container-app ab-cta-inner">
          <span className="ab-eyebrow">— Be Part of It</span>
          <h2 className="ab-cta-title">Be Part of<br className="ab-cta-br" /> Something Big</h2>
          <p className="ab-cta-desc">
            Watch for free. Share what moves you.<br className="ab-cta-br" />
            Help shape what we make next.<br />
            The audience is the studio now.
          </p>
          <div className="ab-cta-row">
            <Link href="/register" className="ab-btn-primary">Join the Community</Link>
            <Link href="/works" className="ab-btn-ghost">Browse Our Work</Link>
          </div>
        </div>
      </section>

      <style>{`
        /* ─────────────────────────────────────────────
           SHARED TOKENS
        ───────────────────────────────────────────── */
        .ab { padding-bottom: 0; }

        .ab-eyebrow {
          display: block;
          font-family: var(--font-body); font-size: 0.6875rem; font-weight: 600;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--color-brand-muted); margin-bottom: 1.5rem;
        }

        .ab-h2 {
          font-family: var(--font-display);
          font-size: clamp(1.875rem, 4vw, 2.75rem);
          font-weight: 700; letter-spacing: -0.025em; line-height: 1.12;
          color: var(--color-brand-white); margin: 0 0 2rem;
        }
        .ab-h2--sm {
          font-size: clamp(1.5rem, 3vw, 2rem);
          margin-bottom: 1.5rem;
        }

        .ab-body-p {
          font-family: var(--font-body); font-size: 1rem;
          color: var(--color-brand-light); line-height: 1.8;
          opacity: 0.85; margin: 0;
        }
        .ab-body-p--gap { margin-top: 1.5rem; }

        /* ─────────────────────────────────────────────
           1. HERO
        ───────────────────────────────────────────── */
        .ab-hero {
          position: relative;
          overflow: hidden;
          padding: 7rem 0 6rem;
          border-bottom: 1px solid var(--color-brand-border);
        }
        @media (min-width: 768px) { .ab-hero { padding: 9rem 0 7rem; } }

        /* Golden orb — top right */
        .ab-hero::before {
          content: "";
          position: absolute; top: -15%; right: -8%;
          width: 65vw; max-width: 680px;
          height: 65vw; max-height: 680px;
          background: radial-gradient(circle,
            rgba(232,201,126,0.11) 0%,
            rgba(232,201,126,0.04) 40%,
            transparent 68%
          );
          pointer-events: none; z-index: 0;
        }
        /* Faint secondary orb — bottom left */
        .ab-hero::after {
          content: "";
          position: absolute; bottom: -20%; left: -6%;
          width: 45vw; max-width: 420px;
          height: 45vw; max-height: 420px;
          background: radial-gradient(circle,
            rgba(232,201,126,0.05) 0%,
            transparent 65%
          );
          pointer-events: none; z-index: 0;
        }

        .ab-hero-inner { position: relative; z-index: 1; max-width: 900px; }

        .ab-hero-title {
          font-family: var(--font-display);
          font-size: clamp(3rem, 8vw, 6.5rem);
          font-weight: 700; letter-spacing: -0.035em; line-height: 1.04;
          color: var(--color-brand-white); margin: 0;
        }
        .ab-hero-accent {
          font-style: italic;
          color: var(--color-brand-accent);
        }
        .ab-hero-rule {
          width: 56px; height: 2px;
          background: var(--color-brand-accent);
          margin-top: 2.5rem;
        }

        /* ─────────────────────────────────────────────
           2. MANIFESTO CARD
        ───────────────────────────────────────────── */
        .ab-manifesto-sect {
          padding: 5rem 0;
          background: linear-gradient(140deg, #111117 0%, #0d0d11 45%, #0a0a0a 100%);
          border-bottom: 1px solid var(--color-brand-border);
        }
        @media (min-width: 768px) { .ab-manifesto-sect { padding: 6rem 0; } }

        .ab-manifesto-card {
          display: flex;
          max-width: 820px;
          background: rgba(255,255,255,0.035);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 4px; overflow: hidden;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.07),
            0 24px 48px rgba(0,0,0,0.45);
        }
        .ab-manifesto-bar {
          flex-shrink: 0; width: 3px;
          background: var(--color-brand-accent);
        }
        .ab-manifesto-inner {
          padding: 2rem; flex: 1; position: relative;
        }
        @media (min-width: 768px) { .ab-manifesto-inner { padding: 2.5rem 3rem; } }

        .ab-manifesto-deco {
          font-family: var(--font-display);
          font-size: clamp(6rem, 10vw, 10rem);
          line-height: 0.65; color: var(--color-brand-accent);
          opacity: 0.12; display: block; margin-bottom: -1rem;
          user-select: none; pointer-events: none;
          letter-spacing: -0.04em;
        }
        .ab-manifesto-p {
          font-family: var(--font-body); font-size: 1rem;
          color: var(--color-brand-light); line-height: 1.82;
          opacity: 0.9; margin: 0 0 1.5rem;
        }
        .ab-manifesto-p:last-child { margin-bottom: 0; }

        /* ─────────────────────────────────────────────
           3. VISION
        ───────────────────────────────────────────── */
        .ab-vision-sect {
          padding: 5rem 0;
          background: var(--color-brand-dark);
          border-bottom: 1px solid var(--color-brand-border);
        }
        @media (min-width: 768px) { .ab-vision-sect { padding: 6rem 0; } }

        .ab-vision-layout {
          display: flex; flex-direction: column; gap: 3rem;
        }
        @media (min-width: 900px) {
          .ab-vision-layout {
            flex-direction: row; gap: 6rem; align-items: flex-start;
          }
          .ab-vision-left { flex: 0 0 40%; }
          .ab-vision-right { flex: 1; padding-top: 0.25rem; }
        }
        .ab-vision-left .ab-h2 { margin-bottom: 0; }

        /* ─────────────────────────────────────────────
           4. PILLARS — numbered editorial list
        ───────────────────────────────────────────── */
        .ab-pillars-sect {
          padding: 5rem 0;
          border-bottom: 1px solid var(--color-brand-border);
        }
        @media (min-width: 768px) { .ab-pillars-sect { padding: 6rem 0; } }

        .ab-pillar-list { list-style: none; margin: 0; padding: 0; }

        .ab-pillar-item {
          display: flex;
          align-items: flex-start;
          gap: 2rem;
          padding: 2.5rem 0;
          border-top: 1px solid var(--color-brand-border);
        }
        .ab-pillar-item:last-child { border-bottom: 1px solid var(--color-brand-border); }
        @media (min-width: 768px) { .ab-pillar-item { gap: 3.5rem; padding: 3rem 0; } }

        .ab-pillar-num {
          font-family: var(--font-display);
          font-size: clamp(2rem, 4vw, 3.75rem);
          font-weight: 700; letter-spacing: -0.04em; line-height: 1;
          color: var(--color-brand-border);
          flex-shrink: 0; width: 3.5rem;
          padding-top: 0.125rem;
        }
        @media (min-width: 768px) { .ab-pillar-num { width: 5rem; } }

        .ab-pillar-content { flex: 1; }

        .ab-pillar-title {
          font-family: var(--font-display);
          font-size: clamp(1.125rem, 2vw, 1.375rem);
          font-weight: 700; letter-spacing: -0.015em; line-height: 1.3;
          color: var(--color-brand-white); margin: 0 0 0.75rem;
        }
        .ab-pillar-body {
          font-family: var(--font-body); font-size: 0.9375rem;
          color: var(--color-brand-muted); line-height: 1.75; margin: 0;
          max-width: 560px;
        }

        /* ─────────────────────────────────────────────
           5. MISSION & STORY
        ───────────────────────────────────────────── */
        .ab-mission-sect {
          padding: 5rem 0;
          background: var(--color-brand-dark);
          border-bottom: 1px solid var(--color-brand-border);
        }
        @media (min-width: 768px) { .ab-mission-sect { padding: 6rem 0; } }

        .ab-mission-grid {
          display: flex; flex-direction: column; gap: 3rem;
        }
        @media (min-width: 900px) {
          .ab-mission-grid { flex-direction: row; gap: 0; align-items: flex-start; }
          .ab-mission-col { flex: 1; }
        }
        .ab-mission-divider {
          width: 100%; height: 1px;
          background: var(--color-brand-border);
          flex-shrink: 0;
        }
        @media (min-width: 900px) {
          .ab-mission-divider { width: 1px; height: auto; margin: 0 4rem; align-self: stretch; }
        }

        /* ─────────────────────────────────────────────
           6. PHILOSOPHY QUOTE
        ───────────────────────────────────────────── */
        .ab-quote-sect {
          padding: 5rem 0;
          background: radial-gradient(
            ellipse 80% 60% at 50% 50%,
            rgba(232,201,126,0.07) 0%,
            transparent 70%
          );
          border-bottom: 1px solid var(--color-brand-border);
        }
        @media (min-width: 768px) { .ab-quote-sect { padding: 7rem 0; } }

        .ab-quote-wrap { text-align: center; }

        .ab-quote-deco {
          font-family: var(--font-display);
          font-size: clamp(5rem, 12vw, 9rem);
          line-height: 0.75;
          color: var(--color-brand-accent);
          opacity: 0.2;
          display: block;
          margin-bottom: -1.5rem;
          user-select: none; pointer-events: none;
          letter-spacing: -0.04em;
        }

        .ab-blockquote {
          font-family: var(--font-display);
          font-size: clamp(1.25rem, 3vw, 1.875rem);
          font-weight: 600; font-style: italic;
          letter-spacing: -0.015em; line-height: 1.55;
          color: var(--color-brand-white); opacity: 0.92;
          max-width: 700px; margin: 0 auto 2rem;
        }
        .ab-quote-attr {
          font-family: var(--font-body); font-size: 0.875rem;
          color: var(--color-brand-muted); margin: 0;
        }

        /* ─────────────────────────────────────────────
           7. JOURNEY TIMELINE
        ───────────────────────────────────────────── */
        .ab-journey-sect {
          padding: 5rem 0;
          background: var(--color-brand-dark);
          border-bottom: 1px solid var(--color-brand-border);
        }
        @media (min-width: 768px) { .ab-journey-sect { padding: 6rem 0; } }

        .ab-timeline { list-style: none; margin: 0; padding: 0; max-width: 620px; }

        .ab-tl-item { display: flex; align-items: flex-start; gap: 2rem; }

        .ab-tl-year {
          flex-shrink: 0; width: 52px; text-align: right;
          font-family: var(--font-body); font-size: 0.6875rem; font-weight: 600;
          letter-spacing: 0.06em; color: var(--color-brand-muted);
          padding-top: 0.3rem;
        }
        .ab-tl-content {
          flex: 1;
          border-left: 1px solid var(--color-brand-border);
          padding-left: 2rem; padding-bottom: 3rem;
          position: relative;
        }
        .ab-tl-item--last .ab-tl-content { padding-bottom: 0; }
        .ab-tl-content::before {
          content: "";
          position: absolute; left: -5px; top: 5px;
          width: 9px; height: 9px; border-radius: 50%;
          background: var(--color-brand-dark);
          border: 1.5px solid rgba(232,201,126,0.5);
        }
        .ab-tl-title {
          font-family: var(--font-display);
          font-size: 1.125rem; font-weight: 600;
          letter-spacing: -0.01em; line-height: 1.3;
          color: var(--color-brand-white); margin: 0 0 0.5rem;
        }
        .ab-tl-body {
          font-family: var(--font-body); font-size: 0.9375rem;
          color: var(--color-brand-muted); line-height: 1.7; margin: 0;
        }

        /* ─────────────────────────────────────────────
           8. CORE VALUES — manifesto rows
        ───────────────────────────────────────────── */
        .ab-values-sect {
          padding: 5rem 0;
          border-bottom: 1px solid var(--color-brand-border);
        }
        @media (min-width: 768px) { .ab-values-sect { padding: 6rem 0; } }

        .ab-values-list { margin-top: 0; }

        .ab-value-row {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
          padding: 2.5rem 0;
          border-top: 1px solid var(--color-brand-border);
        }
        .ab-value-row:last-child { border-bottom: 1px solid var(--color-brand-border); }
        @media (min-width: 768px) {
          .ab-value-row {
            grid-template-columns: 260px 1fr;
            gap: 4rem; align-items: start;
          }
        }
        /* Gold accent top border on first row */
        .ab-value-row--first {
          border-top: 2px solid rgba(232,201,126,0.35);
        }

        .ab-value-label {
          font-family: var(--font-display);
          font-size: 1.25rem; font-weight: 700;
          letter-spacing: -0.015em; line-height: 1.3;
          color: var(--color-brand-white);
          margin: 0;
        }
        .ab-value-desc {
          font-family: var(--font-body); font-size: 0.9375rem;
          color: var(--color-brand-muted); line-height: 1.78; margin: 0;
        }

        /* ─────────────────────────────────────────────
           9. CTA
        ───────────────────────────────────────────── */
        .ab-cta-sect {
          position: relative; overflow: hidden;
          padding: 6rem 0 7rem;
          background: var(--color-brand-dark);
        }
        @media (min-width: 768px) { .ab-cta-sect { padding: 7rem 0 9rem; } }

        /* Centered golden halo — echoes the hero */
        .ab-cta-sect::before {
          content: "";
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 80vw; max-width: 700px;
          height: 80vw; max-height: 700px;
          background: radial-gradient(circle,
            rgba(232,201,126,0.08) 0%,
            rgba(232,201,126,0.03) 40%,
            transparent 68%
          );
          pointer-events: none; z-index: 0;
        }

        .ab-cta-inner { position: relative; z-index: 1; }

        .ab-cta-title {
          font-family: var(--font-display);
          font-size: clamp(2rem, 5vw, 3.5rem);
          font-weight: 700; letter-spacing: -0.03em; line-height: 1.1;
          color: var(--color-brand-white); margin: 0 0 1.5rem;
          max-width: 560px;
        }
        .ab-cta-desc {
          font-family: var(--font-body); font-size: 1rem;
          color: var(--color-brand-light); opacity: 0.75;
          line-height: 1.75; max-width: 420px; margin: 0 0 2.5rem;
        }
        .ab-cta-br { display: none; }
        @media (min-width: 640px) { .ab-cta-br { display: inline; } }

        .ab-cta-row { display: flex; gap: 1rem; flex-wrap: wrap; }

        .ab-btn-primary {
          display: inline-flex; align-items: center;
          font-family: var(--font-body); font-size: 0.875rem; font-weight: 600;
          letter-spacing: 0.06em; text-transform: uppercase;
          color: var(--color-brand-black); background: var(--color-brand-accent);
          height: 52px; padding: 0 2rem; border-radius: 2px; text-decoration: none;
          transition: filter 0.2s, transform 0.2s; touch-action: manipulation;
        }
        .ab-btn-primary:hover { filter: brightness(1.06); transform: translateY(-2px); }

        .ab-btn-ghost {
          display: inline-flex; align-items: center;
          font-family: var(--font-body); font-size: 0.875rem; font-weight: 500;
          color: var(--color-brand-white);
          border: 1px solid rgba(255,255,255,0.28);
          height: 52px; padding: 0 2rem; border-radius: 2px; text-decoration: none;
          transition: border-color 0.2s, background 0.2s; touch-action: manipulation;
        }
        .ab-btn-ghost:hover {
          border-color: rgba(255,255,255,0.65);
          background: rgba(255,255,255,0.05);
        }
      `}</style>
    </main>
  );
}
