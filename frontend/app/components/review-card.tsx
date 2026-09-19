import { formatBusinessDate } from "@/lib/format/date";
import {
  reviewLabels,
  type PublicReview,
  type ReviewRecord,
} from "@/lib/api/review-schemas";
export function ReviewCard({
  review,
  children,
}: {
  review: PublicReview | ReviewRecord;
  children?: React.ReactNode;
}) {
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
