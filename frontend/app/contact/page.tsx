import { browseEnquiriesOnly, catalogueOnly } from "@/lib/public-launch";
import { CatalogueContact } from "../components/catalogue-contact";
import { publicPageMetadata, type SearchParameters } from "@/lib/seo";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  MapPin,
  Phone,
  Mail,
  MessageCircle,
} from "lucide-react";
import { business } from "@/lib/business";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { ContactPartsEnquiry } from "../components/contact-parts-enquiry";
import { Suspense } from "react";
import { ContactAccountLink } from "./contact-account-link";
import { ContactAnchor } from "./contact-anchor";
import "./contact.css";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParameters;
}): Promise<Metadata> {
  return publicPageMetadata(
    "Contact & customer care",
    `Send an enquiry, contact customer care or visit Allied AutoTech at ${business.address}.`,
    "/contact",
    searchParams,
  );
}
const locationQuery = `${business.name}, ${business.address}`;
const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationQuery)}`;
const directionsLink = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(locationQuery)}`;

export default function ContactPage() {
  if (catalogueOnly()) return <CatalogueContact />;
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  const mapsEmbed = mapsKey
    ? `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(mapsKey)}&q=${encodeURIComponent(locationQuery)}`
    : null;
  return (
    <>
      <SiteHeader />
      <main id="main" className="public-site contact-page">
        <div className="contact-wrap">
          <nav className="contact-breadcrumb" aria-label="Breadcrumb">
            <ol>
              <li>
                <Link href="/">Home</Link>
              </li>
              <li>
                <ChevronRight size={14} aria-hidden="true" />
                <span aria-current="page">Contact</span>
              </li>
            </ol>
          </nav>
          <section className="contact-hero" aria-labelledby="contact-title">
            <div className="contact-hero-copy">
              <h1 id="contact-title">Let’s talk about your vehicle.</h1>
              <p>
                Questions about a service, a vehicle or an order? Our team can help you
                take the next step.
              </p>
              <div className="contact-actions">
                <ContactAnchor className="button" target="enquiry">
                  Send an enquiry <ArrowDown size={16} aria-hidden="true" />
                </ContactAnchor>
                <ContactAnchor className="button secondary" target="contact-channels">
                  Call or WhatsApp
                </ContactAnchor>
              </div>
            </div>
            <div className="contact-hero-media">
              <Image
                src="/images/allied-autotech/workshop-editorial.webp"
                alt="Editorial workshop scene of a technician inspecting a vehicle"
                fill
                sizes="(max-width: 767px) 100vw, 45vw"
                priority
              />
            </div>
          </section>
          <section
            id="contact-channels"
            tabIndex={-1}
            className="contact-channels"
            aria-label="Direct contact options"
          >
            <a href={`tel:${business.internationalPhone}`}>
              <Phone size={20} aria-hidden="true" />
              <span>
                <small>Call</small>
                <strong>Call our team</strong>
              </span>
            </a>
            <a href={business.whatsapp} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={20} aria-hidden="true" />
              <span>
                <strong>
                  Whatsapp <ArrowUpRight size={14} aria-hidden="true" />
                </strong>
              </span>
            </a>
            <a href={`mailto:${business.email}`}>
              <Mail size={20} aria-hidden="true" />
              <span>
                <small>Email</small>
                <strong>{business.email}</strong>
              </span>
            </a>
            <ContactAnchor target="workshop">
              <MapPin size={20} aria-hidden="true" />
              <span>
                <small>Visit</small>
                <strong>{business.address}</strong>
              </span>
            </ContactAnchor>
          </section>
        </div>
        <div className="contact-care-band">
          <div className="contact-wrap">
            <div className="contact-care">
              <div className="contact-care-context">
                <h2 id="enquiry" tabIndex={-1}>
                  Tell us how we can help.
                </h2>
                <p>
                  Include your vehicle or product details and any booking or order
                  reference that helps explain your question.
                </p>
                <p>{business.customerCareHours}</p>
                <p>{business.customerCareResponse}</p>
                <ContactAccountLink />
                <p className="contact-next-step">
                  Review your details before sending. Once your request is received, keep
                  the reference so our team can follow up.
                </p>
              </div>
              <div className="contact-form-panel">
                <Suspense fallback={<p>Preparing enquiry form...</p>}>
                  <ContactPartsEnquiry labelledBy="enquiry" />
                </Suspense>
              </div>
            </div>
          </div>
        </div>
        <div className="contact-wrap">
          <section className="contact-location" aria-labelledby="workshop">
            <h2 id="workshop" tabIndex={-1}>
              Visit our <span>Port Harcourt workshop.</span>
            </h2>
            <div className="contact-location-grid">
              <div>
                <h3>Allied AutoTech</h3>
                <address>{business.address}</address>
                <p>Call before travelling to discuss your visit.</p>
                <div className="contact-actions">
                  <a
                    className="button secondary"
                    href={mapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open in Google Maps <ArrowUpRight size={16} aria-hidden="true" />
                  </a>
                  <a
                    className="text-link"
                    href={directionsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Get directions
                  </a>
                </div>
                <a
                  className="contact-location-phone"
                  href={`tel:${business.internationalPhone}`}
                >
                  <Phone size={18} aria-hidden="true" />
                  Call our team
                </a>
              </div>
              <div className="contact-map">
                {mapsEmbed ? (
                  <iframe
                    src={mapsEmbed}
                    title={`Allied AutoTech workshop location at ${business.address}`}
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                ) : (
                  <div className="contact-map-fallback">
                    <MapPin size={36} aria-hidden="true" />
                    <h3>Find your way to Allied AutoTech.</h3>
                    <p>{business.address}</p>
                    <a
                      className="text-link"
                      href={mapsLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open in Google Maps <ArrowUpRight size={16} aria-hidden="true" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
        <div className="contact-faq-band">
          <div className="contact-wrap">
            <section className="contact-faq" aria-labelledby="contact-help">
              <div>
                <h2 id="contact-help">Before you get in touch.</h2>
                <p>Find the right next step for your question.</p>
                <Link className="text-link" href="/help">
                  Visit the Help Centre <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              </div>
              <div className="contact-faq-items">
                <details>
                  <summary>
                    Can I ask about an existing booking or order?
                    <ChevronDown size={18} aria-hidden="true" />
                  </summary>
                  <p>
                    Yes. Include the reference in your message. Customer accounts can use
                    the account link above to access their support records. Keep payment
                    card details and passwords out of your message.
                  </p>
                </details>
                <details>
                  <summary>
                    Does an enquiry confirm an appointment?
                    <ChevronDown size={18} aria-hidden="true" />
                  </summary>
                  <p>
                    An enquiry starts a conversation. It does not confirm an appointment,
                    price or resolution. To request a service visit, use{" "}
                    <Link href="/services">
                      {browseEnquiriesOnly() ? "Explore services" : "Book a Service"}
                    </Link>
                    .
                  </p>
                </details>
                <details>
                  <summary>
                    How do I raise a complaint?
                    <ChevronDown size={18} aria-hidden="true" />
                  </summary>
                  <p>
                    Choose Complaint in the form above. Describe what happened and what
                    you would like us to help with, then review your details before
                    sending. Keep the reference shown after your complaint is received.
                  </p>
                </details>
                <details>
                  <summary>
                    Where can I find more help?
                    <ChevronDown size={18} aria-hidden="true" />
                  </summary>
                  <p>
                    Visit the <Link href="/help">Help Centre</Link> for guidance about
                    bookings, shopping, vehicle enquiries and your account.
                  </p>
                </details>
              </div>
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
