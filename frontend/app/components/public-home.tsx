import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CarFront,
  MapPin,
  MessageSquare,
  Wrench,
} from "lucide-react";
import { business } from "@/lib/business";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { ServiceList } from "./service-list";

export function PublicHome() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <section className="home-hero">
          <div className="container home-hero-grid">
            <div>
              <h1>
                More confidence.
                <br />
                <span>Every kilometre.</span>
              </h1>
              <p className="lead">
                Vehicle care with a clear next step. Explore services, plan your workshop
                visit and stay connected with Allied AutoTech in Port Harcourt.
              </p>
              <div className="actions">
                <Link className="button" href="/services">
                  Find your service <ArrowRight size={18} />
                </Link>
                <Link className="button secondary" href="/contact">
                  Talk to our team
                </Link>
              </div>
              <p className="hero-location">
                <MapPin size={17} /> Stadium Road, Port Harcourt
              </p>
            </div>
            <div className="journey-panel">
              <div className="journey-icon">
                <CarFront size={64} strokeWidth={1.3} aria-hidden="true" />
              </div>
              <h2>Keep life moving.</h2>
              <p>Your visit starts here.</p>
              <Link href="/services">
                <span>
                  <Wrench size={20} /> Explore vehicle services
                </span>
                <ArrowRight size={18} />
              </Link>
              <Link href="/dashboard/bookings">
                <span>
                  <CalendarDays size={20} /> Manage your appointments
                </span>
                <ArrowRight size={18} />
              </Link>
              <Link href="/contact">
                <span>
                  <MessageSquare size={20} /> Ask our team a question
                </span>
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </section>
        <section className="section" id="services">
          <div className="container">
            <div className="section-head">
              <div>
                <h2>Care built around your vehicle.</h2>
                <p className="muted">
                  Explore current services and choose what comes next.
                </p>
              </div>
              <Link className="text-link" href="/services">
                All services →
              </Link>
            </div>
            <ServiceList preview />
          </div>
        </section>
        <section className="section alt">
          <div className="container">
            <div className="section-head">
              <h2>A clearer way to plan your visit.</h2>
            </div>
            <div className="steps-grid">
              <article>
                <span className="step-number">01</span>
                <h3>Find the right service</h3>
                <p>
                  Review the listed service and pricing, or discuss a quotation for the
                  work you need.
                </p>
              </article>
              <article>
                <span className="step-number">02</span>
                <h3>Choose an available time</h3>
                <p>
                  For fixed-price bookings, choose a published slot and review the deposit
                  terms before you continue.
                </p>
              </article>
              <article>
                <span className="step-number">03</span>
                <h3>Stay in the loop</h3>
                <p>
                  Check your appointments, payment status and customer-care conversations
                  from your account.
                </p>
              </article>
            </div>
          </div>
        </section>
        <section className="section">
          <div className="container visit-banner">
            <div>
              <MapPin size={30} />
              <h2>
                Your next stop.
                <br />
                Allied AutoTech.
              </h2>
              <p>{business.address}</p>
            </div>
            <div className="actions">
              <a
                className="button"
                href={business.directions}
                target="_blank"
                rel="noreferrer"
              >
                Get directions ↗
              </a>
              <a className="button secondary" href={`tel:${business.internationalPhone}`}>
                Call {business.phone}
              </a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
