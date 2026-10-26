import { loadPublicSeed } from "@/lib/api/public-seed-server";
import { parseServiceDiscovery } from "@/lib/api/public-schemas";
import { publicPageMetadata, type SearchParameters } from "@/lib/seo";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, ChevronRight } from "lucide-react";
import { business } from "@/lib/business";
import { operatingPrinciples } from "@/lib/brand-content";
import { ServiceJourney } from "../components/brand-editorial";
import { serviceApiPath } from "@/lib/service-discovery";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { ServicesCatalogue } from "../components/services-catalogue";
import { CampaignArtwork } from "../components/campaign-artwork";
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
  const seed = await loadPublicSeed(
    await listingPath(searchParams),
    parseServiceDiscovery,
  );
  return seed.error ? { ...metadata, robots: { index: false, follow: false } } : metadata;
}
export default async function ServicesPage({
  searchParams,
}: {
  searchParams: SearchParameters;
}) {
  const initial = await loadPublicSeed(
    await listingPath(searchParams),
    parseServiceDiscovery,
  );
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
        <section
          className="services-principles"
          aria-labelledby="services-principles-title"
        >
          <div className="public-wrap services-principles-inner">
            <div className="services-principles-media">
              <CampaignArtwork
                artwork="right-work"
                alt="Allied AutoTech No Guesswork campaign showing mechanical work"
                sizes="(max-width: 440px) calc(100vw - 40px), 400px"
              />
            </div>
            <div>
              <h2 id="services-principles-title">No guesswork. Just the right work.</h2>
              <p>
                Share what you have noticed. Discuss the findings and proposed work with
                our team before you decide on the next step.
              </p>
              <ul>
                {[
                  operatingPrinciples[0],
                  operatingPrinciples[2],
                  operatingPrinciples[5],
                ].map(([title, copy]) => (
                  <li key={title}>
                    <h3>{title}</h3>
                    <p>{copy}</p>
                  </li>
                ))}
              </ul>
              <Link className="text-link" href="/about">
                Our approach to vehicle care <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
        <ServiceJourney showStartLink={false} />
        <section className="services-faq" aria-labelledby="services-faq-title">
          <div className="public-wrap services-faq-inner">
            <div>
              <h2 id="services-faq-title">Before you book.</h2>
              <p>A few useful details before your next step.</p>
            </div>
            <div className="services-faq-list">
              {[
                [
                  "What is the difference between fixed price and quotation required?",
                  "A fixed-price service has a listed price. For a service marked quotation required, share your vehicle details and the work you need so the team can review the scope. Open the service page to see the available next steps.",
                ],
                [
                  "Is a booking request a confirmed appointment?",
                  "A booking request is sent for workshop review. Check your account for the confirmed appointment and updates. The duration shown in the catalogue is the listed service duration, not a guaranteed collection time.",
                ],
                [
                  "What should I include when asking about a service?",
                  "Tell us the vehicle make, model and year, the issue you have noticed, when it happens and any recent work. You can describe a warning light, unusual noise or a change in how the vehicle drives without trying to diagnose it yourself.",
                ],
              ].map(([question, answer]) => (
                <details key={question}>
                  <summary>
                    {question}
                    <ChevronDown size={17} aria-hidden="true" />
                  </summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
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
