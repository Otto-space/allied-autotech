import { browseEnquiriesOnly } from "@/lib/public-launch";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import {
  operatingPrinciples,
  serviceJourney,
  serviceEnquiryJourney,
} from "@/lib/brand-content";
import { business } from "@/lib/business";
import "./service-journey.css";

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

export function ServiceJourney({ showStartLink = true }: { showStartLink?: boolean }) {
  const enquiriesOnly = browseEnquiriesOnly();
  return (
    <section
      className="services-journey journey-section"
      aria-labelledby="services-journey-title"
    >
      <div className="public-wrap">
        <div className="services-journey-heading">
          <h2 id="services-journey-title">
            {enquiriesOnly
              ? "What happens after you enquire?"
              : "What happens during a service?"}
          </h2>
        </div>
        <ol>
          {(enquiriesOnly ? serviceEnquiryJourney : serviceJourney).map(
            ([title, copy], index) => (
              <li key={title}>
                <span aria-hidden="true">0{index + 1}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </li>
            ),
          )}
        </ol>
        {showStartLink && (
          <Link className="text-link journey-start" href="/services">
            Start with a service <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        )}
      </div>
    </section>
  );
}

const primaryPrinciples: readonly (typeof operatingPrinciples)[number][] = [
  operatingPrinciples[0],
  operatingPrinciples[2],
  operatingPrinciples[4],
  operatingPrinciples[5],
];
const additionalPrinciples = operatingPrinciples.filter(
  (principle) => !primaryPrinciples.includes(principle),
);

function PrinciplesList({
  principles,
  start = 1,
}: {
  principles: readonly (typeof operatingPrinciples)[number][];
  start?: number;
}) {
  return (
    <ol className="principles-list" start={start}>
      {principles.map(([title, copy], index) => (
        <li key={title}>
          <span aria-hidden="true">{String(index + start).padStart(2, "0")}</span>
          <div>
            <h3>{title}</h3>
            <p>{copy}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function TrustPrinciples({ complete = false }: { complete?: boolean }) {
  return (
    <>
      <PrinciplesList principles={primaryPrinciples} />
      {complete && (
        <details className="principles-more">
          <summary>
            More about our approach <ChevronDown size={18} aria-hidden="true" />
          </summary>
          <PrinciplesList principles={additionalPrinciples} start={5} />
        </details>
      )}
    </>
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
          <h2>Visit Allied AutoTech in Port Harcourt</h2>
          <p>{business.address}</p>
          <p>
            <strong>Customer Care hours:</strong> {business.customerCareHours}
          </p>
        </div>
        <div className="actions">
          <a
            href={business.directions}
            className="button"
            target="_blank"
            rel="noopener noreferrer"
          >
            Get directions <ArrowUpRight size={17} aria-hidden="true" />
          </a>
          <Link href="/contact#enquiry" className="button secondary">
            Contact the team
          </Link>
          <a
            href={business.whatsapp}
            className="button secondary"
            target="_blank"
            rel="noopener noreferrer"
          >
            Whatsapp
          </a>
        </div>
      </div>
    </section>
  );
}
