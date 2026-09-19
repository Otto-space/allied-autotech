import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { business } from "@/lib/business";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { loadPublicSeed } from "@/lib/api/public-seed-server";
import { parseServices } from "@/lib/api/public-schemas";
import { parseProducts } from "@/lib/api/commerce-schemas";
import { parseListings } from "@/lib/api/vehicle-schemas";
import { ServiceList } from "./service-list";
import { HomePartsPreview, HomeVehiclesPreview } from "./home-catalogue-preview";
import { parsePublicReviews } from "@/lib/api/review-schemas";
import { HomeReviewsPreview } from "./home-reviews-preview";

export async function PublicHome() {
  const [services, parts, vehicles, reviews] = await Promise.all([
    loadPublicSeed("/public/services?limit=3", parseServices),
    loadPublicSeed("/public/catalog/products?limit=4", parseProducts),
    loadPublicSeed("/public/vehicles?limit=2", parseListings),
    loadPublicSeed("/public/support/reviews?limit=3", parsePublicReviews),
  ]);
  return (
    <>
      <SiteHeader />
      <main id="main">
        {/* 01 HERO */}
        <section className="pt-24 pb-16 px-6 text-center md:text-left max-w-7xl mx-auto">
          {/* <div className="max-w-4xl text-center md:text-left"> */}
          <h1 className="font-display uppercase text-ink mb-8">
            Precision vehicle care &{" "}
            <span className="text-brand-red">automotive solutions</span>
          </h1>
          <p className="text-xl text-muted max-w-2xl mb-10">
            Vehicle care with a clear next step. Explore services, plan your workshop
            visit and stay connected with Allied AutoTech in Port Harcourt.
          </p>
          <div className="flex flex-wrap gap-4 mb-16">
            <Link className="button" href="/services">
              Book a Service
            </Link>
            <Link className="button secondary" href="/parts">
              Explore Parts
            </Link>
            <Link className="button secondary" href="/vehicles">
              View Vehicles
            </Link>
          </div>
          {/* </div> */}
          <div className="w-full aspect-21/9 bg-surface rounded flex items-center justify-center border border-line">
            <span className="text-muted font-mono text-sm uppercase tracking-widest">
              Workshop photography coming soon
            </span>
          </div>
        </section>

        {/* 02 BRAND INTRODUCTION */}
        <section className="bg-ink text-white py-24 px-6 text-center max-w-7xl mx-auto">
          <p className="eyebrow on-dark mb-6">Allied AutoTech</p>
          <h2 className="text-3xl md:text-4xl font-quicksand uppercase tracking-tight text-white/85! leading-tight mb-6">
            Modern vehicle care built around precision, transparency and convenience.
          </h2>
          <p className="text-lg text-white/80">
            Explore published services, review your quotations and follow your bookings
            from your Allied AutoTech account.
          </p>
        </section>

        {/* 03 EDITORIAL STORY COMPOSITION */}
        <section className="py-24 px-6 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 gap-8 items-center">
            <div className="space-y-6">
              <h3 className="text-xl md:text-2xl font-display uppercase tracking-tight text-ink">
                Engineering care you can see
              </h3>
              <p className="text-muted">
                Review service details before booking. Your account brings quotations,
                workshop progress and payment status together so you can see the next
                step.
              </p>
            </div>
            <div className="h-125 bg-surface rounded flex items-center justify-center border border-line">
              <span className="text-muted font-mono text-sm uppercase">
                Workshop image
              </span>
            </div>
            <div className="bg-ink text-white p-8 rounded flex flex-col justify-between">
              <p className="eyebrow on-dark mb-10">Workflow</p>
              <ul className="space-y-4 text-sm opacity-80">
                <li className="border-b border-white/20 pb-4">Digital Diagnostics</li>
                <li className="border-b border-white/20 pb-4">Transparent Updates</li>
                <li className="border-b border-white/20 pb-4">Precision Servicing</li>
                <li>Digital Booking</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 04 TRUST STRIP */}
        <section className="border-y border-line py-8 overflow-hidden bg-surface">
          <div className="flex gap-16 px-6 font-mono uppercase text-sm tracking-widest text-muted justify-center whitespace-nowrap">
            <span>Diagnostics</span>
            <span>Vehicle Servicing</span>
            <span>Parts Catalogue</span>
            <span>Vehicle Marketplace</span>
            <span>Inspections</span>
            <span>Customer Care</span>
          </div>
        </section>

        {/* 05 & 06 SERVICES */}
        <section className="py-24 px-6 max-w-7xl mx-auto" id="services">
          <div className="flex flex-col md:flex-row justify-between items-end gap-8 mb-16">
            <div className="max-w-2xl relative">
              <div className="absolute -left-6 top-2 w-2 h-16 bg-brand-red"></div>
              <h2 className="public-section-title font-display uppercase text-ink">
                Care built around your vehicle
              </h2>
            </div>
            <Link className="text-link group flex items-center gap-2" href="/services">
              View All Services{" "}
              <ArrowRight
                size={16}
                className="group-hover:translate-x-1 transition-transform"
              />
            </Link>
          </div>
          <ServiceList preview initial={services} />
        </section>

        {/* 08 CUSTOMER GARAGE */}
        <section className="py-24 bg-surface">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="eyebrow mb-4">Digital Garage</p>
              <h2 className="text-4xl md:text-5xl font-display uppercase tracking-tight text-ink mb-6">
                Manage your vehicles effortlessly
              </h2>
              <p className="text-muted mb-8">
                Keep your vehicle details, bookings and workshop records together in your
                personal dashboard.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/dashboard/vehicles" className="button">
                  View My Garage
                </Link>
                <Link href="/login" className="button secondary">
                  Sign In
                </Link>
              </div>
            </div>
            <div className="aspect-square bg-white border border-line rounded flex items-center justify-center">
              <span className="text-muted font-mono text-sm uppercase">
                Your vehicles, organised in one place
              </span>
            </div>
          </div>
        </section>

        {/* 09 PARTS MARKETPLACE */}
        <section className="py-24 px-6 max-w-7xl mx-auto text-center">
          <p className="eyebrow mb-4">Parts Catalogue</p>
          <h2 className="public-section-title font-display uppercase text-ink mb-12">
            Parts for the <span className="text-brand-red">road ahead</span>
          </h2>
          <HomePartsPreview initial={parts} />
          <Link href="/parts" className="button secondary">
            Explore Parts Catalogue
          </Link>
        </section>

        {/* 10 VEHICLE MARKETPLACE */}
        <section className="py-24 bg-marketplace-blue text-white">
          <div className="max-w-7xl mx-auto px-6">
            <p className="eyebrow text-white/60! mb-4">Vehicle Marketplace</p>
            <div className="flex flex-wrap justify-between items-end gap-8 mb-12">
              <h2 className="public-section-title font-display uppercase">
                Find your next vehicle
              </h2>
              <Link href="/vehicles" className="button secondary">
                View Listings
              </Link>
            </div>
            <HomeVehiclesPreview initial={vehicles} />
          </div>
        </section>

        {/* 12 PROCESS */}
        <section className="py-24 px-6 max-w-7xl mx-auto">
          <h2 className="text-4xl font-display uppercase tracking-tight text-ink mb-16 text-center">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            {[
              "Choose a service",
              "Select vehicle & schedule",
              "Submit booking",
              "Track progress",
              "Receive updates",
            ].map((step, i) => (
              <div key={i} className="pt-4 border-t-2 border-ink">
                <span className="block text-brand-red font-mono font-bold mb-2">
                  0{i + 1}
                </span>
                <p className="font-bold text-ink">{step}</p>
              </div>
            ))}
          </div>
        </section>

        <HomeReviewsPreview initial={reviews} />

        {/* 17 FINAL CTA & 15 LOCATION */}
        <section className="py-24 bg-surface border-t border-line">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <h2 className="public-section-title font-display uppercase text-ink mb-8">
              Your vehicle deserves <br />
              <span className="text-brand-red">precision care</span>
            </h2>
            <div className="flex flex-wrap justify-center gap-4 mb-16">
              <Link href="/services" className="button">
                Book a Service
              </Link>
              <Link href="/contact" className="button secondary">
                Contact Customer Care
              </Link>
            </div>

            <div className="flex flex-col items-center pt-16 border-t border-line">
              <MapPin size={30} className="text-brand-red mb-4" />
              <h3 className="text-2xl font-display uppercase tracking-tight text-ink mb-2">
                Allied AutoTech Hub
              </h3>
              <p className="text-muted mb-6">{business.address}</p>
              <a
                className="text-link group flex items-center gap-2"
                href={business.directions}
                target="_blank"
                rel="noreferrer"
              >
                Get Directions{" "}
                <ArrowRight
                  size={16}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
