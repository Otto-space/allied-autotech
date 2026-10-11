import { formatBusinessDate } from "@/lib/format/date";
import { Star } from "lucide-react";
import {
  reviewLabels,
  type PublicReview,
  type ReviewRecord,
} from "@/lib/api/review-schemas";
export function ReviewCard({
  review,
  children,
  variant = "default",
}: {
  review: PublicReview | ReviewRecord;
  children?: React.ReactNode;
  variant?: "default" | "editorial";
}) {
  if (variant === "editorial")
    return (
      <article className="review-card review-card--editorial">
        <div className="review-card-rating">
          <span>{reviewLabels[review.targetType]}</span>
          <p aria-label={`${review.rating} out of 5 stars`}>
            <strong>{review.rating}</strong> / 5
          </p>
          <div className="review-card-stars" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={16}
                className={star <= review.rating ? "filled" : undefined}
              />
            ))}
          </div>
        </div>
        <div className="review-card-content">
          <h3>
            {review.title ||
              review.product?.name ||
              review.service?.name ||
              "Customer feedback"}
          </h3>
          <p className="review-comment">{review.comment}</p>
          <p className="review-card-date">
            Submitted{" "}
            <time dateTime={review.createdAt}>
              {formatBusinessDate(review.createdAt)}
            </time>
          </p>
        </div>
      </article>
    );
  return (
    <article className="review-card">
      <span className="eyebrow">{reviewLabels[review.targetType]}</span>
      <h3>
        {review.title ||
          review.product?.name ||
          review.service?.name ||
          "Customer feedback"}
      </h3>
      <p aria-label={`${review.rating} out of 5 stars`}>{review.rating} / 5 stars</p>
      <p className="review-comment">{review.comment}</p>
      <time dateTime={review.createdAt}>{formatBusinessDate(review.createdAt)}</time>
      {"status" in review && (
        <>
          <p className="status">{review.status.toLowerCase()}</p>
          {review.moderationNote && <p>Moderation note: {review.moderationNote}</p>}
        </>
      )}
      {children}
    </article>
  );
}
