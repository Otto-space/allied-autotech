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
import { ServiceMarquee } from "./service-marquee";
import { ServiceList } from "./service-list";
import { HomePartsPreview, HomeVehiclesPreview } from "./home-catalogue-preview";
import { HomeReviewsPreview } from "./home-reviews-preview";
import { ContactInvitation } from "./brand-editorial";
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
        <section
          className="public-section home-routes"
          aria-labelledby="home-routes-title"
        >
          <div className="public-wrap">
            <div className="section-heading">
              <h2 id="home-routes-title">What can we help you with?</h2>
            </div>
            <div className="home-route-grid">
              {[
                {
                  icon: Wrench,
                  title: "Services and repairs",
                  copy: "Review the service details and discuss your vehicle’s needs.",
                  href: "/services",
                },
                {
                  icon: Package,
                  title: "Parts and automotive products",
                  copy: "Search by part or vehicle. Ask us to check suitability before collection.",
                  href: "/parts",
                },
                {
                  icon: CarFront,
                  title: "Vehicles",
                  copy: "Compare published listings or tell our team what you are looking for.",
                  href: "/vehicles",
                },
              ].map((item) => (
                <Link href={item.href} key={item.href}>
                  <item.icon size={24} aria-hidden="true" />
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                  <ArrowUpRight size={18} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>
        </section>
        <section className="public-section public-surface home-services">
          <div className="public-wrap home-services__layout">
            <div className="home-services__image">
              <Image
                src="/images/allied-autotech/technician-original.webp"
                alt="Technician in Allied AutoTech’s original workshop campaign photograph"
                fill
                sizes="(max-width: 700px) 90vw, 35vw"
              />
            </div>
            <div>
              <div className="section-heading">
                <h2>Which services can I enquire about?</h2>
                <p>
                  Read the published scope and pricing basis, then ask our team about your
                  vehicle. Work and appointments are confirmed separately.
                </p>
              </div>
              <ServiceList preview initial={services} />
              <Link className="text-link home-services__all" href="/services">
                All services <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
        <section className="public-section" aria-labelledby="home-equipment-title">
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
              <h2 id="home-equipment-title">
                How do we investigate your vehicle’s concern?
              </h2>
              <p>
                Our diagnostic equipment helps the team investigate issues, explain
                findings and recommend the next step.
              </p>
              <Link href="/about#equipment" className="text-link">
                Our equipment and approach <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
        <section
          className="public-section public-surface"
          aria-labelledby="home-next-title"
        >
          <div className="public-wrap">
            <div className="section-heading">
              <h2 id="home-next-title">What happens next?</h2>
              <p>Start a conversation. Agree the work before it begins.</p>
            </div>
            <ol className="home-process">
              {[
                [
                  "Tell us what you need",
                  "Share the vehicle details and the issue, service or part you need help with.",
                ],
                [
                  "Discuss the findings and scope",
                  "Our team explains the next step. Review any proposed work and quotation before approval.",
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
          </div>
        </section>
        <HomePartsPreview initial={products} />
        <HomeVehiclesPreview initial={vehicles} />
        <HomeReviewsPreview initial={reviews} />
        <section className="public-section">
          <div className="public-wrap home-faq">
            <div>
              <h2>Before your visit.</h2>
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
