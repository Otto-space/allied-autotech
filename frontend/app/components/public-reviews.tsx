"use client";

import Link from "next/link";
import { ArrowRight, MessageSquareQuote, Star } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import { isRecord } from "@/lib/api/errors";
import { Feedback } from "./feedback";

type PublicReview = {
  id: string;
  rating: number;
  title?: string;
  comment?: string;
  targetType?: string;
};

function parsePublicReviews(value: unknown): { items: PublicReview[]; nextCursor?: string } {
  const record = isRecord(value) ? value : {};
  const items = Array.isArray(record.items)
    ? record.items.flatMap((item) => {
        if (!isRecord(item) || typeof item.id !== "string") return [];
        const rating = typeof item.rating === "number" ? item.rating : 0;
        return [
          {
            id: item.id,
            rating: Math.min(5, Math.max(0, rating)),
            title: typeof item.title === "string" ? item.title : undefined,
            comment: typeof item.comment === "string" ? item.comment : undefined,
            targetType: typeof item.targetType === "string" ? item.targetType : undefined,
          },
        ];
      })
    : [];
  return {
    items,
    nextCursor: typeof record.nextCursor === "string" ? record.nextCursor : undefined,
  };
}

export function PublicReviews() {
  const reviews = useResource("/public/support/reviews?limit=6&targetType=BUSINESS", parsePublicReviews);
  return (
    <section className="section review-section" aria-labelledby="reviews-heading">
      <div className="container">
        <div className="section-head">
          <div>
            <p className="eyebrow">Customer perspective</p>
            <h2 id="reviews-heading">What customers choose to share.</h2>
            <p className="muted">
              Approved overall-experience reviews appear here after moderation.
            </p>
          </div>
          <Link className="text-link" href="/dashboard/reviews">
            Leave a review <ArrowRight size={16} />
          </Link>
        </div>
        <Feedback message={reviews.error} tone="info" />
        {reviews.loading && (
          <div className="review-grid" aria-busy="true">
            {[1, 2, 3].map((item) => <div className="review-skeleton" key={item} />)}
          </div>
        )}
        {!reviews.loading && reviews.data?.items.length ? (
          <div className="review-grid">
            {reviews.data.items.slice(0, 3).map((review) => (
              <article className="review-card" key={review.id}>
                <MessageSquareQuote size={22} />
                <div className="review-stars" aria-label={`${review.rating} out of 5 stars`}>
                  {Array.from({ length: 5 }, (_, index) => (
                    <Star key={index} size={16} fill={index < review.rating ? "currentColor" : "none"} />
                  ))}
                </div>
                <h3>{review.title ?? "A customer experience review"}</h3>
                <p>{review.comment ?? "This customer review has no written comment."}</p>
              </article>
            ))}
          </div>
        ) : null}
        {!reviews.loading && !reviews.error && !reviews.data?.items.length && (
          <div className="empty review-empty">
            <MessageSquareQuote size={28} />
            <h3>Reviews are on their way.</h3>
            <p>Approved customer reviews will appear here. Customers can leave feedback from their account.</p>
            <Link className="button secondary" href="/dashboard/reviews">Go to reviews</Link>
          </div>
        )}
      </div>
    </section>
  );
}
