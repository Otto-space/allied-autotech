"use client";
import Link from "next/link";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main" className="section">
      <div className="container narrow">
        <h1>We couldn’t load this page.</h1>
        <p className="lead">
          The information is temporarily unavailable. Please retry or contact our team for
          help.
        </p>
        <div className="actions">
          <button className="button" onClick={reset}>
            Try again
          </button>
          <Link className="button secondary" href="/contact">
            Contact Allied AutoTech
          </Link>
          <Link className="text-link" href="/">
            Return home
          </Link>
        </div>
      </div>
    </main>
  );
}
