import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="section">
      <div className="container narrow">
        <h1>We couldn’t find that page.</h1>
        <p className="lead">It may have moved or may no longer be available.</p>
        <div className="actions">
          <Link className="button" href="/">
            Return home
          </Link>
          <Link className="button secondary" href="/services">
            Explore services
          </Link>
        </div>
      </div>
    </main>
  );
}
