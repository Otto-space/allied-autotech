"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, RefreshCw, Star } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import { parseReviews, reviewLabels, type ReviewRecord } from "@/lib/api/review-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import { useReviewWrite } from "@/lib/reviews/use-review-write";
import { useAccountSession } from "./dashboard-shell";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
import { ReviewCreateForm } from "./review-create-form";
import { MutationReview, type MutationProposal } from "./mutation-review";

const statuses = {
  PENDING: { label: "Pending", description: "Awaiting moderation." },
  APPROVED: { label: "Approved", description: "Approved for public display." },
  REJECTED: { label: "Rejected", description: "Not approved for public display." },
} as const;

function CustomerReview({ review }: { review: ReviewRecord }) {
  const state = statuses[review.status];
  return (
    <article className="cr-record" aria-labelledby={`review-${review.id}`}>
      <div className="cr-record-top">
        <span className="cr-rating" role="img" aria-label={`${review.rating} / 5 stars`}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              size={18}
              aria-hidden="true"
              fill={star <= review.rating ? "currentColor" : "none"}
            />
          ))}
          <span aria-hidden="true">{review.rating} / 5</span>
        </span>
        <strong className={`cr-status cr-status-${review.status.toLowerCase()}`}>
          {state.label}
        </strong>
      </div>
      <p className="cr-target">{reviewLabels[review.targetType]}</p>
      <h3 id={`review-${review.id}`}>
        {review.title || reviewLabels[review.targetType]}
      </h3>
      <p className="preserve-lines cr-comment">{review.comment}</p>
      <div className="cr-record-meta">
        <p>{formatBusinessDate(review.createdAt)}</p>
        <p>{state.description}</p>
      </div>
      {(review.moderationNote || review.moderatedAt) && (
        <div className="cr-moderation">
          <h4>Moderation update</h4>
          {review.moderatedAt && <p>{formatBusinessDate(review.moderatedAt)}</p>}
          {review.moderationNote && (
            <p className="preserve-lines">{review.moderationNote}</p>
          )}
        </div>
      )}
    </article>
  );
}

