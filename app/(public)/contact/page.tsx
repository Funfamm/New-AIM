import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact — AIM Studio",
  description: "For partnerships, press, casting, or just to say hi. We read every message.",
};

export default function ContactPage() {
  return (
    <main className="contact-page">
      <div className="container-app">

        <div className="contact-header">
          <span className="contact-eyebrow">— Get in Touch</span>
          <h1 className="contact-title">Get in Touch</h1>
          <p className="contact-subtitle">
            For partnerships, press, casting, or just to say hi.
          </p>
          <p className="contact-intro">
            We read every message. We can&apos;t always reply immediately,
            but if your message matters &mdash; we&apos;ll see it.
          </p>
        </div>

        <form className="contact-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="cf-name" className="form-label">Name</label>
              <input
                id="cf-name"
                type="text"
                name="name"
                className="form-input"
                placeholder="Your name"
                autoComplete="name"
              />
            </div>
            <div className="form-group">
              <label htmlFor="cf-email" className="form-label">Email</label>
              <input
                id="cf-email"
                type="email"
                name="email"
                className="form-input"
                placeholder="your@email.com"
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="cf-subject" className="form-label">What&apos;s this about?</label>
            <select id="cf-subject" name="subject" className="form-select">
              <option value="">Select a topic…</option>
              <option value="general">General</option>
              <option value="press">Press</option>
              <option value="partnerships">Partnerships</option>
              <option value="casting">Casting</option>
              <option value="support">Support</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="cf-message" className="form-label">Message</label>
            <textarea
              id="cf-message"
              name="message"
              className="form-textarea"
              rows={6}
              placeholder="Your message…"
            />
          </div>

          <div className="form-footer">
            <button type="submit" className="form-submit">Send Message</button>
            <p className="form-note">
              For urgent matters, email us directly:{" "}
              <a href="mailto:hello@impactaistudio.com" className="form-note-link">
                hello@impactaistudio.com
              </a>
              <br />
              We typically respond within 48 hours.
            </p>
          </div>
        </form>

      </div>

      <style>{`
        .contact-page { padding: 4rem 0 8rem; }

        .contact-header { padding-bottom: 3rem; max-width: 560px; }
        .contact-eyebrow {
          display: block;
          font-family: var(--font-body);
          font-size: 0.6875rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--color-brand-accent);
          margin-bottom: 1rem;
        }
        .contact-title {
          font-family: var(--font-display);
          font-size: clamp(2rem, 5vw, 3rem);
          font-weight: 700;
          letter-spacing: -0.02em;
          color: var(--color-brand-white);
          margin: 0 0 0.75rem;
          line-height: 1.1;
        }
        .contact-subtitle {
          font-family: var(--font-body);
          font-size: 1rem;
          color: var(--color-brand-light);
          line-height: 1.6;
          margin: 0 0 0.75rem;
          opacity: 0.85;
        }
        .contact-intro {
          font-family: var(--font-body);
          font-size: 0.9rem;
          color: var(--color-brand-muted);
          line-height: 1.65;
          margin: 0;
        }

        /* ── Form ── */
        .contact-form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          max-width: 640px;
        }
        .form-row {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        @media (min-width: 640px) {
          .form-row { flex-direction: row; gap: 1rem; }
          .form-row .form-group { flex: 1; }
        }
        .form-group { display: flex; flex-direction: column; gap: 0.4rem; }
        .form-label {
          font-family: var(--font-body);
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--color-brand-light);
          letter-spacing: 0.03em;
        }
        .form-input,
        .form-select,
        .form-textarea {
          font-family: var(--font-body);
          font-size: 0.9rem;
          color: var(--color-brand-white);
          background: var(--color-brand-surface);
          border: 1px solid var(--color-brand-border);
          border-radius: 2px;
          padding: 0.7rem 0.9rem;
          outline: none;
          transition: border-color 0.15s;
          width: 100%;
          box-sizing: border-box;
        }
        .form-select {
          appearance: none;
          -webkit-appearance: none;
          cursor: pointer;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236b7280' stroke-width='1.5' stroke-linecap='round' fill='none'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.9rem center;
          padding-right: 2.5rem;
        }
        .form-textarea { resize: vertical; min-height: 140px; }
        .form-input::placeholder,
        .form-textarea::placeholder { color: var(--color-brand-muted); }
        .form-select option { background: var(--color-brand-surface); color: var(--color-brand-white); }
        .form-input:focus,
        .form-select:focus,
        .form-textarea:focus { border-color: var(--color-brand-accent); }

        .form-footer {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        @media (min-width: 640px) {
          .form-footer { flex-direction: row; align-items: flex-start; gap: 2rem; }
        }
        .form-submit {
          flex-shrink: 0;
          font-family: var(--font-body);
          font-size: 0.875rem;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: var(--color-brand-black);
          background: var(--color-brand-accent);
          border: none;
          height: 52px;
          padding: 0 2rem;
          border-radius: 2px;
          cursor: pointer;
          transition: filter 0.2s;
        }
        .form-submit:hover { filter: brightness(1.06); }
        .form-note {
          font-family: var(--font-body);
          font-size: 0.8rem;
          color: var(--color-brand-muted);
          line-height: 1.65;
          margin: 0;
          padding-top: 0.25rem;
        }
        .form-note-link {
          color: var(--color-brand-accent);
          text-decoration: none;
        }
        .form-note-link:hover { text-decoration: underline; }
      `}</style>
    </main>
  );
}
