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
import { HomeSectionHeading, HomeWorkshop } from "./home-workshop";
import { HomeFeaturedServices } from "./home-featured-services";
import { HomePartsPreview, HomeVehiclesPreview } from "./home-catalogue-preview";
import { HomeReviewsPreview } from "./home-reviews-preview";
import { ContactInvitation } from "./brand-editorial";
import { vehicleEnquiryHref } from "@/lib/catalogue-enquiry";
import { learningEnabled } from "@/lib/learning/contracts";
import { browseEnquiriesOnly } from "@/lib/public-launch";
import { LearningEntry } from "./learning/learning-entry";
import "../home.css";

export async function PublicHome() {
  const [products, vehicles, reviews, services] = await Promise.all([
    loadPublicSeed("/public/catalog/products?limit=4", parseProducts),
    loadPublicSeed("/public/vehicles?limit=2", parseListings),
    loadPublicSeed("/public/support/reviews?limit=3", parsePublicReviews),
    loadPublicSeed("/public/services?limit=50", parseServices),
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
          <div className="public-wrap">
            <HomeSectionHeading
              title="Explore our services"
              copy="Start with diagnostics, wheel care or routine oil servicing."
              href="/services"
              action="Explore services"
            />
            <HomeFeaturedServices initial={services} />
            <p className="home-services__enquiry">
              Not sure which service?{" "}
              <Link
                className="text-link"
                href={browseEnquiriesOnly() ? "/contact#enquiry" : "/services/request"}
              >
                Describe a vehicle concern <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </p>
          </div>
        </section>
        <HomeWorkshop />
        <section className="public-section public-surface home-shop">
          <div className="public-wrap">
            <HomeSectionHeading
              title="Parts, oils and automotive essentials"
              copy="Explore the Shop or ask the team to check specifications, suitability and collection availability."
              href="/parts"
              action="Browse the Shop"
            />
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
