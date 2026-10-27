"use client";
import Link from "next/link";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import type { PublicSeed } from "@/lib/api/public-seed";
import { parsePublicReviews } from "@/lib/api/review-schemas";
import { useResource } from "@/lib/api/use-resource";
import { Feedback } from "./feedback";
import { ReviewCarousel } from "./review-carousel";
import "./home-feedback.css";

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
  const refreshControl = (
    <button
      type="button"
      className="home-feedback__refresh"
      disabled={reviews.loading || reviews.refreshing}
      aria-label={reviews.error ? "Retry customer feedback" : "Refresh customer feedback"}
      onClick={reviews.refresh}
    >
      <RefreshCw size={16} aria-hidden="true" />
      {reviews.error ? "Retry feedback" : "Refresh feedback"}
    </button>
  );
  if (!reviews.error && !reviews.refreshError && reviews.data?.items.length === 0) {
    return (
      <section
        className="public-section home-feedback home-feedback--empty"
        aria-labelledby="home-reviews-title"
        aria-busy={reviews.loading || reviews.refreshing}
      >
        <div className="public-wrap home-feedback__invitation">
          <div>
            <h2 id="home-reviews-title">Your experience matters.</h2>
            <p>No customer reviews have been published yet. Read how to share yours.</p>
          </div>
          <div className="actions">
            <Link className="text-link" href="/reviews">
              About customer reviews <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
            {refreshControl}
          </div>
          <p className="home-feedback__status" role="status">
            {reviews.loading || reviews.refreshing ? "Checking published reviews..." : ""}
          </p>
        </div>
      </section>
    );
  }
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
        <div
          className="home-feedback__content"
          aria-busy={reviews.loading || reviews.refreshing}
        >
          <Feedback message={reviews.error} />
          <Feedback message={reviews.refreshError} />
          <p className="home-feedback__status" role="status">
            {reviews.loading || reviews.refreshing ? "Checking published reviews..." : ""}
          </p>
          {reviews.loading && !reviews.data && (
            <div className="home-preview-loading" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          )}
          {!!reviews.data?.items.length && (
            <ReviewCarousel
              items={reviews.data.items}
              refreshing={reviews.loading || reviews.refreshing}
              refreshControl={refreshControl}
            />
          )}
          {!reviews.data?.items.length && refreshControl}
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
