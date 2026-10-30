import { CampaignArtwork } from "./campaign-artwork";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CarFront,
  ChevronDown,
  Package,
  Wrench,
} from "lucide-react";
import { faqs } from "@/lib/business";
import { loadPublicSeed } from "@/lib/api/public-seed-server";
import { parseProducts } from "@/lib/api/commerce-schemas";
import { parseListings } from "@/lib/api/vehicle-schemas";
import { parseServices } from "@/lib/api/public-schemas";
import { parsePublicReviews } from "@/lib/api/review-schemas";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { HomeHero } from "./home-hero";
import { ServiceList } from "./service-list";
import { HomePartsPreview, HomeVehiclesPreview } from "./home-catalogue-preview";
import { HomeReviewsPreview } from "./home-reviews-preview";
import { ContactInvitation } from "./brand-editorial";
import { vehicleEnquiryHref } from "@/lib/catalogue-enquiry";
import { learningEnabled } from "@/lib/learning/contracts";
import { LearningEntry } from "./learning/learning-entry";
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
        <section className="public-section">
          <div className="public-wrap partner-layout">
            <div className="partner-intro">
              <h2>How can we help?</h2>
            </div>
            <div className="partner-links">
              {[
                {
                  icon: Wrench,
                  title: "Services & repairs",
                  copy: "Find a service or tell us what you have noticed about your vehicle.",
                  href: "/services",
                },
                {
                  icon: Package,
                  title: "Shop parts & oils",
                  copy: "Browse products and ask about specifications, suitability and collection.",
                  href: "/parts",
                },
                {
                  icon: CarFront,
                  title: "Vehicle enquiries",
                  copy: "Share your budget, preferred make and requirements with our team.",
                  href: vehicleEnquiryHref(new URLSearchParams()),
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
            <div>
              <div className="section-heading">
                <h2>Explore our services</h2>
                <p>Review published services and contact the team about your vehicle.</p>
              </div>
              <ServiceList preview initial={services} />
              <Link className="text-link home-services__all" href="/services">
                Explore services <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
              <p className="home-services__enquiry">
                Not sure which service?{" "}
                <Link className="text-link" href="/contact#enquiry">
                  Ask about a service <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              </p>
            </div>
          </div>
        </section>
        <section className="public-section home-care" aria-labelledby="home-care-title">
          <div className="public-wrap home-care-layout">
            <figure>
              <div className="home-care-image">
                <CampaignArtwork
                  artwork="precision-autocare"
                  alt="Allied AutoTech Precision Autocare You Can Trust campaign, with a person in a red branded uniform"
                  sizes="(max-width: 420px) calc(100vw - 40px), 380px"
                />
              </div>
              <figcaption>Precision Autocare You Can Trust.</figcaption>
            </figure>
            <div>
              <h2 id="home-care-title">Clear advice. Careful workmanship.</h2>
              <p>
                We explain the issue, discuss the next steps and prioritise quality
                workmanship.
              </p>
              <dl className="home-care-principles">
                <div>
                  <dt>Understand the concern</dt>
                  <dd>We listen and clarify the issue with you.</dd>
                </div>
                <div>
                  <dt>Discuss the work</dt>
                  <dd>
                    We explain the findings and talk through recommended next steps.
                  </dd>
                </div>
                <div>
                  <dt>Keep you informed</dt>
                  <dd>Clear communication before and after the work.</dd>
                </div>
              </dl>
              <Link className="text-link" href="/about">
                Our workshop principles <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
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
              <h2>Inside the workshop</h2>
              <p>See some of the equipment used to investigate vehicle concerns.</p>
              <Link href="/about#equipment" className="text-link">
                View workshop equipment <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
        <section className="public-section public-surface home-shop">
          <div className="public-wrap">
            <div className="shop-editorial">
              <div>
                <h2>Parts, oils and automotive essentials.</h2>
                <p>
                  Browse the Shop or ask our team to check product specifications and
                  collection availability.
                </p>
                <Link className="button" href="/parts">
                  Browse the Shop <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              </div>
              <div className="shop-editorial__image">
                <Image
                  src="/images/allied-autotech/parts-editorial.webp"
                  alt="Editorial display of automotive filters, brake components and oil containers"
                  fill
                  sizes="(max-width: 700px) 100vw, 55vw"
                />
                <span className="home-editorial-credit">
                  Editorial product illustration.
                </span>
              </div>
            </div>
            <HomePartsPreview initial={products} />
          </div>
        </section>
        <HomeVehiclesPreview initial={vehicles} />
        <HomeReviewsPreview initial={reviews} />
        <section className="public-section">
          <div className="public-wrap home-faq">
            <div>
              <h2>Before you visit</h2>
              <Link className="text-link" href="/help">
                Visit the Help Centre <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
              {learningEnabled() && (
                <div className="home-learning-invitation">
                  <p>Allie explains the website and finds reviewed guidance.</p>
                  <LearningEntry />
                </div>
              )}
            </div>
            <div className="faq-list">
              {faqs.slice(0, 3).map((faq) => (
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
