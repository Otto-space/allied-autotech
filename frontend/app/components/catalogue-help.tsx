import Link from "next/link";
import { business } from "@/lib/business";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { ChevronRight, Mail, MapPin, Phone } from "lucide-react";
import "./catalogue-help.css";
import { learningEnabled } from "@/lib/learning/contracts";
import { HelpLearningCard } from "./learning/help-learning-card";

export function CatalogueHelp() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="public-site help-index catalogue-help">
        <header className="help-intro">
          <div className="help-wrap">
            <nav className="help-breadcrumb" aria-label="Breadcrumb">
              <ol>
                <li>
                  <Link href="/">Home</Link>
                  <ChevronRight size={14} aria-hidden="true" />
                </li>
                <li aria-current="page">Help centre</li>
              </ol>
            </nav>
            <h1>Help, when you need it.</h1>
            <p>
              Speak with Allied AutoTech about vehicle care, products and vehicles for
              sale.
            </p>
          </div>
        </header>
        {learningEnabled() && <HelpLearningCard />}
        <div className="help-wrap catalogue-help-layout">
          <section className="catalogue-help-answers" aria-label="Common questions">
            <article className="catalogue-help-answer">
              <h2>How do I arrange a service or inspection?</h2>
              <p>
                Browse our <Link href="/services">services</Link> or{" "}
                <Link href="/vehicles">vehicle marketplace</Link>, then call or message
                us. Our team confirms availability, appointments and any quotation
                directly.
              </p>
            </article>
            <article className="catalogue-help-answer">
              <h2>Can I order or pay online?</h2>
              <p>
                Online checkout, paid reservations and customer registration are not
                available yet. Contact us to discuss a product or vehicle.
              </p>
            </article>
            <article className="catalogue-help-answer">
              <h2>Where is the workshop?</h2>
              <p>
                {business.address}.{" "}
                <a href={business.directions} target="_blank" rel="noopener noreferrer">
                  Get directions <MapPin size={15} aria-hidden="true" />
                </a>
                .
              </p>
            </article>
            <article className="catalogue-help-answer">
              <h2>Complaints and privacy requests</h2>
              <p>
                Email <a href={`mailto:${business.email}`}>{business.email}</a> or call
                our team. Include enough information to explain your request; never send
                passwords or payment security codes. See our{" "}
                <Link href="/privacy">privacy notice</Link>.
              </p>
            </article>
          </section>
          <aside
            className="catalogue-help-contact"
            aria-labelledby="catalogue-help-contact-title"
          >
            <h2 id="catalogue-help-contact-title">Talk to our team</h2>
            <p className="catalogue-help-hours">{business.customerCareHours}.</p>
            <p>{business.customerCareResponse}</p>
            <div className="catalogue-help-actions">
              <a className="button" href={`tel:${business.internationalPhone}`}>
                <Phone size={16} aria-hidden="true" />
                Call our team
              </a>
              <a
                className="button secondary"
                href={business.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
              >
                Whatsapp
              </a>
              <a className="button secondary" href={`mailto:${business.email}`}>
                <Mail size={16} aria-hidden="true" />
                Email our team
              </a>
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
