import { ServiceGroups } from "../components/service-groups";
import { CatalogueBanner } from "../components/catalogue-banner";
import { loadPublicSeed } from "@/lib/api/public-seed-server";
import { parseServiceDiscovery } from "@/lib/api/public-schemas";
import { publicPageMetadata, type SearchParameters } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, ChevronRight } from "lucide-react";
import { business } from "@/lib/business";
import { browseEnquiriesOnly } from "@/lib/public-launch";
import { ServiceJourney } from "../components/brand-editorial";
import { serviceApiPath } from "@/lib/service-discovery";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { ServicesCatalogue } from "../components/services-catalogue";
import "./services.css";
import "../components/catalogue-redesign.css";

async function listingPath(searchParams: SearchParameters) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first) query.set(key, first);
  }
  return serviceApiPath(query);
}
export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParameters;
}): Promise<Metadata> {
  const metadata = await publicPageMetadata(
    "Vehicle services",
    "Explore Allied AutoTech vehicle services in Port Harcourt. Review published services or ask about your vehicle.",
    "/services",
    searchParams,
  );
  const seed = await loadPublicSeed(
    await listingPath(searchParams),
    parseServiceDiscovery,
  );
  return seed.error ? { ...metadata, robots: { index: false, follow: false } } : metadata;
}
export default async function ServicesPage({
  searchParams,
}: {
  searchParams: SearchParameters;
}) {
  const initial = await loadPublicSeed(
    await listingPath(searchParams),
    parseServiceDiscovery,
  );
  return (
    <>
      <SiteHeader />
      <main id="main" className="public-site services-page">
        <nav className="public-wrap services-breadcrumb" aria-label="Breadcrumb">
          <ol>
            <li>
              <Link href="/">Home</Link>
            </li>
            <li>
              <ChevronRight size={14} aria-hidden="true" />
              <span aria-current="page">Services</span>
            </li>
          </ol>
        </nav>
        <CatalogueBanner
          kind="services"
          title="Find the service your vehicle needs"
          description="Browse published services or tell the team what you have noticed about your vehicle."
        />
        <nav
          className="public-wrap services-discovery-paths"
          aria-label="Find service help"
        >
          <Link href="#service-catalogue">
            <strong>Browse a service</strong>
            <span>Review published services and their details.</span>
            <ArrowUpRight size={20} aria-hidden="true" />
          </Link>
          <Link href={browseEnquiriesOnly() ? "/contact#enquiry" : "/services/request"}>
            <strong>Describe a vehicle problem</strong>
            <span>
              Tell the team what you have noticed. A request does not confirm an
              appointment.
            </span>
            <ArrowUpRight size={20} aria-hidden="true" />
          </Link>
        </nav>
        <ServiceGroups />
        <section
          className="public-wrap services-catalogue"
          id="service-catalogue"
          aria-label="Service catalogue"
        >
          <ServicesCatalogue initial={initial} />
        </section>
        <ServiceJourney showStartLink={false} />
        <section className="services-faq" aria-labelledby="services-faq-title">
          <div className="public-wrap services-faq-inner">
            <div>
              <h2 id="services-faq-title">Before you enquire</h2>
            </div>
            <div className="services-faq-list">
              {[
                [
                  "What is the difference between fixed price and quotation required?",
                  "A fixed-price service has a listed price. For a service marked quotation required, share your vehicle details and the work you need so the team can review the scope. Open the service page to see the available next steps.",
                ],
                [
                  browseEnquiriesOnly()
                    ? "Does an enquiry confirm a visit?"
                    : "Is a booking request a confirmed appointment?",
                  browseEnquiriesOnly()
                    ? "An enquiry does not confirm an appointment. Agree visit arrangements with the team. The listed service duration is not a guaranteed collection time."
                    : "A booking request is sent for workshop review. Check your account for the confirmed appointment and updates. The duration shown in the catalogue is the listed service duration, not a guaranteed collection time.",
                ],
                [
                  "What should I include when asking about a service?",
                  "Tell us the vehicle make, model and year, the issue you have noticed, when it happens and any recent work. You can describe a warning light, unusual noise or a change in how the vehicle drives without trying to diagnose it yourself.",
                ],
              ].map(([question, answer]) => (
                <details key={question}>
                  <summary>
                    {question}
                    <ChevronDown size={17} aria-hidden="true" />
                  </summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
        <section className="services-contact" aria-labelledby="services-contact-title">
          <div className="public-wrap">
            <div>
              <h2 id="services-contact-title">Not sure where to start?</h2>
              <p>
                Tell us about your vehicle and the concern you have. Our team can help you
                choose the next step.
              </p>
            </div>
            <div className="actions">
              <Link href="/contact#enquiry" className="button">
                Ask about a service <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
              <a href={business.whatsapp} className="button secondary">
                Whatsapp
              </a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
