import { loadPublicSeed } from "@/lib/api/public-seed-server";
import { parseProducts } from "@/lib/api/commerce-schemas";
import { publicPageMetadata, type SearchParameters } from "@/lib/seo";
import type { Metadata } from "next";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { PartsCatalogue } from "../components/parts-catalogue";
export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParameters;
}): Promise<Metadata> {
  const metadata = await publicPageMetadata(
    "Shop vehicle parts",
    "Browse Allied AutoTech parts. Search by name, brand or vehicle compatibility and check availability before collection in Port Harcourt.",
    "/parts",
    searchParams,
  );
  const seed = await loadPublicSeed("/public/catalog/products?limit=12", parseProducts);
  return seed.error ? { ...metadata, robots: { index: false, follow: false } } : metadata;
}
export default async function PartsPage() {
  const initial = await loadPublicSeed(
    "/public/catalog/products?limit=12",
    parseProducts,
  );
  return (
    <>
      <SiteHeader />
      <main id="main" className="section">
        <div className="container">
          <h1>The right part. Your next move.</h1>
          <p className="lead">
            Search our current catalogue and review compatibility for your vehicle.
          </p>
          <PartsCatalogue initial={initial} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
