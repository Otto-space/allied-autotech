import { loadPublicSeed } from "@/lib/api/public-seed-server";
import { parsePublicReviews } from "@/lib/api/review-schemas";
import { publicPageMetadata, type SearchParameters } from "@/lib/seo";
import type { Metadata } from "next";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { PublicReviews } from "../components/public-reviews";
export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParameters;
}): Promise<Metadata> {
  const metadata = await publicPageMetadata(
    "Customer reviews",
    "Read approved Allied AutoTech customer feedback about services, parts, orders and vehicle purchases.",
    "/reviews",
    searchParams,
  );
  const seed = await loadPublicSeed(
    "/public/support/reviews?limit=20",
    parsePublicReviews,
  );
  return seed.error ? { ...metadata, robots: { index: false, follow: false } } : metadata;
}
export default async function Page() {
  const initial = await loadPublicSeed(
    "/public/support/reviews?limit=20",
    parsePublicReviews,
  );
  return (
    <>
      <SiteHeader />
      <main id="main" className="section">
        <div className="container narrow">
          <h1>Customer reviews</h1>
          <PublicReviews initial={initial} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
