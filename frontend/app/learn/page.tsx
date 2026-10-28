import Link from "next/link";
import { Suspense } from "react";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { LearningPanel } from "../components/learning/learning-panel";
import { learningEnabled } from "@/lib/learning/contracts";
export const metadata = {
  title: "Help & Learn",
  robots: { index: false, follow: false },
};
export default function LearnPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="public-site learning-page">
        <header>
          <nav className="learning-breadcrumb" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden="true"> / </span>
            <Link href="/help">Help centre</Link>
            <span aria-hidden="true"> / </span>
            <span aria-current="page">Help &amp; Learn</span>
          </nav>
          <h1>Help & Learn</h1>
          <p>Answers, a little guidance and room to practise.</p>
        </header>
        {learningEnabled() ? (
          <Suspense fallback={<p role="status">Loading available learning…</p>}>
            <LearningPanel />
          </Suspense>
        ) : (
          <p>
            Help & Learn is not enabled. Visit the <Link href="/help">Help Centre</Link>.
          </p>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
