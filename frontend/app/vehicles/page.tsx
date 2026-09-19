import { loadPublicSeed } from "@/lib/api/public-seed-server";
import { parseListings } from "@/lib/api/vehicle-schemas";
import { publicPageMetadata, type SearchParameters } from "@/lib/seo";
import type { Metadata } from "next";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { VehicleCatalogue } from "../components/vehicle-catalogue";
export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParameters;
}): Promise<Metadata> {
  const metadata = await publicPageMetadata(
    "Browse vehicles",
    "Browse current Allied AutoTech vehicle listings in Port Harcourt, compare details and request an inspection.",
    "/vehicles",
    searchParams,
  );
  const seed = await loadPublicSeed("/public/vehicles?limit=12", parseListings);
  return seed.error ? { ...metadata, robots: { index: false, follow: false } } : metadata;
}
export default async function VehiclesPage() {
  const initial = await loadPublicSeed("/public/vehicles?limit=12", parseListings);
  return (
    <>
      <SiteHeader />
      <main id="main" className="section">
        <div className="container">
          <h1>A new chapter starts here.</h1>
          <p className="lead">
            Browse current vehicle listings, explore the details and arrange a closer
            look.
          </p>
          <VehicleCatalogue initial={initial} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
