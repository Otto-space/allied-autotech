"use client";
import { useState } from "react";
import { useResource } from "@/lib/api/use-resource";
import { parseStaffReviews, reviewLabels, reviewTargets } from "@/lib/api/review-schemas";
import { useAccountSession } from "./dashboard-shell";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
import { ReviewCard } from "./review-card";
import { ReviewModerationForm } from "./review-moderation-form";
export function StaffReviews() {
  const role = useAccountSession()?.user.role;
  const allowed = role === "ADMIN" || role === "SUPER_ADMIN";
  const [status, setStatus] = useState("PENDING");
  const [target, setTarget] = useState("");
  const [uncertain, setUncertain] = useState<string[]>([]);
  const [message, setMessage] = useState<string>();
  const pagination = useCursorPage();
  const records = useResource(
    allowed
      ? `/staff/support/reviews?limit=20&status=${status}${target ? `&targetType=${target}` : ""}${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`
      : null,
    parseStaffReviews,
  );
  if (!allowed)
    return (
      <>
        <h1>Review moderation</h1>
        <Feedback message="Administrator access is required to moderate reviews." />
      </>
    );
  return (
    <>
      <h1>Review moderation</h1>
      <p>
        Review customer submissions before public display. Reading this queue is recorded
        in the audit log.
      </p>
      <div className="catalogue-filters">
        <div className="field">
          <label htmlFor="moderation-status">Review status</label>
          <select
            id="moderation-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              pagination.reset();
            }}
          >
            {["PENDING", "APPROVED", "REJECTED"].map((value) => (
              <option key={value} value={value}>
                {value.toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="moderation-target">Review type</label>
          <select
            id="moderation-target"
            value={target}
            onChange={(event) => {
              setTarget(event.target.value);
              pagination.reset();
            }}
          >
            <option value="">All types</option>
            {reviewTargets.map((value) => (
              <option key={value} value={value}>
                {reviewLabels[value]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button
        className="button secondary"
        disabled={records.loading}
        onClick={records.refresh}
      >
        Refresh moderation queue
      </button>
      <Feedback message={records.error} />
      <Feedback message={message} tone="success" toast="Review decision saved." />
      {records.loading && <p role="status">Checking review submissions…</p>}
      {uncertain.length > 0 && (
        <p className="notice" role="status">
          A moderation result could not be confirmed. Refresh the queue to inspect its
          status. The affected review cannot be submitted again in this view.
        </p>
      )}
      {!records.loading && !records.error && records.data?.items.length === 0 && (
        <p className="empty">No reviews match this page and filters.</p>
      )}
      <h2>Submitted reviews</h2>
      <div className="review-list">
        {records.data?.items.map((review) => (
          <ReviewCard key={review.id} review={review}>
            <p>
              Submitted by {review.customer.firstName} {review.customer.lastName}
            </p>
            {review.status === "PENDING" && (
              <ReviewModerationForm
                key={`${review.id}:${review.version}`}
                review={review}
                disabled={
                  records.loading || !!records.error || uncertain.includes(review.id)
                }
                onUncertain={() => setUncertain((values) => [...values, review.id])}
                onSaved={() => {
                  setMessage("Moderation decision saved.");
                  records.refresh();
                }}
              />
            )}
          </ReviewCard>
        ))}
      </div>
      <CursorPagination
        pagination={pagination}
        nextCursor={records.data?.nextCursor}
        disabled={records.loading || !!records.error}
        label="Moderation"
      />
    </>
  );
}
