"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CarFront,
  CircleHelp,
  Clock3,
  ShieldCheck,
  MapPin,
  ShoppingBag,
  Wrench,
} from "lucide-react";
import { business } from "@/lib/business";
import { useResource } from "@/lib/api/use-resource";
import { parseProducts } from "@/lib/api/commerce-schemas";
import { parseListings } from "@/lib/api/vehicle-schemas";
import { formatKobo } from "@/lib/format/money";
import { Feedback } from "./feedback";
import { PublicMedia } from "./public-media";
import { PublicReviews } from "./public-reviews";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { ServiceList } from "./service-list";

const heroSlides = [
  {
    eyebrow: "Workshop care",
    title: "A clearer way to care for your vehicle.",
    body: "Find a service, choose the next available step and keep your visit moving with Allied AutoTech.",
    href: "/services",
    label: "Book a service",
    icon: Wrench,
  },
  {
    eyebrow: "Parts catalogue",
    title: "The right part for the job.",
    body: "Search current parts by name, brand or vehicle compatibility. Availability is always shown from the catalogue.",
    href: "/parts",
    label: "Browse parts",
    icon: ShoppingBag,
  },
  {
    eyebrow: "Vehicle marketplace",
    title: "Explore your next vehicle.",
    body: "Review current listings, compare the details and request an inspection when a vehicle feels right.",
    href: "/vehicles",
    label: "View vehicles",
    icon: CarFront,
  },
] as const;

