import { loadPublicSeed } from "@/lib/api/public-seed-server";
import { parseProductDiscovery } from "@/lib/api/commerce-schemas";
import { publicPageMetadata, type SearchParameters } from "@/lib/seo";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, ArrowUpRight, CarFront, FileSearch, MapPin } from "lucide-react";
import { business } from "@/lib/business";
import { productApiPath } from "@/lib/product-discovery";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { PartsCatalogue } from "../components/parts-catalogue";
import "./parts.css";

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
    "Auto Parts, Engine Oil & Automotive Products",
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
  const initial = await loadPublicSeed(
    await listingPath(searchParams),
    parseProductDiscovery,
  );
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
              <h1 id="product-title">
                Quality parts.
                <br />
                Reliable performance.
              </h1>
              <p>
                Explore parts, oils, fluids, tyres and automotive products. Check
                specifications and suitability for your vehicle.
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
            <div className="product-guidance-media">
              <Image
                src="/images/allied-autotech/workshop-editorial.webp"
                alt="Editorial automotive workshop scene"
                fill
                sizes="(max-width: 767px) 100vw, 40vw"
              />
            </div>
            <div className="product-guidance-copy">
              <h2>Find the right fit.</h2>
              <p>
                Check the product specifications and listed vehicle compatibility before
                purchase.
              </p>
              <ul>
                {(
                  [
                    [
                      FileSearch,
                      "Match the part number",
                      "Compare the manufacturer part number with the part you need. Use the SKU when speaking with our team.",
                    ],
                    [
                      CarFront,
                      "Review vehicle compatibility",
                      "Check the listed make, model, year range and notes on the product page. Ask our team if you are unsure.",
                    ],
                    [
                      MapPin,
                      "Check branch availability",
                      "Review the listed branch availability before choosing a quantity. Your cart does not reserve stock.",
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
                Share the product name or part number and your vehicle details with our
                team.
              </p>
            </div>
            <div className="actions">
              <Link href="/contact" className="button">
                Ask about a product <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
              <a href={business.whatsapp} className="button secondary">
                Chat on WhatsApp
              </a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
