"use client";
import Link from "next/link";
import { z } from "zod";
import { useResource } from "@/lib/api/use-resource";
import { parseReviews } from "@/lib/api/review-schemas";
import { useAccountSession } from "./dashboard-shell";
import { CustomerReview } from "./reviews-panel";
import { Feedback } from "./feedback";

function OwnedReview({ reviewId }: { reviewId: string }) {
  const valid = z.uuid().safeParse(reviewId).success;
  const record = useResource(
    valid ? `/customers/support/reviews?reviewId=${reviewId}&limit=1` : null,
    parseReviews,
  );
  const review = record.data?.items.find((item) => item.id === reviewId);
  return (
    <div className="customer-reviews">
      <header className="cr-heading">
        <div>
          <span className="eyebrow">Your feedback</span>
          <h1>Review update</h1>
          <p>Your submission and its latest moderation status.</p>
        </div>
        <Link href="/dashboard/reviews">All your reviews</Link>
      </header>
      <Feedback message={record.error || record.refreshError} />
      {record.loading && <p role="status">Loading your review…</p>}
      {(!valid || (!record.loading && !record.error && !review)) && (
        <p>This review is unavailable or does not belong to your account.</p>
      )}
      {!record.loading && !record.error && review && <CustomerReview review={review} />}
      {record.error && (
        <button className="button secondary" onClick={record.refresh}>
          Try again
        </button>
      )}
    </div>
  );
}
export function CustomerReviewDetail({ reviewId }: { reviewId: string }) {
  const session = useAccountSession();
  return session?.user.role === "CUSTOMER" ? (
    <OwnedReview key={`${session.user.id}:${reviewId}`} reviewId={reviewId} />
  ) : null;
}
