import type { Metadata } from "next";
export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <main className="contact-page">
      <div className="container-app">
        <div className="contact-header">
          <span className="contact-eyebrow">Get In Touch</span>
          <h1 className="contact-title">Contact Us</h1>
          <p className="contact-subtitle">
            Questions, collaborations, or press enquiries — we'd love to hear from you.
          </p>
        </div>

        <div className="contact-layout">
          {/* Info */}
          <div className="contact-info">
            {[
              { label: "General", value: "hello@aimstudio.com" },
              { label: "Press", value: "press@aimstudio.com" },
              { label: "Creators", value: "creators@aimstudio.com" },
            ].map((item) => (
              <div key={item.label} className="contact-info-item">
                <span className="contact-info-label">{item.label}</span>
                <a href={`mailto:${item.value}`} className="contact-info-value">{item.value}</a>
              </div>
            ))}
          </div>

          {/* Form placeholder — Phase 3 will wire this up */}
          <form className="contact-form" onSubmit={(e) => e.preventDefault()}>
            <div className="form-group">
              <label className="form-label">Name</label>
              <input type="text" className="form-input" placeholder="Your name" />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-input" placeholder="your@email.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Message</label>
              <textarea className="form-textarea" rows={5} placeholder="Your message..." />
            </div>
            <button type="submit" className="form-submit">Send Message</button>
          </form>
        </div>
      </div>

      <style>{`
        .contact-page { padding: 4rem 0 8rem; }
        .contact-header { padding: 2rem 0 3rem; max-width: 520px; }
        .contact-eyebrow {
          display: block;
          font-family: var(--font-body);
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--color-brand-accent);
          margin-bottom: 0.75rem;
        }
        .contact-title {
          font-family: var(--font-display);
          font-size: clamp(2rem, 5vw, 3rem);
          font-weight: 900;
          color: var(--color-brand-white);
          margin: 0 0 0.75rem;
        }
        .contact-subtitle {
          font-family: var(--font-body);
          font-size: 0.95rem;
          color: var(--color-brand-muted);
          line-height: 1.65;
          margin: 0;
        }
        .contact-layout {
          display: flex;
          flex-direction: column;
          gap: 3rem;
        }
        @media (min-width: 768px) {
          .contact-layout { flex-direction: row; gap: 4rem; }
        }
        .contact-info { display: flex; flex-direction: column; gap: 1.5rem; min-width: 200px; }
        .contact-info-label {
          display: block;
          font-family: var(--font-body);
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--color-brand-muted);
          margin-bottom: 0.3rem;
        }
        .contact-info-value {
          font-family: var(--font-body);
          font-size: 0.9rem;
          color: var(--color-brand-accent);
          text-decoration: none;
          transition: opacity 0.2s;
        }
        .contact-info-value:hover { opacity: 0.75; }
        .contact-form { flex: 1; display: flex; flex-direction: column; gap: 1.25rem; max-width: 520px; }
        .form-group { display: flex; flex-direction: column; gap: 0.4rem; }
        .form-label {
          font-family: var(--font-body);
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--color-brand-light);
          letter-spacing: 0.03em;
        }
        .form-input, .form-textarea {
          font-family: var(--font-body);
          font-size: 0.9rem;
          color: var(--color-brand-white);
          background: var(--color-brand-surface);
          border: 1px solid var(--color-brand-border);
          border-radius: 5px;
          padding: 0.65rem 0.9rem;
          outline: none;
          transition: border-color 0.2s;
          resize: vertical;
          width: 100%;
          box-sizing: border-box;
        }
        .form-input::placeholder, .form-textarea::placeholder { color: var(--color-brand-muted); }
        .form-input:focus, .form-textarea:focus { border-color: var(--color-brand-accent); }
        .form-submit {
          align-self: flex-start;
          font-family: var(--font-body);
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--color-brand-black);
          background: var(--color-brand-accent);
          border: none;
          padding: 0.75rem 2rem;
          border-radius: 4px;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .form-submit:hover { opacity: 0.85; }
      `}</style>
    </main>
  );
}
