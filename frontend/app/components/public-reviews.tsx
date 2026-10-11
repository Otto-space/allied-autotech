"use client";
import type { PublicSeed } from "@/lib/api/public-seed";
import { useState } from "react";
import { MessageSquare, RefreshCw } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import {
  parsePublicReviews,
  reviewLabels,
  reviewTargets,
} from "@/lib/api/review-schemas";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
import { ReviewCard } from "./review-card";
export function PublicReviews({
  initial,
}: {
  initial?: PublicSeed<ReturnType<typeof parsePublicReviews>>;
}) {
  const [target, setTarget] = useState("");
  const pagination = useCursorPage();
  const records = useResource(
    `/public/support/reviews?limit=20${target ? `&targetType=${target}` : ""}${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`,
    parsePublicReviews,
    initial?.data,
    { initialError: initial?.error, revalidateOnMount: false },
  );
  return (
    <div className="reviews-feed">
      <noscript>
        <p className="notice">
          Enable JavaScript to filter, load more results or refresh this list. You can
          still follow links on this page.
        </p>
      </noscript>
      <h2 id="published-feedback-title">Published feedback</h2>
      <p className="reviews-feed-description">Newest published feedback first.</p>
      <div className="reviews-toolbar">
        <div className="field">
          <label htmlFor="public-review-type">Review type</label>
          <select
            id="public-review-type"
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
        <button
          className="button secondary"
          disabled={records.loading}
          onClick={records.refresh}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Refresh reviews
        </button>
      </div>
      <Feedback message={records.error} />
      <Feedback message={records.refreshError} />
      <div role="status" className="reviews-load-status">
        {records.loading
          ? "Loading customer reviews…"
          : records.refreshing
            ? "Checking for updated feedback…"
            : !records.error && records.data
              ? `${records.data.items.length} ${records.data.items.length === 1 ? "review" : "reviews"} on this page${target ? ` · ${reviewLabels[target as keyof typeof reviewLabels]}` : ""}.`
              : ""}
      </div>
      {!records.loading && !records.error && records.data?.items.length === 0 && (
        <div className="reviews-empty">
          <MessageSquare size={28} strokeWidth={1.5} aria-hidden="true" />
          <h3>
            {target
              ? "No feedback for this review type"
              : pagination.page > 1
                ? "No more feedback on this page"
                : "No published feedback yet"}
          </h3>
          <p>
            {target
              ? "Try all review types to see other published feedback."
              : pagination.page > 1
                ? "Go to the previous page or refresh to check again."
                : "When customer reviews are approved, they will appear here."}
          </p>
          {target && (
            <button
              className="button secondary"
              type="button"
              onClick={() => {
                setTarget("");
                pagination.reset();
              }}
            >
              Show all review types
            </button>
          )}
        </div>
      )}
      <div className="review-list" aria-busy={records.loading}>
        {(!records.error && !records.loading ? records.data : undefined)?.items.map(
          (review) => (
            <ReviewCard key={review.id} review={review} variant="editorial" />
          ),
        )}
      </div>
      <div className="public-review-pagination">
        <CursorPagination
          pagination={pagination}
          nextCursor={records.data?.nextCursor}
          disabled={records.loading || !!records.error}
          label="Published reviews"
        />
      </div>
    </div>
  );
}
