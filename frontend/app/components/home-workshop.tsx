import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function HomeSectionHeading({
  title,
  copy,
  href,
  action,
}: {
  title: string;
  copy: string;
  href: string;
  action: string;
}) {
  return (
    <div className="section-heading-row">
      <div className="section-heading">
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
      <Link className="text-link" href={href}>
        {action} <ArrowUpRight size={17} aria-hidden="true" />
      </Link>
    </div>
  );
}

export function HomeWorkshop() {
  return (
    <>
      <section className="public-section">
        <div className="public-wrap">
          <HomeSectionHeading
            title="Inside the workshop"
            copy="Tools that support a focused investigation of your vehicle’s needs."
            href="/about#equipment"
            action="View workshop equipment"
          />
          <div className="home-feature-grid home-equipment-grid">
            {[
              {
                image: "/images/equipment/injector-tester-cleaner.jpg",
                title: "Fuel injector tester & cleaner",
                copy: "Testing and cleaning to investigate injector performance.",
                contain: true,
                alt: "Fuel injector tester and cleaner with graduated testing cylinders",
              },
              {
                image: "/images/workshop/owner/diagnostic-tablet.webp",
                title: "Vehicle-system diagnostics",
                copy: "A closer look at scan results helps guide the next checks.",
                alt: "Hands operating a diagnostic tablet beside a vehicle",
              },
              {
                image: "/images/equipment/3d-alignment.jpg",
                title: "3D wheel alignment",
                copy: "Alignment equipment supports checks and correction of wheel geometry.",
                alt: "Workshop 3D wheel alignment equipment",
              },
            ].map((item) => (
              <figure className="home-feature-card" key={item.title}>
                <div className="home-feature-media" data-contain={item.contain}>
                  <Image
                    src={item.image}
                    alt={item.alt}
                    fill
                    sizes="(max-width: 700px) 90vw, 380px"
                  />
                </div>
                <figcaption className="home-feature-body">
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>
      <section className="public-section public-surface">
        <div className="public-wrap home-bay">
          <div className="home-bay-photo">
            <Image
              src="/images/workshop/owner/service-bay.webp"
              alt="The red two-post vehicle lift inside Allied’s workshop service bay"
              width={1067}
              height={1600}
              sizes="(max-width: 700px) 90vw, 430px"
            />
          </div>
          <div>
            <p className="home-kicker">Access for inspection & maintenance</p>
            <h2>Our vehicle service bay</h2>
            <p>
              Our two-post lift provides access beneath a vehicle for inspection and
              maintenance. The team assesses the vehicle and the work needed before
              agreeing the next steps.
            </p>
            <dl className="home-care-principles">
              <div>
                <dt>Understand the concern</dt>
                <dd>We listen and clarify the issue with you.</dd>
              </div>
              <div>
                <dt>Discuss the work</dt>
                <dd>
                  We explain the findings and talk through the recommended next steps.
                </dd>
              </div>
              <div>
                <dt>Keep you informed</dt>
                <dd>Clear communication before and after the work.</dd>
              </div>
            </dl>
            <Link className="text-link" href="/about#principles">
              Our workshop principles <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
      <section className="public-section">
        <div className="public-wrap">
          <HomeSectionHeading
            title="The people behind your vehicle care"
            copy="Meet the Allied team and see our workshop in use."
            href="/about#team"
            action="Our team at work"
          />
          <figure className="home-team-photo">
            <Image
              src="/images/workshop/owner/allied-team.webp"
              alt="Seven members of the Allied AutoTech team standing together outside the workshop"
              width={1920}
              height={1280}
              sizes="(max-width: 700px) 90vw, 1100px"
            />
          </figure>
        </div>
      </section>
    </>
  );
}
