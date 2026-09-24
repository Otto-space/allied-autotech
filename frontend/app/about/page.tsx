import Image from "next/image";
import Link from "next/link";
import { business } from "@/lib/business";
import { publicMetadata } from "@/lib/seo";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { EquipmentGallery } from "../components/equipment-gallery";

export const metadata = publicMetadata(
  "About Allied AutoTech",
  "Professional, technology-driven automotive care in Port Harcourt. Meet our approach, values and workshop equipment.",
  "/about",
);

export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="public-site">
        <section className="public-wrap public-section about-intro">
          <div>
            <h1>
              Built around your vehicle.
              <br />
              Focused on your confidence.
            </h1>
            <p className="public-lead">
              Allied AutoTech is a modern automotive service brand in Port Harcourt,
              committed to dependable, professional and technology-driven vehicle care.
            </p>
            <p>
              We combine skilled technicians, modern diagnostic equipment and quality
              workmanship to help keep your vehicle safe, reliable and road-ready.
            </p>
            <Link className="button" href="/services">
              Explore services
            </Link>
          </div>
          <div className="about-photo">
            <Image
              src="/images/workshop/workshop-hero-01.jpg"
              alt="Vehicles inside the Allied AutoTech workshop"
              fill
              sizes="(max-width: 800px) 90vw, 48vw"
              preload
            />
          </div>
        </section>
        <section className="public-section public-surface">
          <div className="public-wrap purpose-grid">
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
        <section className="public-wrap public-section">
          <div className="section-heading">
            <h2>The way we work</h2>
            <p>
              Inspect carefully. Diagnose the issue. Explain the next step. Our approach
              keeps practical expertise and clear communication at the centre of vehicle
              care.
            </p>
          </div>
          <ul className="values-list">
            {[
              "Trust",
              "Efficiency",
              "Quality",
              "Transparency",
              "Reliability",
              "Innovation",
              "Respect",
              "Continuous improvement",
            ].map((value) => (
              <li key={value}>{value}</li>
            ))}
          </ul>
        </section>
        <section className="public-wrap public-section equipment-section" id="equipment">
          <div className="section-heading">
            <h2>Modern equipment. Informed diagnosis.</h2>
            <p>
              From tyre care to electrical checks, our tools support a focused
              investigation of your vehicle’s needs.
            </p>
          </div>
          <EquipmentGallery />
        </section>
        <section className="public-section public-surface">
          <div className="public-wrap contact-band">
            <div>
              <h2>Vehicle care, closer to you.</h2>
              <p>{business.address}</p>
            </div>
            <div className="actions">
              <Link className="button" href="/contact">
                Contact us
              </Link>
              <a
                className="button secondary"
                href={business.directions}
                target="_blank"
                rel="noreferrer"
              >
                Get directions
              </a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