export function PublicHome() {
  const [activeSlide, setActiveSlide] = useState(0);
  const products = useResource("/public/catalog/products?limit=3&sort=newest", parseProducts);
  const listings = useResource("/public/vehicles?limit=3&sort=newest", parseListings);
  const slide = heroSlides[activeSlide];
  const SlideIcon = slide.icon;

  useEffect(() => {
    const timer = window.setInterval(
      () => setActiveSlide((current) => (current + 1) % heroSlides.length),
      7000,
    );
    return () => window.clearInterval(timer);
  }, []);

  function moveSlide(direction: -1 | 1) {
    setActiveSlide(
      (current) => (current + direction + heroSlides.length) % heroSlides.length,
    );
  }

  return (
    <>
      <SiteHeader />
      <main id="main">
        <section
          className="home-hero"
          aria-roledescription="carousel"
          aria-label="Allied AutoTech services"
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") moveSlide(-1);
            if (event.key === "ArrowRight") moveSlide(1);
          }}
          tabIndex={0}
        >
          <div className="container home-hero-grid">
            <div>
              <p className="eyebrow">{slide.eyebrow}</p>
              <h1>{slide.title}</h1>
              <p className="lead">
                {slide.body}
              </p>
              <div className="actions">
                <Link className="button" href={slide.href}>
                  {slide.label} <ArrowRight size={18} />
                </Link>
                <Link className="button secondary" href="/contact">
                  Talk to our team
                </Link>
              </div>
              <p className="hero-location">
                <MapPin size={17} /> Stadium Road, Port Harcourt
              </p>
            </div>
            <div className="journey-panel" aria-live="polite">
              <div className="image-skeleton hero-image-placeholder" aria-label="Homepage image placeholder">
                <span className="skeleton-shine" />
                <span>Hero image placeholder</span>
              </div>
              <div className="journey-icon">
                <SlideIcon size={64} strokeWidth={1.3} aria-hidden="true" />
              </div>
              <p className="eyebrow">Your next step</p>
              <h2>Keep life moving.</h2>
              <p>Choose a route that fits what you need today.</p>
              <div className="carousel-controls">
                <button className="icon-button" onClick={() => moveSlide(-1)} aria-label="Previous slide">
                  <ChevronLeft size={20} />
                </button>
                <span aria-label={`Slide ${activeSlide + 1} of ${heroSlides.length}`}>
                  0{activeSlide + 1} / 0{heroSlides.length}
                </span>
                <button className="icon-button" onClick={() => moveSlide(1)} aria-label="Next slide">
                  <ChevronRight size={20} />
                </button>
              </div>
              <div className="carousel-dots" role="tablist" aria-label="Choose a homepage slide">
                {heroSlides.map((item, index) => (
                  <button
                    key={item.eyebrow}
                    role="tab"
                    aria-selected={index === activeSlide}
                    aria-label={`Show ${item.eyebrow}`}
                    className={index === activeSlide ? "active" : ""}
                    onClick={() => setActiveSlide(index)}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
        <section className="section" id="services">
          <div className="container">
            <div className="section-head">
              <div>
                <h2>Care built around your vehicle.</h2>
                <p className="muted">
                  Explore current services and choose what comes next.
                </p>
              </div>
              <Link className="text-link" href="/services">
                All services →
              </Link>
            </div>
            <ServiceList preview />
          </div>
        </section>
        <section className="section alt">
          <div className="container">
            <div className="section-head">
              <h2>A clearer way to plan your visit.</h2>
            </div>
            <div className="steps-grid">
              <article>
                <span className="step-number">01</span>
                <h3>Find the right service</h3>
                <p>
                  Review the listed service and pricing, or discuss a quotation for the
                  work you need.
                </p>
              </article>
              <article>
                <span className="step-number">02</span>
                <h3>Choose an available time</h3>
                <p>
                  For fixed-price bookings, choose a published slot and review the deposit
                  terms before you continue.
                </p>
              </article>
              <article>
                <span className="step-number">03</span>
                <h3>Stay in the loop</h3>
                <p>
                  Check your appointments, payment status and customer-care conversations
                  from your account.
                </p>
              </article>
            </div>
          </div>
        </section>
        <section className="section" id="marketplace">
          <div className="container">
            <div className="section-head">
              <div>
                <p className="eyebrow">Current catalogue</p>
                <h2>Parts and vehicles, with the details upfront.</h2>
                <p className="muted">
                  Browse what is currently published. Prices and availability come from
                  the Allied AutoTech catalogue.
                </p>
              </div>
            </div>
            <div className="home-feature-grid">
              <article className="feature-panel">
                <div className="feature-panel-head">
                  <span><ShoppingBag size={18} /> Featured parts</span>
                  <Link className="text-link" href="/parts">See all</Link>
                </div>
                <Feedback message={products.error} tone="info" />
                {products.loading && <p role="status" className="muted">Loading parts…</p>}
                {products.data?.items.map((product) => (
                  <Link className="feature-row" href={`/parts/${product.id}`} key={product.id}>
                    <PublicMedia
                      src={(product.images.find((image) => image.isPrimary) ?? product.images[0])?.url}
                      alt=""
                    />
                    <span>
                      <strong>{product.name}</strong>
                      <small>{product.brand ?? product.sku}</small>
                    </span>
                    <b>{formatKobo(product.priceKobo)}</b>
                  </Link>
                ))}
                {!products.loading && !products.error && products.data?.items.length === 0 && (
                  <div className="empty compact"><p>Parts are not listed yet.</p><Link className="text-link" href="/contact">Ask about a part →</Link></div>
                )}
              </article>
              <article className="feature-panel marketplace-panel">
                <div className="feature-panel-head">
                  <span><CarFront size={18} /> Vehicle marketplace</span>
                  <Link className="text-link" href="/vehicles">See all</Link>
                </div>
                <Feedback message={listings.error} tone="info" />
                {listings.loading && <p role="status" className="muted">Loading vehicles…</p>}
                {listings.data?.items.map((listing) => (
                  <Link className="feature-row" href={`/vehicles/${listing.id}`} key={listing.id}>
                    <PublicMedia
                      src={(listing.vehicle.images.find((image) => image.isPrimary) ?? listing.vehicle.images[0])?.url}
                      alt=""
                    />
                    <span>
                      <strong>{listing.title}</strong>
                      <small>{listing.vehicle.year} · {listing.branch.name}</small>
                    </span>
                    <b>{formatKobo(listing.priceKobo)}</b>
                  </Link>
                ))}
                {!listings.loading && !listings.error && listings.data?.items.length === 0 && (
                  <div className="empty compact"><p>Vehicles are not listed yet.</p><Link className="text-link" href="/contact">Tell us what you are looking for →</Link></div>
                )}
              </article>
            </div>
          </div>
        </section>
        <section className="section alt">
          <div className="container">
            <div className="trust-grid">
              <div>
                <p className="eyebrow">Built for clarity</p>
                <h2>Vehicle care that keeps you informed.</h2>
              </div>
              <div className="trust-points">
                <div><ShieldCheck size={22} /><span><strong>Honest next steps</strong><small>See what is published before you commit to a visit.</small></span></div>
                <div><Clock3 size={22} /><span><strong>Plan around your day</strong><small>Published slots and status updates help you stay in control.</small></span></div>
                <div><CircleHelp size={22} /><span><strong>Support when you need it</strong><small>Reach the team by phone, WhatsApp, email or customer care.</small></span></div>
              </div>
            </div>
          </div>
        </section>
        <PublicReviews />
        <section className="section">
          <div className="container faq-preview">
            <div>
              <p className="eyebrow">Need a hand?</p>
              <h2>Questions before you start?</h2>
              <p className="muted">Find clear answers about booking, payments, account access and contacting the team.</p>
            </div>
            <div className="faq-list">
              <details><summary>How do I book a service?</summary><p>Open Services, choose a listed service and review available times. Sign in to submit a booking.</p></details>
              <details><summary>Where is Allied AutoTech?</summary><p>{business.address}. <a className="text-link" href={business.directions} target="_blank" rel="noreferrer">Get directions ↗</a></p></details>
              <details><summary>How can I speak to someone?</summary><p>Call {business.phone}, message us on WhatsApp or email {business.email}.</p></details>
            </div>
            <Link className="button secondary" href="/help">Visit Help Centre</Link>
          </div>
        </section>
        <section className="section">
          <div className="container visit-banner">
            <div>
              <MapPin size={30} />
              <h2>
                Your next stop.
                <br />
                Allied AutoTech.
              </h2>
              <p>{business.address}</p>
            </div>
            <div className="actions">
              <a
                className="button"
                href={business.directions}
                target="_blank"
                rel="noreferrer"
              >
                Get directions ↗
              </a>
              <a className="button secondary" href={`tel:${business.internationalPhone}`}>
                Call {business.phone}
              </a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
