import { loadPublicSeed } from "@/lib/api/public-seed-server";
import { parseVehicleDiscovery } from "@/lib/api/vehicle-schemas";
import { publicPageMetadata, type SearchParameters } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ArrowUpRight } from "lucide-react";
import { business } from "@/lib/business";
import { Suspense } from "react";
import { CatalogueEnquiryLink } from "../components/catalogue-enquiry-link";
import { vehicleApiPath } from "@/lib/vehicle-discovery";
import { vehicleEnquiryHref } from "@/lib/catalogue-enquiry";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { VehicleCatalogue } from "../components/vehicle-catalogue";
import "./vehicles.css";
import "../components/catalogue-discovery.css";
import "../components/catalogue-redesign.css";

async function listingPath(searchParams: SearchParameters) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first) query.set(key, first);
  }
  return vehicleApiPath(query);
}
export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParameters;
}): Promise<Metadata> {
  const metadata = await publicPageMetadata(
    "Browse vehicles",
    "Browse current Allied AutoTech vehicle listings in Port Harcourt, compare published details or discuss your requirements.",
    "/vehicles",
    searchParams,
  );
  const seed = await loadPublicSeed(
    await listingPath(searchParams),
    parseVehicleDiscovery,
  );
  return seed.error ? { ...metadata, robots: { index: false, follow: false } } : metadata;
}
export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: SearchParameters;
}) {
  const cataloguePath = await listingPath(searchParams);
  const enquiryHref = vehicleEnquiryHref(
    new URLSearchParams(cataloguePath.split("?")[1] ?? ""),
  );
  const initial = await loadPublicSeed(cataloguePath, parseVehicleDiscovery);
  const catalogueQuery = new URLSearchParams(cataloguePath.split("?")[1] ?? "");
  const unfiltered = [...catalogueQuery.keys()].every(
    (key) => key === "limit" || key === "sort",
  );
  const emptyCatalogue = unfiltered && !initial.error && initial.data?.totalMatches === 0;
  return (
    <>
      <SiteHeader />
      <main id="main" className="public-site marketplace-site vehicles-page">
        <nav className="public-wrap vehicle-breadcrumb" aria-label="Breadcrumb">
          <ol>
            <li>
              <Link href="/">Home</Link>
            </li>
            <li>
              <ChevronRight size={14} aria-hidden="true" />
              <span aria-current="page">Vehicles</span>
            </li>
          </ol>
        </nav>
        <section className="vehicle-hero" aria-labelledby="vehicle-title">
          <div className="public-wrap vehicle-hero-inner">
            <div className="vehicle-hero-copy">
              <h1 id="vehicle-title">
                {emptyCatalogue
                  ? "Tell us what you’re looking for"
                  : "Explore vehicle listings"}
              </h1>
              <p>
                {emptyCatalogue
                  ? "Share your budget, preferred make and requirements. Our team can discuss your options."
                  : "Compare published specifications and contact our team about a vehicle."}
              </p>
            </div>
          </div>
        </section>
        <section
          className="public-wrap vehicle-inventory"
          id="inventory"
          aria-label="Current vehicle listings"
        >
          <VehicleCatalogue initial={initial} />
        </section>
        <section className="vehicle-contact">
          <div className="public-wrap">
            <div>
              <h2>Discuss a vehicle</h2>
              <p>
                Share your budget, preferred make and requirements, or ask about published
                vehicle details. An enquiry does not reserve a vehicle or confirm a
                viewing.
              </p>
            </div>
            <div className="actions">
              <Suspense
                fallback={
                  <Link href={enquiryHref} className="button">
                    Discuss a vehicle
                  </Link>
                }
              >
                <CatalogueEnquiryLink kind="vehicle" className="button">
                  Discuss a vehicle
                  <ArrowUpRight size={16} aria-hidden="true" />
                </CatalogueEnquiryLink>
              </Suspense>
              <Suspense
                fallback={
                  <a href={business.whatsapp} className="button secondary">
                    Whatsapp
                  </a>
                }
              >
                <CatalogueEnquiryLink
                  kind="vehicle"
                  channel="whatsapp"
                  className="button secondary"
                >
                  Whatsapp
                </CatalogueEnquiryLink>
              </Suspense>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
