import Link from "next/link";
import { auth } from "@/lib/auth";
import SubscribeForm from "./subscribe-form";
import "./footer.css";

export default async function Footer() {
  const session = await auth();
  const isGuest = !session?.user;

  return (
    <footer className="footer">
      <div className="container-app">

        {/* ── Subscribe strip — guests only ── */}
        {isGuest && (
          <div className="footer-subscribe">
            <div className="footer-sub-text">
              <h2 className="footer-sub-heading">Stay close to the stories.</h2>
              <p className="footer-sub-body">
                Get new films, trailers, and AIM Studio updates when they go live.
              </p>
            </div>
            <SubscribeForm />
          </div>
        )}

        <div className="footer-inner">
          <div className="footer-brand">
            <span className="footer-logo">AIM<span>Studio</span></span>
            <p className="footer-tagline">
              Stories that refuse to look away.
            </p>
          </div>
          <nav className="footer-links">
            <Link href="/works">Works</Link>
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/login">Sign In</Link>
          </nav>
        </div>

        <div className="footer-bottom">
          <span className="footer-motto">DON&apos;T LOOK AWAY.</span>
          <span className="footer-copy">© {new Date().getFullYear()} AIM Studio · Cinema, reimagined.</span>
        </div>
      </div>
    </footer>
  );
}
