import { loadPublicSeed } from "@/lib/api/public-seed-server";
import { parseVehicleDiscovery } from "@/lib/api/vehicle-schemas";
import { publicPageMetadata, type SearchParameters } from "@/lib/seo";
import type { Metadata } from "next";
import Image from "next/image";
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
    "Browse current Allied AutoTech vehicle listings in Port Harcourt, compare details and request an inspection.",
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
              <h1 id="vehicle-title">Find the car that fits your life.</h1>
              <p>
                Browse current vehicle listings, explore the details and arrange a closer
                look.
              </p>
            </div>
            <div className="vehicle-hero-media">
              <Image
                src="/images/allied-autotech/showroom-editorial.webp"
                alt=""
                fill
                sizes="(max-width: 767px) 100vw, 55vw"
                preload
              />
              <span>Showroom inspiration. See listings for availability.</span>
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
        <section className="vehicle-buying-guide" aria-labelledby="vehicle-guide-title">
          <div className="public-wrap">
            <div>
              <h2 id="vehicle-guide-title">A closer look before your next move.</h2>
              <p>
                Use the listing to compare the details, then speak with our team about the
                vehicle you have in mind.
              </p>
              <Link href={enquiryHref} className="text-link">
                Ask our team <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <ol>
              {[
                [
                  "Compare the details",
                  "Review the price, specifications and any published condition report.",
                ],
                [
                  "Request a closer look",
                  "Open a vehicle to send an enquiry or choose a preferred inspection time with your customer account.",
                ],
                [
                  "Confirm with our team",
                  "An inspection request is not a confirmed appointment. Check your account for the agreed time.",
                ],
              ].map(([title, copy], index) => (
                <li key={title}>
                  <span aria-hidden="true">0{index + 1}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{copy}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <section className="vehicle-contact">
          <div className="public-wrap">
            <div>
              <h2>Let’s talk about your next car.</h2>
              <p>Our team can help you explore the details and arrange a closer look.</p>
            </div>
            <div className="actions">
              <Suspense
                fallback={
                  <Link href={enquiryHref} className="button">
                    Contact our team
                  </Link>
                }
              >
                <CatalogueEnquiryLink kind="vehicle" className="button">
                  Contact our team
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
