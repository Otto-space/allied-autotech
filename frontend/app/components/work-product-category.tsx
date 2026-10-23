"use client";
import { useEffect, useState, type Ref } from "react";
import { useResource } from "@/lib/api/use-resource";
import { parseProductCategories } from "@/lib/admin/product-catalogue";
import { CursorPagination, useCursorPage } from "./cursor-pagination";

export function WorkProductCategory({
  id,
  value,
  onChange,
  initialLabel,
  initialValue,
  onLabelChange,
  onAvailabilityChange,
  inputRef,
  filter = false,
  invalid,
  describedBy,
  rootOnly = false,
  excludeId,
}: {
  id: string;
  value: string;
  onChange: (value: string, label: string) => void;
  initialLabel?: string;
  initialValue?: string;
  onLabelChange?: (label: string) => void;
  onAvailabilityChange?: (blocked: boolean) => void;
  inputRef?: Ref<HTMLSelectElement>;
  filter?: boolean;
  invalid?: boolean;
  describedBy?: string;
  rootOnly?: boolean;
  excludeId?: string;
}) {
  const pagination = useCursorPage();
  const [selection, setSelection] = useState({ id: initialValue, label: initialLabel });
  const query = new URLSearchParams({ limit: "100" });
  if (rootOnly) query.set("rootOnly", "true");
  if (pagination.cursor) query.set("cursor", pagination.cursor);
  const choices = useResource(
    `/admin/catalog/categories?${query}`,
    parseProductCategories,
  );
  const blocked =
    choices.loading ||
    choices.refreshing ||
    !!choices.error ||
    !!choices.refreshError ||
    !choices.data;
  const selected = choices.data?.items.find((r) => r.id === value);
  const label = selected
    ? `${selected.name}${selected.isActive ? "" : " (inactive)"}`
    : selection.id === value
      ? (selection.label ?? "")
      : "";
  useEffect(() => onAvailabilityChange?.(blocked), [blocked, onAvailabilityChange]);
  useEffect(() => onLabelChange?.(label), [label, onLabelChange]);
  return (
    <>
      <select
        id={id}
        name={rootOnly ? "parentId" : filter ? undefined : "categoryId"}
        ref={inputRef}
        value={value}
        disabled={blocked}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={(e) => {
          const nextLabel =
            e.target.selectedOptions[0]?.textContent ?? "Selected category";
          setSelection({ id: e.target.value, label: nextLabel });
          onChange(e.target.value, nextLabel);
        }}
      >
        <option value="">
          {rootOnly
            ? "None (top-level category)"
            : filter
              ? "All categories"
              : "Choose category"}
        </option>
        {value && !choices.data?.items.some((r) => r.id === value) && (
          <option value={value}>
            {label || "Selected category — choose again to verify"}
          </option>
        )}
        {choices.data?.items
          .filter((r) => r.id !== excludeId)
          .map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
              {!r.isActive ? " (inactive)" : ""}
            </option>
          ))}
      </select>
      {value && !label && !filter && !blocked && (
        <span className="field-hint" role="status">
          Find and select the saved category in these pages before reviewing.
        </span>
      )}
      {choices.loading && (
        <span className="field-hint" role="status">
          Loading categories…
        </span>
      )}
      {(choices.error || choices.refreshError) && (
        <p className="field-error" role="alert">
          Categories could not be loaded.{" "}
          <button type="button" className="text-link" onClick={choices.refresh}>
            Retry categories
          </button>
        </p>
      )}
      {(choices.data?.nextCursor || pagination.page > 1) && (
        <CursorPagination
          pagination={pagination}
          nextCursor={choices.data?.nextCursor}
          disabled={blocked}
          label="Product category choices"
        />
      )}
    </>
  );
}
