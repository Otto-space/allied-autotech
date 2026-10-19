"use client";
import { useEffect, useState, type Ref } from "react";
import { useResource } from "@/lib/api/use-resource";
import { parseAdminServiceCategories } from "@/lib/admin/service-catalogue";
import { CursorPagination, useCursorPage } from "./cursor-pagination";

export function WorkServiceCategory({
  id,
  value,
  onChange,
  initialLabel,
  activeOnly = false,
  onAvailabilityChange,
  inputRef,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  initialLabel?: string;
  activeOnly?: boolean;
  onAvailabilityChange?: (blocked: boolean) => void;
  inputRef?: Ref<HTMLSelectElement>;
}) {
  const pagination = useCursorPage();
  const [label, setLabel] = useState(initialLabel ?? "Selected category");
  const params = new URLSearchParams({ limit: "100" });
  if (activeOnly) params.set("isActive", "true");
  if (pagination.cursor) params.set("cursor", pagination.cursor);
  const choices = useResource(
    `/admin/service-categories?${params}`,
    parseAdminServiceCategories,
  );
  const blocked =
    choices.loading ||
    choices.refreshing ||
    !!choices.error ||
    !!choices.refreshError ||
    !choices.data;
  useEffect(() => onAvailabilityChange?.(blocked), [blocked, onAvailabilityChange]);
  return (
    <>
      <select
        id={id}
        name="categoryId"
        ref={inputRef}
        value={value}
        disabled={blocked}
        onChange={(e) => {
          setLabel(e.target.selectedOptions[0]?.textContent ?? "Selected category");
          onChange(e.target.value);
        }}
      >
        <option value="">{activeOnly ? "No category" : "All categories"}</option>
        {value && !choices.data?.items.some((c) => c.id === value) && (
          <option value={value}>{label}</option>
        )}
        {choices.data?.items.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {!c.isActive ? " (inactive)" : ""}
          </option>
        ))}
      </select>
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
          label={activeOnly ? "Service category choices" : "Filter category choices"}
        />
      )}
    </>
  );
}
