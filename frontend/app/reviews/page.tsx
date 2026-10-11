import { loadPublicSeed } from "@/lib/api/public-seed-server";
import { parsePublicReviews } from "@/lib/api/review-schemas";
import { publicPageMetadata, type SearchParameters } from "@/lib/seo";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronDown, ChevronRight } from "lucide-react";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { PublicReviews } from "../components/public-reviews";
import { ReviewAccountLink } from "./review-account-link";
import "./reviews.css";
export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParameters;
}): Promise<Metadata> {
  const metadata = await publicPageMetadata(
    "Customer reviews",
    "Read approved Allied AutoTech customer feedback about services, parts, orders and vehicle purchases.",
    "/reviews",
    searchParams,
  );
  const seed = await loadPublicSeed(
    "/public/support/reviews?limit=20",
    parsePublicReviews,
  );
  return seed.error ? { ...metadata, robots: { index: false, follow: false } } : metadata;
}
export default async function Page() {
  const initial = await loadPublicSeed(
    "/public/support/reviews?limit=20",
    parsePublicReviews,
  );
  return (
    <>
      <SiteHeader />
      <main id="main" className="public-site reviews-page">
        <div className="reviews-wrap">
          <nav className="reviews-breadcrumb" aria-label="Breadcrumb">
            <ol>
              <li>
                <Link href="/">Home</Link>
                <ChevronRight size={14} aria-hidden="true" />
              </li>
              <li aria-current="page">Customer reviews</li>
            </ol>
          </nav>
          <section className="reviews-intro" aria-labelledby="reviews-title">
            <div className="reviews-intro-copy">
              <h1 id="reviews-title">
                Customer reviews<span>.</span>
              </h1>
              <p className="reviews-lead">
                Feedback on the work. Confidence for the road.
              </p>
              <p>
                Read published customer feedback about services, parts, orders and vehicle
                purchases.
              </p>
              <div className="reviews-actions">
                <ReviewAccountLink />
                <a className="text-link" href="#published-feedback">
                  Browse feedback <ArrowRight size={16} aria-hidden="true" />
                </a>
              </div>
            </div>
            <div className="reviews-statement">
              <h2>Your experience matters.</h2>
              <p>
                Share what went well and what could be better. Every review is checked
                before publication.
              </p>
            </div>
          </section>
        </div>
        <section
          className="reviews-feedback-band"
          id="published-feedback"
          tabIndex={-1}
          aria-labelledby="published-feedback-title"
        >
          <div className="reviews-wrap reviews-feedback-layout">
            <PublicReviews initial={initial} />
            <aside className="reviews-guidance" aria-labelledby="reviews-guidance-title">
              <h2 id="reviews-guidance-title">Before you write</h2>
              <ol>
                <li>Sign in to your customer account.</li>
                <li>Choose your experience.</li>
                <li>Send it for review.</li>
              </ol>
              <a className="text-link" href="#how-reviews-work">
                How reviews work <ArrowRight size={16} aria-hidden="true" />
              </a>
            </aside>
          </div>
        </section>
        <section
          className="reviews-wrap reviews-explainer"
          id="how-reviews-work"
          tabIndex={-1}
          aria-labelledby="reviews-how-title"
        >
          <div className="reviews-faq">
            <h2 id="reviews-how-title">How reviews work</h2>
            {[
              [
                "Who can leave a review?",
                "Customers can share an overall experience. Product, service, order and vehicle purchase reviews must be linked to a completed activity in that customer account.",
              ],
              [
                "When will my review appear?",
                "New reviews go to the moderation queue. Only approved reviews appear publicly. You can check the status and any moderation note in your customer account.",
              ],
              [
                "What should I include?",
                "Describe your own experience and what could be improved. Keep your feedback relevant, and leave out phone numbers, addresses, payment details and other private information.",
              ],
              [
                "Where can I follow up on a problem?",
                "Contact Customer Care to send an enquiry or complaint. You can also follow existing support requests in your account. Posting a review does not create a support request.",
              ],
            ].map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <ChevronDown size={18} aria-hidden="true" />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
          <aside className="reviews-care" aria-labelledby="reviews-care-title">
            <div className="reviews-care-image">
              <Image
                src="/images/allied-autotech/workshop-editorial.webp"
                alt=""
                fill
                sizes="(max-width: 760px) calc(100vw - 40px), 380px"
              />
            </div>
            <div className="reviews-care-copy">
              <h2 id="reviews-care-title">Need help with an issue?</h2>
              <p>Customer Care can help you follow up on a request.</p>
              <Link className="button secondary" href="/contact">
                Contact customer care <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </aside>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
