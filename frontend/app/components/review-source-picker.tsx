"use client";
import { useCallback } from "react";
import { useResource } from "@/lib/api/use-resource";
import {
  reviewSourcePaths,
  reviewSources,
  type ReviewSource,
  type ReviewTarget,
} from "@/lib/api/review-schemas";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
export function ReviewSourcePicker({
  target,
  value,
  onChange,
  disabled,
}: {
  target: Exclude<ReviewTarget, "BUSINESS">;
  value?: ReviewSource;
  onChange: (value?: ReviewSource) => void;
  disabled: boolean;
}) {
  const pagination = useCursorPage();
  const parse = useCallback((value: unknown) => reviewSources(target, value), [target]);
  const records = useResource(
    `${reviewSourcePaths[target]}?status=COMPLETED&limit=20${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`,
    parse,
  );
  return (
    <div className="field">
      <label htmlFor="review-source">Completed record</label>
      <select
        id="review-source"
        disabled={disabled || records.loading || !!records.error}
        value={value?.id ?? ""}
        onChange={(event) =>
          onChange(records.data?.items.find((item) => item.id === event.target.value))
        }
      >
        <option value="">Choose a completed record</option>
        {value && !records.data?.items.some((item) => item.id === value.id) && (
          <option value={value.id}>{value.label}</option>
        )}
        {records.data?.items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
      <p>
        Only completed records from your account are shown. Eligibility is checked again
        before submission.
      </p>
      <Feedback message={records.error} />
      {records.loading && <p role="status">Loading completed records…</p>}
      {!records.loading && !records.error && records.data?.items.length === 0 && (
        <p>No completed records on this page.</p>
      )}
      <button
        type="button"
        className="button secondary"
        disabled={disabled || records.loading}
        onClick={records.refresh}
      >
        Refresh completed records
      </button>
      <CursorPagination
        pagination={pagination}
        nextCursor={records.data?.nextCursor}
        disabled={disabled || records.loading || !!records.error}
        label="Completed records"
      />
    </div>
  );
}
