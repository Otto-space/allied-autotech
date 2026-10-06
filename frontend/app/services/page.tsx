import { loadPublicSeed } from "@/lib/api/public-seed-server";
import { parseServices } from "@/lib/api/public-schemas";
import { publicPageMetadata, type SearchParameters } from "@/lib/seo";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { business } from "@/lib/business";
import { serviceJourney } from "@/lib/brand-content";
import { serviceApiPath } from "@/lib/service-discovery";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { ServicesCatalogue } from "../components/services-catalogue";
import "./services.css";

async function listingPath(searchParams: SearchParameters) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first) query.set(key, first);
  }
  return serviceApiPath(query);
}
export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParameters;
}): Promise<Metadata> {
  const metadata = await publicPageMetadata(
    "Vehicle services",
    "Explore Allied AutoTech vehicle services in Port Harcourt. Review fixed-price appointments or request a quotation for your vehicle.",
    "/services",
    searchParams,
  );
  const seed = await loadPublicSeed(await listingPath(searchParams), parseServices);
  return seed.error ? { ...metadata, robots: { index: false, follow: false } } : metadata;
}
export default async function ServicesPage({
  searchParams,
}: {
  searchParams: SearchParameters;
}) {
  const initial = await loadPublicSeed(await listingPath(searchParams), parseServices);
  return (
    <>
      <SiteHeader />
      <main id="main" className="public-site services-page">
        <nav className="public-wrap services-breadcrumb" aria-label="Breadcrumb">
          <ol>
            <li>
              <Link href="/">Home</Link>
            </li>
            <li>
              <ChevronRight size={14} aria-hidden="true" />
              <span aria-current="page">Services</span>
            </li>
          </ol>
        </nav>
        <section className="services-hero" aria-labelledby="services-title">
          <div className="public-wrap services-hero-inner">
            <div className="services-hero-copy">
              <h1 id="services-title">
                Care for every
                <br />
                next kilometre.
              </h1>
              <p>
                Explore our services. Review fixed prices or discuss a quotation for your
                vehicle.
              </p>
            </div>
            <div className="services-hero-media">
              <Image
                src="/images/allied-autotech/workshop-editorial.webp"
                alt=""
                fill
                sizes="(max-width: 767px) 100vw, 50vw"
                preload
              />
            </div>
          </div>
        </section>
        <section
          className="public-wrap services-catalogue"
          id="service-catalogue"
          aria-label="Service catalogue"
        >
          <ServicesCatalogue initial={initial} />
        </section>
        <section className="services-journey" aria-labelledby="services-journey-title">
          <div className="public-wrap">
            <div className="services-journey-heading">
              <h2 id="services-journey-title">A clear path to better vehicle care.</h2>
              <p>From the first conversation to collection, know what comes next.</p>
            </div>
            <ol>
              {serviceJourney.map(([title, copy], index) => (
                <li key={title}>
                  <span aria-hidden="true">0{index + 1}</span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <section className="services-contact" aria-labelledby="services-contact-title">
          <div className="public-wrap">
            <div>
              <h2 id="services-contact-title">Not sure where to start?</h2>
              <p>
                Tell us about your vehicle and the concern you have. Our team can help you
                choose the next step.
              </p>
            </div>
            <div className="actions">
              <Link href="/contact" className="button">
                Ask about a service <ArrowUpRight size={16} aria-hidden="true" />
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
