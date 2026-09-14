"use client";
import { useState, type Ref } from "react";
import { z } from "zod";
import { useResource } from "@/lib/api/use-resource";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
const choice = z.object({
  id: z.string().uuid(),
  name: z.string(),
  durationMinutes: z.number().nullable().optional(),
  priceKobo: z.string().regex(/^\d+$/).nullable().optional(),
  pricingType: z.string().optional(),
});
const parseChoices = (value: unknown) =>
  z.object({ items: z.array(choice), nextCursor: z.string().optional() }).parse(value);
export function SlotCatalogPicker({
  kind,
  id,
  value,
  onChange,
  inputRef,
  error,
}: {
  kind: "branch" | "service";
  id: string;
  value: string;
  onChange: (value: string) => void;
  inputRef?: Ref<HTMLSelectElement>;
  error?: string;
}) {
  const pagination = useCursorPage();
  const [selectedLabel, setSelectedLabel] = useState("Selected record");
  const choices = useResource(
    `${kind === "branch" ? "/public/branches?" : "/public/services?pricingType=FIXED&"}limit=50${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`,
    parseChoices,
  );
  const visible =
    choices.data?.items.filter(
      (item) =>
        kind === "branch" ||
        (item.pricingType === "FIXED" &&
          typeof item.priceKobo === "string" &&
          item.durationMinutes != null),
    ) ?? [];
  return (
    <>
      <select
        id={id}
        ref={inputRef}
        value={value}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => {
          setSelectedLabel(
            event.target.selectedOptions[0]?.textContent ?? "Selected record",
          );
          onChange(event.target.value);
        }}
      >
        <option value="">Choose a {kind}</option>
        {value && !visible.some((item) => item.id === value) && (
          <option value={value}>{selectedLabel}</option>
        )}
        {visible.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
            {kind === "service" ? ` · ${item.durationMinutes} minutes` : ""}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
      {choices.loading && <p role="status">Loading {kind} choices…</p>}
      <Feedback message={choices.error} />
      {choices.error && (
        <button type="button" className="text-link" onClick={choices.refresh}>
          Retry {kind} choices
        </button>
      )}
      {!choices.loading && !choices.error && visible.length === 0 && (
        <p>No eligible {kind === "branch" ? "branches" : "services"} on this page.</p>
      )}
      {(choices.data?.nextCursor || pagination.page > 1) && (
        <CursorPagination
          pagination={pagination}
          nextCursor={choices.data?.nextCursor}
          disabled={choices.loading || !!choices.error}
          label={`${kind} choices`}
        />
      )}
    </>
  );
}
