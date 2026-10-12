"use client";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { draftIdentity, draftKey, readDraft } from "@/lib/forms/drafts";
import { useResource } from "@/lib/api/use-resource";
import {
  reviewSourcePath,
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
  onAvailabilityChange,
  userId,
  draftId,
}: {
  target: Exclude<ReviewTarget, "BUSINESS">;
  value?: ReviewSource;
  onChange: (value?: ReviewSource) => void;
  disabled: boolean;
  onAvailabilityChange: (unavailable: boolean) => void;
  userId: string;
  draftId: string;
}) {
  const [restoringId, setRestoringId] = useState<string | undefined>(() => {
    if (typeof window === "undefined" || draftIdentity() !== `${userId}:CUSTOMER`) return;
    const fields = readDraft(
      draftKey(`${userId}:CUSTOMER`, window.location.pathname, draftId),
    );
    if (fields["targetType:0"] !== target) return;
    const saved = z.uuid().safeParse(fields["reviewSource:0"]);
    return saved.success ? saved.data : undefined;
  });
  const pagination = useCursorPage();
  const parse = useCallback((value: unknown) => reviewSources(target, value), [target]);
  const records = useResource(
    `${reviewSourcePath}?targetType=${target}&limit=20${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`,
    parse,
  );
  // Restore a selection from a later page using an owned eligibility read,
  // never by trusting a stored label or copying a partial review history.
  const restored = useResource(
    restoringId
      ? `${reviewSourcePath}?targetType=${target}&sourceId=${restoringId}`
      : null,
    parse,
  );
  const restoredSource = restored.data?.items.find((item) => item.id === restoringId);
  const choices = [...(records.data?.items ?? [])];
  if (restoredSource && !choices.some((item) => item.id === restoredSource.id))
    choices.push(restoredSource);
  const unavailable =
    records.loading ||
    records.refreshing ||
    !!records.error ||
    !!records.refreshError ||
    !records.data;
  useEffect(() => {
    onAvailabilityChange(unavailable);
  }, [unavailable, onAvailabilityChange]);
  return (
    <div className="field cr-source">
      <label htmlFor="review-source">Completed record</label>
      <select
        id="review-source"
        name="reviewSource"
        data-draft-context
        disabled={disabled || unavailable}
        aria-describedby="review-source-help"
        value={value?.id ?? ""}
        onChange={(event) => {
          onChange(choices.find((item) => item.id === event.target.value));
          setRestoringId(undefined);
        }}
      >
        <option value="">Choose a completed record</option>
        {value && !choices.some((item) => item.id === value.id) && (
          <option value={value.id}>{value.label}</option>
        )}
        {choices.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
      <p id="review-source-help">
        Only completed records from your account without an existing review are shown.
        Eligibility is checked again before submission.
      </p>
      <Feedback message={records.error || records.refreshError} />
      {restoringId && <Feedback message={restored.error || restored.refreshError} />}
      {restoringId && restored.data && !restoredSource && (
        <p>
          Your previously selected record is no longer available for review. Your feedback
          has been kept; choose another available record.
        </p>
      )}
      {records.loading && <p role="status">Loading completed records…</p>}
      {!records.loading && !records.error && records.data?.items.length === 0 && (
        <p>No completed records available for review on this page.</p>
      )}
      <button
        type="button"
        className="button secondary"
        disabled={disabled || records.loading || records.refreshing}
        onClick={() => {
          records.refresh();
          restored.refresh();
        }}
      >
        Refresh completed records
      </button>
      <CursorPagination
        pagination={pagination}
        nextCursor={!unavailable ? records.data?.nextCursor : undefined}
        disabled={disabled || records.loading || records.refreshing}
        label="Completed records"
      />
    </div>
  );
}
