import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleCheck, MapPin, ShieldCheck, Wrench } from "lucide-react";
import { business } from "@/lib/business";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";

export const metadata: Metadata = {
  title: "About Allied AutoTech",
  description:
    "Learn how Allied AutoTech brings vehicle care, parts and marketplace support together in Port Harcourt.",
};

export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <section className="about-hero section">
          <div className="container about-hero-grid">
            <div>
              <p className="eyebrow">About Allied AutoTech</p>
              <h1>Vehicle care with a more considered next step.</h1>
              <p className="lead">
                Allied AutoTech connects workshop services, parts, vehicles and customer
                care in one clear experience for drivers in Port Harcourt.
              </p>
              <div className="actions">
                <Link className="button" href="/services">
                  Explore services <ArrowRight size={18} />
                </Link>
                <Link className="button secondary" href="/contact">
                  Speak with the team
                </Link>
              </div>
            </div>
            <div className="image-skeleton about-visual" aria-label="Image placeholder">
              <span className="skeleton-shine" />
              <span>Allied AutoTech workshop image placeholder</span>
            </div>
          </div>
        </section>
        <section className="section">
          <div className="container about-story">
            <div>
              <p className="eyebrow">One connected garage</p>
              <h2>Less guesswork. More confidence in what comes next.</h2>
            </div>
            <div className="about-copy">
              <p>
                From the first service search to the moment you review a payment or
                vehicle listing, the experience is designed to keep important information
                visible and decisions understandable.
              </p>
              <p>
                We keep availability, prices, booking status and customer conversations
                tied to the records held by Allied AutoTech. When something is not
                available, we say so rather than filling the gap with assumptions.
              </p>
            </div>
          </div>
        </section>
        <section className="section alt">
          <div className="container">
            <div className="section-head">
              <div>
                <p className="eyebrow">How we work</p>
                <h2>Built around clarity, care and useful detail.</h2>
              </div>
            </div>
            <div className="about-principles">
              <article className="card">
                <Wrench size={24} />
                <h3>Technical care</h3>
                <p>Start with the right service and a clear view of the work requested.</p>
              </article>
              <article className="card">
                <ShieldCheck size={24} />
                <h3>Visible decisions</h3>
                <p>Review booking, payment and order status from the records that matter.</p>
              </article>
              <article className="card">
                <CircleCheck size={24} />
                <h3>Human support</h3>
                <p>Reach the team when you need context, help or a straightforward answer.</p>
              </article>
            </div>
          </div>
        </section>
        <section className="section">
          <div className="container about-contact">
            <div>
              <p className="eyebrow">Find us in Port Harcourt</p>
              <h2>Come by Allied AutoTech.</h2>
              <p className="muted">{business.address}</p>
            </div>
            <div className="about-contact-actions">
              <MapPin size={24} />
              <a className="text-link" href={business.directions} target="_blank" rel="noreferrer">
                Get directions ↗
              </a>
              <Link className="button" href="/contact">Contact the team</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
