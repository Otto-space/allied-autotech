"use client";
import { useState, type Ref } from "react";
import { useResource } from "@/lib/api/use-resource";
import {
  invoiceSourceOptions,
  type InvoiceSourceType,
} from "@/lib/api/invoice-source-schemas";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
export function InvoiceSourcePicker({
  kind,
  value,
  onChange,
  inputRef,
  error,
}: {
  kind: InvoiceSourceType;
  value: string;
  onChange: (id: string, label: string) => void;
  inputRef: Ref<HTMLSelectElement>;
  error?: string;
}) {
  const pagination = useCursorPage();
  const [selectedLabel, setSelectedLabel] = useState("Selected source");
  const config = invoiceSourceOptions[kind];
  const sources = useResource(
    `${config.path}?limit=25${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`,
    config.parse,
  );
  return (
    <>
      <select
        id="invoice-source"
        ref={inputRef}
        value={value}
        aria-invalid={!!error}
        aria-describedby={error ? "invoice-source-error" : "invoice-source-hint"}
        onChange={(event) => {
          const label = event.target.selectedOptions[0]?.textContent ?? "Selected source";
          setSelectedLabel(label);
          onChange(event.target.value, label);
        }}
      >
        <option value="">Choose a {config.label.toLowerCase()}</option>
        {value && !sources.data?.items.some((item) => item.id === value) && (
          <option value={value}>{selectedLabel}</option>
        )}
        {sources.data?.items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="field-error" id="invoice-source-error" role="alert">
          {error}
        </p>
      )}
      <p className="field-hint" id="invoice-source-hint">
        Choose an existing record within your permitted branches. The server checks
        eligibility and any existing invoice.
      </p>
      {sources.loading && <p role="status">Loading invoice sources…</p>}
      <Feedback message={sources.error} />
      {sources.error && (
        <button type="button" className="text-link" onClick={sources.refresh}>
          Retry invoice sources
        </button>
      )}
      {!sources.loading && !sources.error && sources.data?.items.length === 0 && (
        <p>No eligible sources on this page.</p>
      )}
      {(sources.data?.nextCursor || pagination.page > 1) && (
        <CursorPagination
          pagination={pagination}
          nextCursor={sources.data?.nextCursor}
          disabled={sources.loading || !!sources.error}
          label="Invoice sources"
        />
      )}
    </>
  );
}
