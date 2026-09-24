import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { business } from "@/lib/business";
import { coreServices } from "@/lib/equipment";
import { loadPublicSeed } from "@/lib/api/public-seed-server";
import { parseProducts } from "@/lib/api/commerce-schemas";
import { parseListings } from "@/lib/api/vehicle-schemas";
import { parsePublicReviews } from "@/lib/api/review-schemas";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { HomeHero } from "./home-hero";
import { ServiceMarquee } from "./service-marquee";
import { HomePartsPreview, HomeVehiclesPreview } from "./home-catalogue-preview";
import { HomeReviewsPreview } from "./home-reviews-preview";

export async function PublicHome() {
  const [products, vehicles, reviews] = await Promise.all([
    loadPublicSeed("/public/catalog/products?limit=4", parseProducts),
    loadPublicSeed("/public/vehicles?limit=2", parseListings),
    loadPublicSeed("/public/support/reviews?limit=3", parsePublicReviews),
  ]);
  return (
    <>
      <SiteHeader />
      <main id="main" className="public-site">
        <HomeHero />
        <ServiceMarquee />
        <section className="public-wrap public-section">
          <div className="section-heading">
            <h2>Professional care. Every step of the way.</h2>
            <p>
              From everyday maintenance to finding your next vehicle, our team brings
              practical expertise and clear communication to your journey.
            </p>
          </div>
          <div className="core-services">
            {coreServices.map((service) => (
              <Link href={service.href} key={service.name}>
                <h3>
                  {service.name}
                  <ArrowUpRight size={18} aria-hidden="true" />
                </h3>
                <p>{service.description}</p>
              </Link>
            ))}
          </div>
        </section>
        <section className="public-section public-surface">
          <div className="public-wrap home-intro">
            <div>
              <h2>
                Built around your vehicle.
                <br />
                Focused on your confidence.
              </h2>
              <p>
                Allied AutoTech combines skilled technicians, modern diagnostic technology
                and quality workmanship to help keep your vehicle safe, reliable and
                road-ready.
              </p>
              <Link href="/about" className="text-link">
                Discover our approach <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className="home-values">
              {[
                [
                  "Professional service",
                  "Practical technical knowledge and care centred on your needs.",
                ],
                [
                  "Clear communication",
                  "Understand the work proposed and follow your booking and quotations.",
                ],
                [
                  "Quality products",
                  "Genuine parts and automotive essentials for dependable vehicle care.",
                ],
              ].map(([title, copy]) => (
                <div key={title}>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="public-wrap public-section">
          <div className="section-heading">
            <h2>Modern equipment. Better understanding.</h2>
            <p>
              The right tools help us investigate the problem and make informed
              recommendations.
            </p>
          </div>
          <div className="equipment-preview">
            {[
              [
                "3d-alignment",
                "Wheel alignment",
                "Precision checks for your vehicle’s alignment.",
              ],
              [
                "injector-tester-cleaner",
                "Fuel-system care",
                "Equipment for injector testing and cleaning.",
              ],
              [
                "thermal-camera",
                "Temperature diagnostics",
                "A closer look at heat patterns during diagnosis.",
              ],
            ].map(([slug, title, description]) => (
              <figure key={slug}>
                <div className="equipment-image">
                  <Image
                    src={`/images/equipment/${slug}.jpg`}
                    alt={title}
                    fill
                    sizes="(max-width: 800px) 90vw, 360px"
                  />
                </div>
                <figcaption>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </figcaption>
              </figure>
            ))}
          </div>
          <Link href="/about#equipment" className="text-link">
            Explore our technology & equipment{" "}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </section>
        <section className="public-section public-surface">
          <div className="public-wrap">
            <div className="section-heading">
              <h2>Shop automotive essentials</h2>
              <p>
                Explore the products currently published in our Shop. Check
                specifications, compatibility and availability before ordering.
              </p>
            </div>
            <HomePartsPreview initial={products} />
            <Link className="button secondary" href="/parts">
              Visit Shop
            </Link>
          </div>
        </section>
        <section className="public-section home-vehicles">
          <div className="public-wrap">
            <div className="section-heading">
              <h2>Your next vehicle starts here.</h2>
              <p>
                View published listings, explore the details and enquire about an
                inspection.
              </p>
            </div>
            <HomeVehiclesPreview initial={vehicles} />
            <Link className="button secondary" href="/vehicles">
              Browse Vehicles
            </Link>
          </div>
        </section>
        <section className="public-wrap public-section">
          <div className="section-heading">
            <h2>A clear next step for your vehicle.</h2>
          </div>
          <ol className="booking-steps">
            {[
              [
                "Explore services",
                "Choose a service or tell our team what your vehicle needs.",
              ],
              [
                "Send your request",
                "Select an available appointment and add any useful notes.",
              ],
              [
                "Receive confirmation",
                "The workshop reviews availability. Follow confirmation and progress in your account.",
              ],
            ].map(([title, description], index) => (
              <li key={title}>
                <span aria-hidden="true">0{index + 1}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </li>
            ))}
          </ol>
          <Link href="/services" className="button">
            Book a Service
          </Link>
        </section>
        <HomeReviewsPreview initial={reviews} />
        <section className="public-section public-surface">
          <div className="public-wrap contact-band">
            <div>
              <h2>Need help with your vehicle?</h2>
              <p>Visit us at {business.address}.</p>
            </div>
            <div className="actions">
              <Link className="button" href="/contact">
                Contact Us
              </Link>
              <a
                href={business.whatsapp}
                className="button secondary"
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp
              </a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
