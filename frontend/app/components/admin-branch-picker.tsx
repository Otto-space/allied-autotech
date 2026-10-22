"use client";
import { useCallback, useEffect, useState, type Ref } from "react";
import { z } from "zod";
import { useResource } from "@/lib/api/use-resource";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
const parseBranches = (value: unknown) =>
  z
    .object({
      items: z.array(z.object({ id: z.uuid(), name: z.string(), isActive: z.boolean() })),
      nextCursor: z.uuid().optional(),
    })
    .parse(value);
export function AdminBranchPicker({
  id,
  value,
  onChange,
  activeOnly = true,
  inputRef,
  error,
  initialLabel = "Selected branch",
  onDenied,
}: {
  id: string;
  value: string;
  onChange: (id: string, label: string) => void;
  activeOnly?: boolean;
  inputRef?: Ref<HTMLSelectElement>;
  error?: string;
  initialLabel?: string;
  onDenied?: () => void;
}) {
  const pagination = useCursorPage();
  const [selectedLabel, setSelectedLabel] = useState(initialLabel);
  const branches = useResource(
    `/admin/branches?limit=25${activeOnly ? "&isActive=true" : ""}${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`,
    parseBranches,
  );
  const choices =
    branches.data?.items.filter((branch) => !activeOnly || branch.isActive) ?? [];
  const parseSelected = useCallback(
    (input: unknown) => {
      const branch = z
        .object({ id: z.uuid(), name: z.string().min(1), isActive: z.boolean() })
        .parse(input);
      if (branch.id !== value) throw Error("Unexpected selected branch");
      return branch;
    },
    [value],
  );
  const selected = useResource(
    value &&
      z.uuid().safeParse(value).success &&
      branches.data &&
      !choices.some((branch) => branch.id === value)
      ? `/admin/branches/${value}`
      : null,
    parseSelected,
  );
  const direct = selected.data;
  useEffect(() => {
    if (branches.denied || selected.denied) onDenied?.();
  }, [branches.denied, selected.denied, onDenied]);
  return (
    <>
      <select
        id={id}
        value={value}
        ref={inputRef}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => {
          const label = event.target.selectedOptions[0]?.textContent ?? "Selected branch";
          setSelectedLabel(label);
          onChange(event.target.value, label);
        }}
      >
        <option value="">
          {activeOnly ? "Choose an active branch" : "All branches"}
        </option>
        {value && !choices.some((branch) => branch.id === value) && (
          <option value={value}>
            {direct
              ? `${direct.name}${direct.isActive ? "" : " (inactive)"}`
              : selectedLabel}
          </option>
        )}
        {choices.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
            {branch.isActive ? "" : " (inactive)"}
          </option>
        ))}
      </select>
      {error && (
        <p className="field-error" role="alert" id={`${id}-error`}>
          {error}
        </p>
      )}
      {branches.loading && <p role="status">Loading branch choices…</p>}
      <Feedback message={branches.error} />
      <Feedback message={selected.error} />
      {selected.loading && <p role="status">Loading selected branch…</p>}
      {selected.error && (
        <button type="button" className="text-link" onClick={selected.refresh}>
          Retry selected branch
        </button>
      )}
      {branches.error && (
        <button type="button" className="text-link" onClick={branches.refresh}>
          Retry branch choices
        </button>
      )}
      {!branches.loading && !branches.error && !choices.length && (
        <p>No matching branches on this page.</p>
      )}
      {(branches.data?.nextCursor || pagination.page > 1) && (
        <CursorPagination
          pagination={pagination}
          nextCursor={branches.data?.nextCursor}
          disabled={branches.loading || !!branches.error}
          label="Branch choices"
        />
      )}
    </>
  );
}
