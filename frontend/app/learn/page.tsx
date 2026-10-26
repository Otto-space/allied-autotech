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
          <p className="learning-eyebrow">Understand · Follow · Practise</p>
          <h1>Help & Learn</h1>
        </header>
        {learningEnabled() ? (
          <Suspense fallback={<p role="status">Loading available learning…</p>}>
            <LearningPanel full />
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
