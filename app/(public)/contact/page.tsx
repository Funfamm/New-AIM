"use client";

import { useState, useRef } from "react";
import { submitContactForm } from "@/lib/actions/contact";
import "./contact.css";

export default function ContactPage() {
  const [status, setStatus]     = useState<"idle" | "sending" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");
    const result = await submitContactForm(new FormData(e.currentTarget));
    if (result.ok) {
      setStatus("done");
      formRef.current?.reset();
    } else {
      setStatus("error");
      setErrorMsg(result.error ?? "Something went wrong. Please try again.");
    }
  }

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

        {status === "done" ? (
          <div className="contact-success">
            <p className="contact-success-title">Message sent.</p>
            <p className="contact-success-body">We&apos;ll be in touch within 48 hours.</p>
            <button className="form-submit" onClick={() => setStatus("idle")}>
              Send another message
            </button>
          </div>
        ) : (
          <form className="contact-form" onSubmit={handleSubmit} ref={formRef}>
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
                  required
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
                  required
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
                required
              />
            </div>

            {status === "error" && (
              <p className="form-error">{errorMsg}</p>
            )}

            <div className="form-footer">
              <button type="submit" className="form-submit" disabled={status === "sending"}>
                {status === "sending" ? "Sending…" : "Send Message"}
              </button>
              <p className="form-note">
                For urgent matters, email us directly:{" "}
                <a href="mailto:aimstudio@impactaistudio.com" className="form-note-link">
                  aimstudio@impactaistudio.com
                </a>
                <br />
                We typically respond within 48 hours.
              </p>
            </div>
          </form>
        )}

      </div>
    </main>
  );
}
