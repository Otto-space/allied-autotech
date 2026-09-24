import { publicPageMetadata, type SearchParameters } from "@/lib/seo";
import type { Metadata } from "next";
import { MapPin, Phone, Mail } from "lucide-react";
import { business } from "@/lib/business";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { PublicEnquiryForm } from "../components/public-enquiry-form";
export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParameters;
}): Promise<Metadata> {
  return publicPageMetadata(
    "Contact & directions",
    "Visit Allied AutoTech at 133 Stadium Road, beside Kilimanjaro, Port Harcourt. Call 08136075567 or message us on WhatsApp.",
    "/contact",
    searchParams,
  );
}
export default function ContactPage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <section className="section">
          <div className="container">
            <h1>Let’s talk about your vehicle.</h1>
            <p className="lead">
              Speak with Allied AutoTech or plan your visit to our Port Harcourt workshop.
            </p>
            <div className="contact-grid">
              <div className="location-panel">
                <MapPin size={36} />
                <h2>Find us in Port Harcourt.</h2>
                <address>{business.address}</address>
                <a
                  className="button"
                  href={business.directions}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Google Maps directions ↗
                </a>
                <p className="muted">
                  Directions use the written address. Call us if you need help finding the
                  entrance.
                </p>
              </div>
              <div className="contact-methods">
                <article>
                  <Phone size={24} />
                  <h2>Call or WhatsApp</h2>
                  <a
                    className="contact-value"
                    href={`tel:${business.internationalPhone}`}
                  >
                    {business.phone}
                  </a>
                  <p>
                    <a
                      className="text-link"
                      href={business.whatsapp}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Message Allied AutoTech ↗
                    </a>
                  </p>
                </article>
                <article>
                  <Mail size={24} />
                  <h2>Email us</h2>
                  <a className="text-link" href={`mailto:${business.email}`}>
                    {business.email}
                  </a>
                  <p className="muted">
                    For questions about services, products or your visit.
                  </p>
                </article>
              </div>
            </div>
          </div>
        </section>
        <section className="section">
          <div className="container narrow">
            <PublicEnquiryForm />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
