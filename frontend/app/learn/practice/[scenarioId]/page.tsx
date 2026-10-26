import Link from "next/link";
import { Suspense } from "react";
import { SiteHeader } from "../../../components/site-header";
import { SiteFooter } from "../../../components/site-footer";
import { LearningPractice } from "../../../components/learning/learning-practice";
import { learningEnabled } from "@/lib/learning/contracts";
export const metadata = {
  title: "Fictional practice",
  robots: { index: false, follow: false },
};
export default async function PracticePage({
  params,
}: {
  params: Promise<{ scenarioId: string }>;
}) {
  const { scenarioId } = await params;
  return (
    <>
      <SiteHeader />
      <main id="main" className="public-site learning-page">
        <h1>Safe practice</h1>
        {learningEnabled() ? (
          <Suspense fallback={<p role="status">Checking practice access…</p>}>
            <LearningPractice id={scenarioId} />
          </Suspense>
        ) : (
          <p>
            Practice is not enabled. <Link href="/help">Visit the Help Centre</Link>.
          </p>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