function CustomerReviews({ userId }: { userId: string }) {
  const [status, setStatus] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [recoveryProposal, setRecoveryProposal] = useState<MutationProposal | null>(null);
  const [formRevision, setFormRevision] = useState(0);
  const [recoveryMessage, setRecoveryMessage] = useState<string>();
  const pagination = useCursorPage();
  const records = useResource(
    `/customers/support/reviews?limit=20${status ? `&status=${status}` : ""}${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`,
    parseReviews,
  );
  const guard = useReviewWrite(userId, records);
  const reading = records.loading || records.refreshing;
  const stale = !!(records.error || records.refreshError);
  function reviewRecovery() {
    const intent = guard.intent;
    if (!intent || guard.busy || guard.remaining > 0 || reviewOpen) return;
    setReviewOpen(true);
    setRecoveryProposal({
      title: "Send or recover this review?",
      description:
        "This uses your exact original submission. If it was received, its saved result is returned. Otherwise it is submitted once for moderation. Your current form edits will not replace the original request.",
      facts: [
        { label: "Experience", value: reviewLabels[intent.body.targetType] },
        { label: "Rating", value: `${intent.body.rating} / 5` },
        { label: "Title", value: intent.body.title || "No title" },
        { label: "Review", value: intent.body.comment },
      ],
      retryAfterRejection: false,
      submit: async () => {
        await guard.recover();
        setStatus("");
        pagination.reset();
        records.refresh();
        setFormRevision((value) => value + 1);
        setRecoveryMessage(
          "Review confirmed. Check Your submissions for its current moderation status.",
        );
      },
    });
  }
  function refresh() {
    if (reviewOpen || guard.busy) return;
    if (guard.pending) {
      setStatus("");
      pagination.reset();
    }
    guard.refresh();
  }
  return (
    <div className="customer-reviews">
      <header className="cr-heading">
        <div>
          <span className="eyebrow">Your feedback</span>
          <h1>Reviews</h1>
          <p>Share your experience and follow your submissions.</p>
        </div>
        <Link href="/reviews">
          Read public reviews <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </header>
      <Feedback message={guard.storageError} />
      <Feedback message={recoveryMessage} tone="success" />
      {guard.pending && (
        <section className="cr-recovery" aria-label="Review recovery">
          <Feedback
            tone="warning"
            message={
              guard.intent
                ? "Your submission has an unknown outcome. Review the original request to send or recover it safely within 24 hours. Nothing is resent automatically."
                : "Your submission has an unknown outcome and its original recovery request is unavailable or expired. Refresh your submissions and check the saved reviews before starting another review. This form will not resend it."
            }
          />
          <p>
            Check all relevant history pages. A review missing from the first page does
            not prove that it was not received.
          </p>
          <div className="actions">
            {guard.intent && (
              <button
                className="button"
                disabled={guard.busy || reviewOpen || guard.remaining > 0}
                onClick={reviewRecovery}
              >
                Review original submission
              </button>
            )}
            <a className="button secondary" href="#review-history-title">
              View submission history
            </a>
            {!guard.intent && (
              <button
                className="button secondary"
                disabled={
                  !guard.canAcknowledge || reviewOpen || !!status || pagination.page !== 1
                }
                onClick={guard.acknowledge}
              >
                I have checked my submissions
              </button>
            )}
          </div>
        </section>
      )}
      {stale && records.data && (
        <Feedback
          tone="warning"
          message="Your submissions are out of date. Refresh them before sending another review."
        />
      )}
      <div className="cr-layout">
        <ReviewCreateForm
          key={formRevision}
          userId={userId}
          guard={guard}
          onReviewChange={setReviewOpen}
          onSaved={() => {
            setStatus("");
            pagination.reset();
            records.refresh();
          }}
        />
        <section
          className="cr-history"
          aria-labelledby="review-history-title"
          aria-busy={reading}
        >
          <div className="cr-history-heading">
            <h2 id="review-history-title">Your submissions</h2>
            <p>Track your moderation status.</p>
          </div>
          <div className="cr-history-controls">
            <div className="field">
              <label htmlFor="review-status">Moderation status</label>
              <select
                id="review-status"
                value={status}
                disabled={reading || reviewOpen || guard.busy}
                onChange={(event) => {
                  setStatus(event.target.value);
                  pagination.reset();
                }}
              >
                <option value="">All</option>
                {Object.entries(statuses).map(([value, item]) => (
                  <option key={value} value={value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="button secondary"
              disabled={reading || reviewOpen || guard.busy}
              onClick={refresh}
            >
              <RefreshCw size={16} aria-hidden="true" /> Refresh submissions
            </button>
          </div>
          <Feedback message={records.error || records.refreshError} />
          {records.loading && (
            <div className="cr-loading" role="status">
              <span className="sr-only">Checking your submissions...</span>
              {[1, 2].map((row) => (
                <div key={row} className="cr-skeleton" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              ))}
            </div>
          )}
          {!records.loading && !records.error && records.data?.items.length === 0 && (
            <div className="cr-empty">
              <h3>
                {status || pagination.page > 1 ? "No matching reviews" : "No reviews yet"}
              </h3>
              <p>
                {status || pagination.page > 1
                  ? "No reviews match this page and status."
                  : "You have not submitted any reviews."}
              </p>
              {status && (
                <button
                  className="button secondary"
                  onClick={() => {
                    setStatus("");
                    pagination.reset();
                  }}
                >
                  Clear status filter
                </button>
              )}
            </div>
          )}
          {!records.loading && !records.error && (
            <div className="review-list">
              {records.data?.items.map((review) => (
                <CustomerReview key={review.id} review={review} />
              ))}
            </div>
          )}
          <CursorPagination
            pagination={pagination}
            nextCursor={!stale ? records.data?.nextCursor : undefined}
            disabled={reading || reviewOpen || guard.busy}
            label="Your reviews"
          />
        </section>
      </div>
      {recoveryProposal && (
        <MutationReview
          proposal={recoveryProposal}
          onClose={() => {
            setRecoveryProposal(null);
            setReviewOpen(false);
          }}
          onSuccess={() => {}}
          confirmLabel="Send or recover review"
        />
      )}
    </div>
  );
}

export function ReviewsPanel() {
  const session = useAccountSession();
  if (!session || session.user.role !== "CUSTOMER") return null;
  return <CustomerReviews key={session.user.id} userId={session.user.id} />;
}
