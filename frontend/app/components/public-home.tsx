import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, CarFront, ChevronDown, Package, Wrench } from "lucide-react";
import { faqs } from "@/lib/business";
import { loadPublicSeed } from "@/lib/api/public-seed-server";
import { parseProducts } from "@/lib/api/commerce-schemas";
import { parseListings } from "@/lib/api/vehicle-schemas";
import { parseServices } from "@/lib/api/public-schemas";
import { parsePublicReviews } from "@/lib/api/review-schemas";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { HomeHero } from "./home-hero";
import { CampaignArtwork } from "./campaign-artwork";
import { ServiceMarquee } from "./service-marquee";
import { ServiceList } from "./service-list";
import { HomePartsPreview, HomeVehiclesPreview } from "./home-catalogue-preview";
import { HomeReviewsPreview } from "./home-reviews-preview";
import { ContactInvitation, TrustPrinciples } from "./brand-editorial";
import "../home.css";

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
      <main id="main" className="public-site home-page">
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
        <section className="public-section public-surface home-services">
          <div className="public-wrap home-services__layout">
            <div className="home-services__image">
              <CampaignArtwork
                artwork="precision-autocare"
                alt="Allied AutoTech Precision Autocare You Can Trust campaign, with a person in a red branded uniform"
                sizes="(max-width: 420px) calc(100vw - 40px), (max-width: 700px) 380px, (max-width: 1280px) 36vw, 490px"
              />
            </div>
            <div>
              <div className="section-heading">
                <h2>Care for every next kilometre.</h2>
                <p>
                  Explore our current services, review the details and choose your next
                  step.
                </p>
              </div>
              <ServiceList preview initial={services} />
              <Link className="text-link home-services__all" href="/services">
                All services <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
        <section
          className="services-journey journey-section"
          aria-labelledby="services-journey-title"
        >
          <div className="public-wrap">
            <div className="services-journey-heading">
              <h2 id="services-journey-title">A clear path to better vehicle care.</h2>
              <p>From the first conversation to collection, know what comes next.</p>
            </div>
            <ol>
              {[
                [
                  "Tell us what you need",
                  "Share the vehicle details and the issue, service or part you need help with.",
                ],
                [
                  "Discuss the findings and scope",
                  "Review the proposed work and quotation with our team before approval.",
                ],
                [
                  "Confirm your visit or collection",
                  "Agree arrangements with the team. An enquiry alone does not confirm an appointment or reserve stock.",
                ],
              ].map(([title, copy], index) => (
                <li key={title}>
                  <span aria-hidden="true">0{index + 1}</span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </li>
              ))}
            </ol>
            <Link className="text-link journey-start" href="/services">
              Start with a service <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </section>
        <section className="public-section trust-story">
          <div className="public-wrap trust-layout">
            <figure className="technician-story">
              <div className="technician-story__image">
                <CampaignArtwork
                  artwork="built-on-trust"
                  alt="Sculptural red Allied emblem from the Built on Trust campaign"
                  sizes="(max-width: 390px) calc(100vw - 40px), 350px"
                />
              </div>
              <figcaption>Built on trust. Driven by quality.</figcaption>
            </figure>
            <div>
              <h2>
                Built on trust.
                <br />
                Driven by quality.
              </h2>
              <p>
                Our principles shape the way we care for your vehicle and the way we work
                with you.
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
        <section className="public-section public-surface home-shop">
          <div className="public-wrap">
            <div className="shop-editorial">
              <div>
                <h2>
                  Quality parts.
                  <br />
                  Reliable performance.
                </h2>
                <p>
                  Explore available automotive essentials. Ask our team to check
                  compatibility, stock and workshop collection details.
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
                  <summary>
                    {faq.question}
                    <ChevronDown size={18} aria-hidden="true" />
                  </summary>
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
