/* eslint-disable @next/next/no-html-link-for-pages -- Recovery from a missing route should use a full document navigation. */
import { SiteHeader } from "./components/site-header";
import { SiteFooter } from "./components/site-footer";
import "./not-found.css";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="public-site missing-page">
        <div className="missing-page__inner">
          <div className="missing-page__mark" aria-hidden="true" />
          <p className="eyebrow">Page unavailable · 404</p>
          <h1>We couldn’t find that page.</h1>
          <p className="missing-page__description">
            The link may be out of date, or the address may have changed. You can continue
            from one of these pages.
          </p>
          <div className="missing-page__actions">
            <a className="button" href="/">
              Return home
            </a>
            <a className="button secondary" href="/services">
              Explore services
            </a>
          </div>
          <p className="missing-page__help">
            Looking for something specific? <a href="/help">Visit the Help Centre</a>.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
