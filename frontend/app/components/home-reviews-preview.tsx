"use client";
import Link from "next/link";
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
    <section className="section container" aria-labelledby="home-reviews-title">
      <div className="section-head">
        <div>
          <h2 id="home-reviews-title">Customer feedback</h2>
          <p className="muted">
            Published feedback about Allied AutoTech services and purchases.
          </p>
        </div>
        <Link className="text-link" href="/reviews">
          View all reviews
        </Link>
      </div>
      <Feedback message={reviews.error} />
      {reviews.loading && <p role="status">Checking published reviews...</p>}
      <div className="review-grid">
        {!reviews.error &&
          reviews.data?.items.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
      </div>
      {!reviews.error && !reviews.loading && reviews.data?.items.length === 0 && (
        <p className="empty">No customer reviews have been published yet.</p>
      )}
      <button
        className="button secondary"
        disabled={reviews.loading}
        onClick={reviews.refresh}
      >
        {reviews.error ? "Retry customer feedback" : "Refresh customer feedback"}
      </button>
      <noscript>
        <p className="muted">
          Enable JavaScript to refresh feedback, or follow the reviews link.
        </p>
      </noscript>
    </section>
  );
}
