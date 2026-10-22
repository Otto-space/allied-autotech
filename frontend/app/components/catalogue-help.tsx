import Link from "next/link";
import { business } from "@/lib/business";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";

export function CatalogueHelp() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="public-site help-index">
        <header className="help-intro">
          <div className="help-wrap">
            <h1>Help, when you need it.</h1>
            <p>
              Speak with Allied AutoTech about vehicle care, products and vehicles for
              sale.
            </p>
          </div>
        </header>
        <section
          className="help-wrap"
          style={{ paddingBlock: "2rem 4rem", maxWidth: "52rem" }}
        >
          <h2>How do I arrange a service or inspection?</h2>
          <p>
            Browse our <Link href="/services">services</Link> or{" "}
            <Link href="/vehicles">vehicle marketplace</Link>, then call or message us.
            Our team confirms availability, appointments and any quotation directly.
          </p>
          <h2>Can I order or pay online?</h2>
          <p>
            Online checkout, paid reservations and customer registration are not available
            yet. Contact us to discuss a product or vehicle.
          </p>
          <h2>Where is the workshop?</h2>
          <p>
            {business.address}.{" "}
            <a href={business.directions} target="_blank" rel="noreferrer">
              Get directions
            </a>
            .
          </p>
          <h2>How do I contact customer care?</h2>
          <p>
            {business.customerCareHours}. {business.customerCareResponse}
          </p>
          <div className="actions">
            <a className="button" href={`tel:${business.internationalPhone}`}>
              Call {business.phone}
            </a>
            <a
              className="button secondary"
              href={business.whatsapp}
              target="_blank"
              rel="noreferrer"
            >
              Chat on WhatsApp
            </a>
            <a className="button secondary" href={`mailto:${business.email}`}>
              Email our team
            </a>
          </div>
          <h2>Complaints and privacy requests</h2>
          <p>
            Email <a href={`mailto:${business.email}`}>{business.email}</a> or call our
            team. Include enough information to explain your request; never send passwords
            or payment security codes. See our <Link href="/privacy">privacy notice</Link>
            .
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
