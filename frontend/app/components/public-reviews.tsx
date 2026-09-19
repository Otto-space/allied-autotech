"use client";
import type { PublicSeed } from "@/lib/api/public-seed";
import { useState } from "react";
import Link from "next/link";
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
    <>
      <noscript>
        <p className="notice">
          Enable JavaScript to filter, load more results or refresh this list. You can
          still follow links on this page.
        </p>
      </noscript>
      <p>
        Approved customer feedback about services, parts, orders and vehicle purchases.
      </p>
      <Link href="/dashboard/reviews" className="text-link">
        Write or check your review
      </Link>
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
        Refresh reviews
      </button>
      <Feedback message={records.error} />
      {records.loading && <p role="status">Loading customer reviews…</p>}
      {!records.loading && !records.error && records.data?.items.length === 0 && (
        <p className="empty">No published reviews match this page and filters.</p>
      )}
      <h2>Published feedback</h2>
      <div className="review-list">
        {(!records.error ? records.data : undefined)?.items.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>
      <div className="public-review-pagination">
        <CursorPagination
          pagination={pagination}
          nextCursor={records.data?.nextCursor}
          disabled={records.loading || !!records.error}
          label="Published reviews"
        />
      </div>
    </>
  );
}
