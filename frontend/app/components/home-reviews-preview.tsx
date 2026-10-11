"use client";
import Link from "next/link";
import { ArrowUpRight, MessageCircle, RefreshCw } from "lucide-react";
import type { PublicSeed } from "@/lib/api/public-seed";
import { parsePublicReviews } from "@/lib/api/review-schemas";
import { useResource } from "@/lib/api/use-resource";
import { Feedback } from "./feedback";
import { ReviewCard } from "./review-card";

export function HomeReviewsPreview({
  initial,
}: {
  initial: PublicSeed<ReturnType<typeof parsePublicReviews>>;
}) {
  const reviews = useResource(
    "/public/support/reviews?limit=3",
    parsePublicReviews,
    initial.data,
    { initialError: initial.error, revalidateOnMount: false },
  );
  return (
    <section
      className="public-section home-feedback"
      aria-labelledby="home-reviews-title"
    >
      <div className="public-wrap home-feedback__layout">
        <div className="home-feedback__intro">
          <div>
            <h2 id="home-reviews-title">Customer feedback</h2>
            <p className="muted">
              Published feedback about Allied AutoTech services and purchases.
            </p>
          </div>
          <Link className="text-link" href="/reviews">
            View all reviews <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </div>
        <div className="home-feedback__content" aria-busy={reviews.loading}>
          <Feedback message={reviews.error} />
          {reviews.loading && <p role="status">Checking published reviews...</p>}
          {reviews.loading && !reviews.data && (
            <div className="home-preview-loading" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          )}
          <div className="review-grid">
            {!reviews.error &&
              reviews.data?.items.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
          </div>
          {!reviews.error && !reviews.loading && reviews.data?.items.length === 0 && (
            <div className="home-feedback__empty">
              <MessageCircle size={28} strokeWidth={1.5} aria-hidden="true" />
              <p>No customer reviews have been published yet.</p>
            </div>
          )}
          <button
            className="button secondary home-feedback__refresh"
            disabled={reviews.loading}
            onClick={reviews.refresh}
          >
            <RefreshCw size={15} aria-hidden="true" />
            {reviews.error ? "Retry customer feedback" : "Refresh customer feedback"}
          </button>
          <noscript>
            <p className="muted">
              Enable JavaScript to refresh feedback, or follow the reviews link.
            </p>
          </noscript>
        </div>
      </div>
    </section>
  );
}
