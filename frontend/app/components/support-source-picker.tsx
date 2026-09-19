"use client";
import { useCallback } from "react";
import { useResource } from "@/lib/api/use-resource";
import {
  parseSupportSources,
  supportSourcePaths,
  type SupportSource,
  type SupportSourceType,
} from "@/lib/api/support-sources";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
export function SupportSourcePicker({
  type,
  value,
  onChange,
}: {
  type: SupportSourceType;
  value?: SupportSource;
  onChange: (value?: SupportSource) => void;
}) {
  const pagination = useCursorPage();
  const parse = useCallback((value: unknown) => parseSupportSources(type, value), [type]);
  const records = useResource(
    `${supportSourcePaths[type]}?limit=20${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`,
    parse,
  );
  return (
    <div className="field">
      <label htmlFor="support-source">Related record</label>
      <select
        id="support-source"
        value={value?.id ?? ""}
        disabled={records.loading || !!records.error}
        onChange={(event) =>
          onChange(records.data?.items.find((item) => item.id === event.target.value))
        }
      >
        <option value="">Choose a related record</option>
        {value && !records.data?.items.some((item) => item.id === value.id) && (
          <option value={value.id}>{value.label}</option>
        )}
        {records.data?.items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
      <Feedback message={records.error} />
      {records.loading && <p role="status">Loading related records…</p>}
      {!records.loading && !records.error && records.data?.items.length === 0 && (
        <p>No related records on this page.</p>
      )}
      <button
        type="button"
        className="button secondary"
        disabled={records.loading}
        onClick={records.refresh}
      >
        Refresh related records
      </button>
      <CursorPagination
        pagination={pagination}
        nextCursor={records.data?.nextCursor}
        disabled={records.loading || !!records.error}
        label="Related records"
      />
    </div>
  );
}
