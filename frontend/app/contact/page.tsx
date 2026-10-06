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
import { PublicEnquiryForm } from "../components/public-enquiry-form";
import { ContactAnchor } from "./contact-anchor";
import "./contact.css";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParameters;
}): Promise<Metadata> {
  return publicPageMetadata(
    "Contact & customer care",
    "Send an enquiry, contact customer care or visit Allied AutoTech at 133 Stadium Road, beside Kilimanjaro, Port Harcourt.",
    "/contact",
    searchParams,
  );
}
const locationQuery = `${business.name}, ${business.address}`;
const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationQuery)}`;
const directionsLink = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(locationQuery)}`;

export default function ContactPage() {
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
            <div>
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
                <strong>{business.phone}</strong>
              </span>
            </a>
            <a href={business.whatsapp} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={20} aria-hidden="true" />
              <span>
                <small>WhatsApp</small>
                <strong>
                  Start a conversation <ArrowUpRight size={14} aria-hidden="true" />
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
                <strong>133 Stadium Road, beside Kilimanjaro</strong>
              </span>
            </ContactAnchor>
          </section>
          <section className="contact-care" aria-labelledby="enquiry">
            <div className="contact-care-context">
              <h2 id="enquiry" tabIndex={-1}>
                Tell us how we can help.
              </h2>
              <p>
                Ask about services, bookings, quotations, orders, payments or vehicles.
              </p>
              <p className="contact-account-link">
                Already have an account?{" "}
                <Link href="/dashboard/support">
                  View customer care <ChevronRight size={14} aria-hidden="true" />
                </Link>
              </p>
              <ol className="contact-next">
                <li>
                  <span>1</span>
                  <div>
                    <h3>Share the details</h3>
                    <p>
                      Tell us what you need help with. Include useful references in your
                      message.
                    </p>
                  </div>
                </li>
                <li>
                  <span>2</span>
                  <div>
                    <h3>Review before sending</h3>
                    <p>
                      Check your contact details and message before creating your request.
                    </p>
                  </div>
                </li>
                <li>
                  <span>3</span>
                  <div>
                    <h3>Keep your contact details handy</h3>
                    <p>
                      The team can use the details you provide to follow up or ask for
                      more information.
                    </p>
                  </div>
                </li>
              </ol>
            </div>
            <div className="contact-form-panel">
              <PublicEnquiryForm presentation="contact" />
            </div>
          </section>
          <section className="contact-location" aria-labelledby="workshop">
            <h2 id="workshop" tabIndex={-1}>
              Visit our <span>Port Harcourt workshop.</span>
            </h2>
            <div className="contact-location-grid">
              <div>
                <h3>Allied AutoTech</h3>
                <address>{business.address}</address>
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
                  {business.phone}
                </a>
              </div>
              <div className="contact-map">
                {mapsEmbed ? (
                  <iframe
                    src={mapsEmbed}
                    title="Allied AutoTech workshop location at 133 Stadium Road, Port Harcourt"
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
          <section className="contact-faq" aria-labelledby="contact-help">
            <h2 id="contact-help">A little guidance before you get in touch.</h2>
            <details>
              <summary>
                Can I ask about an existing booking or order?
                <ChevronDown size={18} aria-hidden="true" />
              </summary>
              <p>
                Yes. Include the reference in your message, or{" "}
                <Link href="/dashboard/support">sign in to customer care</Link> to access
                your support records. Keep payment card details and passwords out of your
                message.
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
                <Link href="/services">Book a Service</Link>.
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
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
