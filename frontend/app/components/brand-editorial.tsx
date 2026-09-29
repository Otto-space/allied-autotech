import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { operatingPrinciples, serviceJourney } from "@/lib/brand-content";
import { business } from "@/lib/business";

export function EditorialBanner({
  title,
  description,
  image = "workshop-editorial",
  marketplace = false,
}: {
  title: string;
  description: string;
  image?: string;
  marketplace?: boolean;
}) {
  return (
    <section
      className={`editorial-banner${marketplace ? " editorial-banner--marketplace" : ""}`}
    >
      <div className="editorial-banner__media">
        <Image
          src={`/images/allied-autotech/${image}.webp`}
          alt=""
          fill
          sizes="100vw"
          preload
        />
      </div>
      <div className="public-wrap editorial-banner__copy">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </section>
  );
}

export function ServiceJourney() {
  return (
    <section className="public-section journey-section">
      <div className="public-wrap">
        <div className="section-heading">
          <h2>A clear path to better vehicle care.</h2>
          <p>From the first conversation to collection, know what comes next.</p>
        </div>
        <ol className="service-journey">
          {serviceJourney.map(([title, copy], index) => (
            <li key={title}>
              <span className="journey-number" aria-hidden="true">
                0{index + 1}
              </span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </li>
          ))}
        </ol>
        <Link className="text-link" href="/services">
          Start with a service <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

export function TrustPrinciples({ complete = false }: { complete?: boolean }) {
  const principles = complete
    ? operatingPrinciples
    : [
        operatingPrinciples[0],
        operatingPrinciples[2],
        operatingPrinciples[4],
        operatingPrinciples[5],
      ];
  return (
    <ol className="principles-list">
      {principles.map(([title, copy], index) => (
        <li key={title}>
          <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
          <div>
            <h3>{title}</h3>
            <p>{copy}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function LifestyleDiscovery() {
  return (
    <section className="public-section lifestyle-section">
      <div className="public-wrap">
        <div className="section-heading">
          <h2>Which car fits your lifestyle?</h2>
          <p>Think about the journeys you make. We can help you explore the right fit.</p>
        </div>
        <div className="lifestyle-grid">
          <article className="lifestyle-feature">
            <Image
              src="/images/allied-autotech/family-editorial.webp"
              alt="Editorial family lifestyle scene beside a white SUV"
              fill
              sizes="(max-width: 700px) 100vw, 60vw"
            />
            <div>
              <h3>Family comfort.</h3>
              <p>Room for the moments that move you.</p>
              <Link href="/vehicles#inventory" className="text-link">
                Explore current vehicles <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </article>
          <div className="lifestyle-secondary">
            <article className="lifestyle-feature">
              <Image
                src="/images/allied-autotech/showroom-editorial.webp"
                alt="Editorial silver executive sedan in a showroom"
                fill
                sizes="(max-width: 700px) 100vw, 40vw"
              />
              <div>
                <h3>Executive presence.</h3>
                <p>A considered choice for your next chapter.</p>
                <Link href="/vehicles#inventory" className="text-link">
                  View the marketplace <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </article>
            <div className="lifestyle-needs">
              <h3>Made for your everyday.</h3>
              <p>Daily driving. Weekend travel. Business utility.</p>
              <a className="text-link" href={business.whatsapp}>
                Tell us what matters to you <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
        <p className="editorial-caption">
          Lifestyle inspiration. See current listings for actual vehicles and
          availability.
        </p>
      </div>
    </section>
  );
}

export function ContactInvitation() {
  return (
    <section className="public-section contact-invitation">
      <div className="public-wrap contact-band">
        <div>
          <h2>Let’s take care of your next move.</h2>
          <p>Visit Allied AutoTech at {business.address}.</p>
        </div>
        <div className="actions">
          <Link href="/services" className="button">
            Book a Service <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
          <a href={business.whatsapp} className="button secondary">
            Speak with us
          </a>
        </div>
      </div>
    </section>
  );
}
