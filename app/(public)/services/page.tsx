import Link from "next/link";
import type { Metadata } from "next";
import JsonLd from "@/components/json-ld";
import { servicesSchema } from "@/lib/seo/structured-data";
import "./services.css";

export const metadata: Metadata = {
  title: "Services — Brand Films, Commercials & Campaigns",
  description:
    "AI-native film production for brands: commercials, brand identity films, multi-asset campaigns, and case-study documentaries. Cinema-grade craft at a fraction of traditional cost.",
  alternates: { canonical: "/services" },
};

const SERVICES = [
  {
    num: "01",
    title: "Commercials",
    lede: "Brand films that don't feel like ads.",
    body: "Short-form work built on story first — the product earns its place in the frame instead of interrupting it. Delivered in the formats you actually need, from 60-second hero cuts to vertical social edits.",
  },
  {
    num: "02",
    title: "Brand Identity Films",
    lede: "Who you are, in motion.",
    body: "The film a company shows when words aren't enough — founder stories, manifestos, culture pieces. Made for the moments where a brand has to be felt rather than explained.",
  },
  {
    num: "03",
    title: "Campaigns",
    lede: "One idea, every surface.",
    body: "Multi-asset campaigns built from a single creative spine, so the launch film, the cutdowns, and the social variants all read as one thing. Conceived together, not retrofitted.",
  },
  {
    num: "04",
    title: "Case Study Films",
    lede: "Proof, told properly.",
    body: "Documentary-style films that show real outcomes and the people behind them. Built for sales conversations, investor rooms, and anywhere a claim needs a face.",
  },
];

export default function ServicesPage() {
  return (
    <main className="sv">
      <JsonLd data={servicesSchema()} />

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="sv-hero">
        <div className="container-app sv-hero-inner">
          <span className="sv-eyebrow">What We Make</span>
          <h1 className="sv-hero-title">
            Cinema-grade work,<br />
            <em className="sv-hero-accent">without the cinema budget.</em>
          </h1>
          <p className="sv-hero-desc">
            We make brand films, commercials, and campaigns with the same standard we hold
            our own work to. AI is the tool. Craft is still the point.
          </p>
          <p className="sv-hero-secondary">For brands, agencies, and founders.</p>
        </div>
      </section>

      {/* ── Service lines ────────────────────────────────── */}
      <section className="sv-list-sect">
        <div className="container-app">
          <span className="sv-eyebrow">&mdash; Service Lines</span>
          <ol className="sv-list">
            {SERVICES.map((s) => (
              <li key={s.num} className="sv-item">
                <span className="sv-item-num" aria-hidden="true">{s.num}</span>
                <div className="sv-item-content">
                  <h2 className="sv-item-title">{s.title}</h2>
                  <p className="sv-item-lede">{s.lede}</p>
                  <p className="sv-item-body">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Why AI-native ────────────────────────────────── */}
      <section className="sv-why-sect">
        <div className="container-app sv-why-grid">
          <div className="sv-why-col">
            <span className="sv-eyebrow">&mdash; Why It Works</span>
            <h2 className="sv-h2">Ten ideas for the price of one.</h2>
            <p className="sv-body-p">
              Traditional production forces a single expensive bet. AI-native production
              collapses the cost of iteration &mdash; so we can explore several directions,
              show you real footage instead of mood boards, and refine from there.
            </p>
          </div>
          <div className="sv-why-divider" aria-hidden="true" />
          <div className="sv-why-col">
            <span className="sv-eyebrow">&mdash; What Stays the Same</span>
            <h2 className="sv-h2">The standard.</h2>
            <p className="sv-body-p">
              No wasted shots. No filler. Every creative decision serves the story and
              nothing else. The tools changed &mdash; the bar didn&apos;t.
            </p>
          </div>
        </div>
      </section>

      {/* ── Process ──────────────────────────────────────── */}
      <section className="sv-process-sect">
        <div className="container-app">
          <span className="sv-eyebrow">&mdash; How It Runs</span>
          <div className="sv-process-list">
            <div className="sv-process-row sv-process-row--first">
              <h3 className="sv-process-label">Brief</h3>
              <p className="sv-process-desc">
                We start with the outcome, not the shot list. What has to change in the
                viewer&apos;s head by the end &mdash; and what would make them believe it.
              </p>
            </div>
            <div className="sv-process-row">
              <h3 className="sv-process-label">Direction</h3>
              <p className="sv-process-desc">
                You see real frames early, not sketches. Choosing a direction from actual
                footage removes the guesswork that usually costs a reshoot.
              </p>
            </div>
            <div className="sv-process-row">
              <h3 className="sv-process-label">Delivery</h3>
              <p className="sv-process-desc">
                Final film plus every cutdown and aspect ratio you need, ready for the
                channels you&apos;re actually running.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section className="sv-cta-sect">
        <div className="container-app sv-cta-inner">
          <span className="sv-eyebrow">&mdash; Start Here</span>
          <h2 className="sv-cta-title">Tell us what you&apos;re making.</h2>
          <p className="sv-cta-desc">
            Send the brief &mdash; or just the idea.<br />
            We&apos;ll tell you honestly whether we&apos;re the right studio for it.
          </p>
          <div className="sv-cta-row">
            <Link href="/contact" className="sv-btn-primary">Start a Project</Link>
            <Link href="/works" className="sv-btn-ghost">See Our Work</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
