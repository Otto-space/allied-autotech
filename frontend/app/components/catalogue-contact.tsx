import { ContactPartsEnquiry } from "./contact-parts-enquiry";
import { Suspense } from "react";
import Link from "next/link";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { business } from "@/lib/business";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";

export function CatalogueContact() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="public-site contact-page">
        <div className="contact-wrap">
          <nav className="contact-breadcrumb" aria-label="Breadcrumb">
            <Link href="/">Home</Link> / Contact
          </nav>
          <section className="contact-hero" aria-labelledby="contact-title">
            <div className="contact-hero-copy">
              <h1 id="contact-title">Let&apos;s talk about your vehicle.</h1>
              <p>
                Ask about our services, products and vehicles. Our team can discuss your
                needs and arrange your next visit.
              </p>
              <div className="contact-actions">
                <a className="button" href={`tel:${business.internationalPhone}`}>
                  Call our team
                </a>
                <a
                  className="button secondary"
                  href={business.whatsapp}
                  target="_blank"
                  rel="noreferrer"
                >
                  Chat on WhatsApp
                </a>
              </div>
            </div>
            <aside className="contact-preparation">
              <h2>Customer care</h2>
              <p>{business.customerCareHours}</p>
              <p>{business.customerCareResponse}</p>
            </aside>
          </section>
          <Suspense fallback={<p>Preparing your parts enquiry...</p>}>
            <ContactPartsEnquiry onlyParts />
          </Suspense>
          <section id="enquiry" className="contact-channels" aria-label="Contact options">
            <a href={`tel:${business.internationalPhone}`}>
              <Phone aria-hidden="true" />
              <span>
                <small>Call</small>
                <strong>{business.phone}</strong>
              </span>
            </a>
            <a href={business.whatsapp} target="_blank" rel="noreferrer">
              <MessageCircle aria-hidden="true" />
              <span>
                <small>WhatsApp</small>
                <strong>Start a conversation</strong>
              </span>
            </a>
            <a href={`mailto:${business.email}`}>
              <Mail aria-hidden="true" />
              <span>
                <small>Email</small>
                <strong>{business.email}</strong>
              </span>
            </a>
            <a href={business.directions} target="_blank" rel="noreferrer">
              <MapPin aria-hidden="true" />
              <span>
                <small>Visit</small>
                <strong>Get directions</strong>
              </span>
            </a>
          </section>
          <section className="contact-location" aria-labelledby="workshop">
            <h2 id="workshop">Visit our Port Harcourt workshop.</h2>
            <address>{business.address}</address>
            <p>
              Call before travelling to discuss your visit. Availability, appointments and
              prices requiring a quotation are confirmed by our team.
            </p>
            <p>
              Online checkout, reservations and customer registration are not available
              yet.
            </p>
            <p>
              For a complaint or privacy request, contact{" "}
              <a href={`mailto:${business.email}`}>{business.email}</a>. Read our{" "}
              <Link href="/privacy">privacy notice</Link>.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
