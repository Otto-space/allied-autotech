import { CampaignArtwork } from "../components/campaign-artwork";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { business } from "@/lib/business";
import { publicMetadata } from "@/lib/seo";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { EquipmentGallery } from "../components/equipment-gallery";
import { TrustPrinciples } from "../components/brand-editorial";
import { Brand } from "../components/brand";
import "./about.css";

export const metadata = publicMetadata(
  "About Allied AutoTech",
  "Professional, technology-driven automotive care in Port Harcourt. Meet our approach, values and workshop equipment.",
  "/about",
);

export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="public-site about-page">
        <section className="about-hero" aria-labelledby="about-title">
          <div className="about-wrap">
            <nav className="about-breadcrumb" aria-label="Breadcrumb">
              <ol>
                <li>
                  <Link href="/">Home</Link>
                  <ChevronRight size={14} aria-hidden="true" />
                </li>
                <li aria-current="page">About</li>
              </ol>
            </nav>
            <div className="about-hero-grid">
              <div className="about-hero-copy">
                <h1 id="about-title">
                  Precision Autocare
                  <br />
                  You Can Trust.
                </h1>
                <p className="about-lead">
                  Allied AutoTech is a modern automotive service brand in Port Harcourt,
                  committed to dependable, professional and technology-driven vehicle
                  care.
                </p>
                <p>
                  We combine skilled technicians, modern diagnostic equipment and quality
                  workmanship to help keep your vehicle safe, reliable and road-ready.
                </p>
                <div className="about-actions">
                  <Link className="button" href="/services">
                    Explore services <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                  <Link className="button secondary" href="/contact">
                    Contact the team <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              </div>
              <figure className="about-hero-figure">
                <div className="about-hero-photo">
                  <CampaignArtwork
                    artwork="precision-autocare"
                    alt="Allied AutoTech Precision Autocare You Can Trust campaign, with a person in a red branded uniform"
                    sizes="(max-width: 760px) calc(100vw - 40px), (max-width: 1023px) 36vw, 380px"
                    priority
                  />
                </div>
                <figcaption>Precision Autocare You Can Trust.</figcaption>
              </figure>
            </div>
          </div>
        </section>
        <nav className="about-sections about-wrap" aria-label="On this page">
          {[
            ["purpose", "Our purpose"],
            ["principles", "Our principles"],
            ["equipment", "Workshop equipment"],
            ["visit", "Visit us"],
          ].map(([id, label]) => (
            <a key={id} href={`#${id}`}>
              {label}
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          ))}
        </nav>
        <section
          className="about-purpose"
          id="purpose"
          tabIndex={-1}
          aria-label="Our purpose"
        >
          <div className="about-wrap about-purpose-grid">
            <div>
              <h2>Our vision</h2>
              <p>
                To become the leading provider of quality automotive solutions, creating a
                difference for all.
              </p>
            </div>
            <div>
              <h2>Our mission</h2>
              <p>
                Transforming the automotive space with top-notch products and services
                that deliver performance and reliability.
              </p>
              <p>
                Through every interaction, we work to remove uncertainty from vehicle care
                and ensure confidence, safety and satisfaction.
              </p>
            </div>
          </div>
        </section>
        <section
          className="about-wrap about-principles"
          id="principles"
          tabIndex={-1}
          aria-labelledby="about-principles-title"
        >
          <div className="about-section-heading">
            <div className="about-brand">
              <Brand monochrome />
            </div>
            <h2 id="about-principles-title">Built on trust driven by quality</h2>
            <p>
              Inspect carefully. Diagnose the issue. Explain the next step. Our approach
              keeps practical expertise and clear communication at the centre of vehicle
              care.
            </p>
          </div>
          <TrustPrinciples complete />
        </section>
        <section
          className="about-equipment"
          id="equipment"
          tabIndex={-1}
          aria-labelledby="about-equipment-title"
        >
          <div className="about-wrap about-equipment-layout">
            <div className="about-equipment-intro">
              <h2 id="about-equipment-title">
                Modern equipment.
                <br />
                Informed diagnosis.
              </h2>
              <p>
                From tyre care to electrical checks, our tools support a focused
                investigation of your vehicle’s needs.
              </p>
              <p className="about-equipment-note">
                Explore the equipment groups. Suitable checks depend on your vehicle and
                the issue reported.
              </p>
            </div>
            <EquipmentGallery collapsible />
          </div>
        </section>
        <section
          className="about-visit"
          id="visit"
          tabIndex={-1}
          aria-labelledby="about-visit-title"
        >
          <div className="about-wrap about-visit-grid">
            <div>
              <h2 id="about-visit-title">Vehicle care, closer to you.</h2>
              <p className="about-address">
                <MapPin size={20} aria-hidden="true" />
                <span>{business.address}</span>
              </p>
            </div>
            <div className="about-contact-options">
              <div className="about-contact-links">
                <a href={business.whatsapp} target="_blank" rel="noopener noreferrer">
                  <Phone size={18} aria-hidden="true" />
                  <span>Whatsapp</span>
                </a>
                <a href={`mailto:${business.email}`}>
                  <Mail size={18} aria-hidden="true" />
                  <span>
                    <small>Email</small>
                    {business.email}
                  </span>
                </a>
              </div>
              <div className="about-actions">
                <Link className="button" href="/contact">
                  Contact customer care <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <a
                  className="button secondary"
                  href={business.directions}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Get directions <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              </div>
              <a
                href={business.whatsapp}
                className="text-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                Whatsapp <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
