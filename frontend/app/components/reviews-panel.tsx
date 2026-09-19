"use client";
import { useState } from "react";
import { useResource } from "@/lib/api/use-resource";
import { parseReviews } from "@/lib/api/review-schemas";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
import { ReviewCard } from "./review-card";
import { ReviewCreateForm } from "./review-create-form";
export function ReviewsPanel() {
  const [status, setStatus] = useState("");
  const pagination = useCursorPage();
  const records = useResource(
    `/customers/support/reviews?limit=20${status ? `&status=${status}` : ""}${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`,
    parseReviews,
  );
  return (
    <>
      <span className="eyebrow">Your feedback</span>
      <h1>Reviews</h1>
      <ReviewCreateForm
        onSaved={() => {
          setStatus("");
          pagination.reset();
          records.refresh();
        }}
      />
      <section className="detail-section" aria-labelledby="review-history-title">
        <h2 id="review-history-title">Your submissions</h2>
        <div className="field">
          <label htmlFor="review-status">Moderation status</label>
          <select
            id="review-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              pagination.reset();
            }}
          >
            <option value="">All</option>
            {["PENDING", "APPROVED", "REJECTED"].map((value) => (
              <option key={value} value={value}>
                {value.toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <button
          className="button secondary"
          disabled={records.loading}
          onClick={records.refresh}
        >
          Refresh submissions
        </button>
        <Feedback message={records.error} />
        {records.loading && <p role="status">Checking your submissions…</p>}
        {!records.loading && !records.error && records.data?.items.length === 0 && (
          <p className="empty">
            {status || pagination.page > 1
              ? "No reviews match this page and status."
              : "You have not submitted any reviews."}
          </p>
        )}
        <div className="review-list">
          {records.data?.items.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
        <CursorPagination
          pagination={pagination}
          nextCursor={records.data?.nextCursor}
          disabled={records.loading || !!records.error}
          label="Your reviews"
        />
      </section>
    </>
  );
}
