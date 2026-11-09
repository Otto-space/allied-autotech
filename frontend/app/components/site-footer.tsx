"use client";
import Link from "next/link";
import { business } from "@/lib/business";
import { Brand } from "./brand";
import { usePublicCapabilities } from "@/app/components/public-capabilities";
import { learningEnabled } from "@/lib/learning/contracts";
import "./site-footer.css";

export function SiteFooter() {
  const { catalogueOnly } = usePublicCapabilities();
  return (
    <footer className="site-footer site-footer--editorial">
      <div className="site-footer__inner site-footer__columns">
        <div>
          <Brand />
          <p className="brand-signature">Built on trust. Driven by quality.</p>
          <p>{business.address}</p>
          <p>
            <a
              href={business.instagram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Allied AutoTech on Instagram (opens in a new tab)"
            >
              {business.socialHandle}
            </a>
          </p>
        </div>
        <div>
          <h2>Explore</h2>
          <nav aria-label="Footer Services">
            <Link href="/services">Services</Link>
            <Link href="/parts">Shop</Link>
            <Link href="/vehicles">Vehicles</Link>
            <Link href="/about">About Allied AutoTech</Link>
          </nav>
        </div>
        <div>
          <h2>Support</h2>
          <nav aria-label="Footer Support">
            <Link href="/reviews">Customer reviews</Link>
            <Link href="/help">Help Centre</Link>
            {learningEnabled() && <Link href="/learn">Help &amp; Learn</Link>}
            <Link href="/contact">Customer Care</Link>
            <Link href={catalogueOnly() ? "/login" : "/dashboard"}>
              {catalogueOnly() ? "Staff sign in" : "Your Account"}
            </Link>
            {!catalogueOnly() && <Link href="/purchase">Guest purchases</Link>}
          </nav>
        </div>
        <div>
          <h2>Contact</h2>
          <div>
            <a
              href={business.whatsapp}

              target="_blank"
              rel="noopener noreferrer"
            >
              Whatsapp
            </a>
            <a href={`mailto:${business.email}`}>{business.email}</a>
          </div>
        </div>
      </div>
      <div className="site-footer__inner site-footer__bottom">
        <p>
          © {new Date().getFullYear()} {business.name}. All rights reserved.
        </p>
        <div>
          <Link href="/privacy">Privacy</Link>
          <Link href="/help">Help centre</Link>
          <Link href="/contact">Contact the team</Link>
        </div>
      </div>
    </footer>
  );
}
