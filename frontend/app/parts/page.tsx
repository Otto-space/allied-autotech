import { loadPublicSeed } from "@/lib/api/public-seed-server";
import { parseProductDiscovery } from "@/lib/api/commerce-schemas";
import { publicPageMetadata, type SearchParameters } from "@/lib/seo";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, ArrowUpRight, CarFront, FileSearch, MapPin } from "lucide-react";
import { business } from "@/lib/business";
import { Suspense } from "react";
import { partsEnquiryHref } from "@/lib/parts-fitment";
import { CatalogueEnquiryLink } from "../components/catalogue-enquiry-link";
import { productApiPath } from "@/lib/product-discovery";
import { browseEnquiriesOnly } from "@/lib/public-launch";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { PartsCatalogue } from "../components/parts-catalogue";
import "./parts.css";
import "../components/catalogue-discovery.css";

async function listingPath(searchParams: SearchParameters) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first) query.set(key, first);
  }
  return productApiPath(query);
}
export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParameters;
}): Promise<Metadata> {
  const metadata = await publicPageMetadata(
    "Auto Parts & Automotive Essentials",
    "Browse automotive products from Allied AutoTech. Search by name, brand or vehicle compatibility and check availability before collection in Port Harcourt.",
    "/parts",
    searchParams,
  );
  const seed = await loadPublicSeed(
    await listingPath(searchParams),
    parseProductDiscovery,
  );
  return seed.error ? { ...metadata, robots: { index: false, follow: false } } : metadata;
}
export default async function PartsPage({
  searchParams,
}: {
  searchParams: SearchParameters;
}) {
  const cataloguePath = await listingPath(searchParams);
  const enquiryHref = partsEnquiryHref(
    new URLSearchParams(cataloguePath.split("?")[1] ?? ""),
  );
  const initial = await loadPublicSeed(cataloguePath, parseProductDiscovery);
  const enquiriesOnly = browseEnquiriesOnly();
  return (
    <>
      <SiteHeader />
      <main id="main" className="public-site shop-page">
        <nav className="public-wrap product-breadcrumb" aria-label="Breadcrumb">
          <ol>
            <li>
              <Link href="/">Home</Link>
            </li>
            <li>
              <ChevronRight size={14} aria-hidden="true" />
              <span aria-current="page">Shop</span>
            </li>
          </ol>
        </nav>
        <section className="product-hero" aria-labelledby="product-title">
          <div className="public-wrap product-hero-inner">
            <div className="product-hero-copy">
              <h1 id="product-title">Parts, oils &amp; automotive essentials</h1>
              <p>
                Browse replacement parts, engine oils and automotive essentials. Check
                product specifications and collection availability with our team.
              </p>
            </div>
            <div className="product-hero-media">
              <Image
                src="/images/allied-autotech/parts-editorial.webp"
                alt=""
                fill
                sizes="(max-width: 767px) 100vw, 50vw"
                preload
              />
            </div>
          </div>
        </section>
        <section
          className="public-wrap product-inventory"
          id="products"
          aria-label="Shop automotive essentials"
        >
          <PartsCatalogue initial={initial} />
        </section>
        <section className="product-guidance">
          <div className="public-wrap">
            <div className="product-guidance-copy">
              <h2>Check before you choose</h2>
              <p>
                Check the product specifications and listed vehicle compatibility before
                {enquiriesOnly ? " contacting our team." : " purchase."}
              </p>
              <ul>
                {(
                  [
                    [
                      FileSearch,
                      "Check part numbers and specifications",
                      "For replacement parts, compare the manufacturer part number. For oils, check the vehicle manufacturer’s required specification and pack size; a grade alone does not establish suitability.",
                    ],
                    [
                      CarFront,
                      "Review vehicle compatibility",
                      "Check the listed make, model, year range and product notes where available. Share the product SKU and vehicle details if you need help.",
                    ],
                    [
                      MapPin,
                      "Check branch availability",
                      enquiriesOnly
                        ? "Ask our team to confirm availability for workshop collection. Browsing does not reserve stock."
                        : "Review the listed branch availability before choosing a quantity. Your cart does not reserve stock.",
                    ],
                  ] as const
                ).map(([Icon, title, copy]) => (
                  <li key={title}>
                    <Icon size={20} aria-hidden="true" />
                    <div>
                      <h3>{title}</h3>
                      <p>{copy}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
        <section className="product-contact">
          <div className="public-wrap">
            <div>
              <h2>Need help choosing a product?</h2>
              <p>
                Share the product, quantity and specifications you need. Add vehicle
                details when relevant.
              </p>
            </div>
            <div className="actions">
              <Suspense
                fallback={
                  <Link href={enquiryHref} className="button">
                    Ask about a product
                  </Link>
                }
              >
                <CatalogueEnquiryLink kind="product" className="button">
                  Ask about a product <ArrowUpRight size={16} aria-hidden="true" />
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
                  kind="product"
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
