import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function HomeHero() {
  return (
    <section className="home-hero home-hero--static" aria-labelledby="home-title">
      <div className="hero-media">
        <Image
          src="/images/allied-autotech/workshop-editorial.webp"
          alt="Editorial scene of a technician inspecting a dark SUV in a workshop"
          fill
          sizes="100vw"
          preload
        />
        <p className="hero-caption hero-credit">Editorial workshop illustration.</p>
      </div>
      <div className="public-wrap hero-layout">
        <div className="hero-copy">
          <p className="hero-eyebrow">Allied AutoTech · Port Harcourt</p>
          <h1 id="home-title">Diagnostics, repairs and automotive essentials.</h1>
          <p>
            Explore our services, find automotive products or speak to our team about a
            vehicle.
          </p>
          <div className="actions">
            <Link className="button" href="/services">
              Explore services <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
            <Link className="button secondary" href="/contact#enquiry">
              Contact the team
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
