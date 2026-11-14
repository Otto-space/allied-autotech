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
  copy?: string;
  href: string;
  action: string;
}) {
  return (
    <div className="section-heading-row">
      <div className="section-heading">
        <h2>{title}</h2>
        {copy && <p>{copy}</p>}
      </div>
      <Link className="text-link" href={href}>
        {action} <ArrowUpRight size={17} aria-hidden="true" />
      </Link>
    </div>
  );
}

export function HomeWorkshop() {
  return (
    <section
      className="public-section home-workshop"
      aria-labelledby="home-workshop-title"
    >
      <div className="public-wrap">
        <div className="home-workshop__heading">
          <div>
            <h2 id="home-workshop-title">Inside the Allied workshop</h2>
            <p>
              Meet the team and see the equipment we use for vehicle checks and
              maintenance.
            </p>
          </div>
          <Link className="text-link" href="/about#equipment">
            Explore our workshop <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </div>
        <div className="home-workshop__grid">
          <figure className="home-workshop__team home-team-photo">
            <div className="home-workshop__media">
              <Image
                src="/images/workshop/owner/allied-team.webp"
                alt="Allied AutoTech team members standing together outside the workshop"
                fill
                sizes="(max-width: 767px) calc(100vw - 32px), 700px"
              />
            </div>
            <figcaption>
              <h3>Meet the Allied team</h3>
              <Link className="text-link" href="/about#team">
                Meet the team <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </figcaption>
          </figure>
          <figure className="home-workshop__equipment">
            <div className="home-workshop__media">
              <Image
                src="/images/workshop/owner/diagnostic-tablet.webp"
                alt="Hands operating a diagnostic tablet beside a vehicle"
                fill
                sizes="(max-width: 767px) calc(100vw - 32px), 460px"
              />
            </div>
            <figcaption>
              <h3>Vehicle-system diagnostics</h3>
              <p>A closer look at scan results helps guide the next checks.</p>
            </figcaption>
          </figure>
          <figure className="home-workshop__bay home-bay">
            <div className="home-workshop__media">
              <Image
                src="/images/workshop/owner/alignment-at-work.webp"
                alt="Allied technician beside the workshop’s 3D wheel alignment equipment"
                fill
                sizes="(max-width: 767px) calc(100vw - 32px), 460px"
              />
            </div>
            <figcaption>
              <h3>3D wheel alignment</h3>
              <p>Equipment for checking and correcting wheel geometry.</p>
            </figcaption>
          </figure>
        </div>
        <nav
          className="home-workshop__equipment-links"
          aria-label="Workshop equipment and approach"
        >
          <Link href="/about#equipment">
            Fuel injector tester &amp; cleaner{" "}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/about#equipment">
            3D wheel alignment <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/about#equipment-item-service-bay-lift">
            Two-post vehicle lift <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/about#principles">
            Our workshop principles <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </nav>
      </div>
    </section>
  );
}
