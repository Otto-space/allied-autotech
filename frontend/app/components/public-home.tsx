import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, CarFront, Package, Wrench } from "lucide-react";
import { faqs } from "@/lib/business";
import { loadPublicSeed } from "@/lib/api/public-seed-server";
import { parseProducts } from "@/lib/api/commerce-schemas";
import { parseListings } from "@/lib/api/vehicle-schemas";
import { parseServices } from "@/lib/api/public-schemas";
import { parsePublicReviews } from "@/lib/api/review-schemas";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { HomeHero } from "./home-hero";
import { ServiceMarquee } from "./service-marquee";
import { ServiceList } from "./service-list";
import { HomePartsPreview, HomeVehiclesPreview } from "./home-catalogue-preview";
import { HomeReviewsPreview } from "./home-reviews-preview";
import {
  ContactInvitation,
  LifestyleDiscovery,
  ServiceJourney,
  TrustPrinciples,
} from "./brand-editorial";

export async function PublicHome() {
  const [products, vehicles, reviews, services] = await Promise.all([
    loadPublicSeed("/public/catalog/products?limit=4", parseProducts),
    loadPublicSeed("/public/vehicles?limit=2", parseListings),
    loadPublicSeed("/public/support/reviews?limit=3", parsePublicReviews),
    loadPublicSeed("/public/services?limit=3", parseServices),
  ]);
  return (
    <>
      <SiteHeader />
      <main id="main" className="public-site">
        <HomeHero />
        <ServiceMarquee />
        <section className="public-section">
          <div className="public-wrap partner-layout">
            <div className="partner-intro">
              <h2>
                One trusted
                <br />
                automotive partner.
              </h2>
              <p>For the vehicle you drive today. And the one you choose tomorrow.</p>
              <Link href="/about" className="text-link">
                Meet Allied AutoTech <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
            <div className="partner-links">
              {[
                {
                  icon: Wrench,
                  title: "Service & repairs",
                  copy: "Understand the issue. Plan the work. Keep moving with confidence.",
                  href: "/services",
                },
                {
                  icon: Package,
                  title: "Shop & automotive products",
                  copy: "Find parts, oils and the essentials that keep your vehicle performing.",
                  href: "/parts",
                },
                {
                  icon: CarFront,
                  title: "Vehicle marketplace",
                  copy: "Explore current vehicles and arrange a closer look with our team.",
                  href: "/vehicles",
                },
              ].map((item) => (
                <Link href={item.href} key={item.href}>
                  <item.icon size={22} aria-hidden="true" />
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.copy}</p>
                  </div>
                  <ArrowUpRight size={19} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>
        </section>
        <section className="public-section public-surface">
          <div className="public-wrap">
            <div className="section-heading-row">
              <div className="section-heading">
                <h2>Care for every next kilometre.</h2>
                <p>
                  Explore our current services, review the details and choose your next
                  step.
                </p>
              </div>
              <Link className="text-link" href="/services">
                All services <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
            <ServiceList preview initial={services} />
          </div>
        </section>
        <ServiceJourney />
        <section className="public-section trust-story">
          <div className="public-wrap trust-layout">
            <figure className="technician-story">
              <div className="technician-story__image">
                <Image
                  src="/images/allied-autotech/technician-original.webp"
                  alt="Allied AutoTech technician in the company’s original Precision Autocare You Can Trust campaign"
                  fill
                  sizes="(max-width: 700px) 90vw, 40vw"
                />
              </div>
              <figcaption>From the Allied AutoTech workshop.</figcaption>
            </figure>
            <div>
              <h2>
                Precision Autocare
                <br />
                You Can Trust.
              </h2>
              <p>
                Built on Trust, Driven by Quality. Our principles shape the way we care
                for your vehicle and the way we work with you.
              </p>
              <TrustPrinciples />
              <Link className="text-link" href="/about#principles">
                The principles behind our work{" "}
                <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
        <section className="public-section home-vehicles">
          <div className="public-wrap">
            <div className="section-heading-row">
              <div className="section-heading">
                <h2>Your next chapter starts here.</h2>
                <p>
                  Current listings. Clear details. A closer look before your next move.
                </p>
              </div>
              <Link className="button secondary" href="/vehicles">
                Explore Vehicles <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
            <HomeVehiclesPreview initial={vehicles} />
          </div>
        </section>
        <LifestyleDiscovery />
        <section className="public-section public-surface">
          <div className="public-wrap">
            <div className="shop-editorial">
              <div>
                <h2>
                  Quality parts.
                  <br />
                  Reliable performance.
                </h2>
                <p>
                  Explore available automotive essentials. Check compatibility, stock and
                  collection details before ordering.
                </p>
                <Link className="button" href="/parts">
                  Visit the Shop <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              </div>
              <div className="shop-editorial__image">
                <Image
                  src="/images/allied-autotech/parts-editorial.webp"
                  alt="Editorial display of automotive filters, brake components and oil containers"
                  fill
                  sizes="(max-width: 700px) 100vw, 55vw"
                />
              </div>
            </div>
            <HomePartsPreview initial={products} />
          </div>
        </section>
        <section className="public-section">
          <div className="public-wrap equipment-story">
            <div className="equipment-story__image">
              <Image
                src="/images/equipment/autel-mk808s.jpg"
                alt="Autel MK808S diagnostic tablet and equipment case"
                fill
                sizes="(max-width: 700px) 90vw, 40vw"
              />
            </div>
            <div>
              <h2>Precision starts with understanding.</h2>
              <p>
                Our diagnostic equipment helps us investigate the issue, explain our
                findings and recommend the next step for your vehicle.
              </p>
              <Link href="/about#equipment" className="text-link">
                Explore our technology & equipment{" "}
                <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
        <HomeReviewsPreview initial={reviews} />
        <section className="public-section">
          <div className="public-wrap home-faq">
            <div>
              <h2>
                A little clarity.
                <br />
                Before you set off.
              </h2>
              <p>Practical answers for your next visit.</p>
              <Link className="text-link" href="/help">
                Visit the Help Centre <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
            <div className="faq-list">
              {faqs.slice(0, 4).map((faq) => (
                <details key={faq.question}>
                  <summary>{faq.question}</summary>
                  <p>{faq.answer}</p>
                  <Link href={faq.href} className="text-link">
                    {faq.action} <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                </details>
              ))}
            </div>
          </div>
        </section>
        <ContactInvitation />
      </main>
      <SiteFooter />
    </>
  );
}
