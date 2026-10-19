"use client";
import { useCallback, useEffect, useState, type Ref } from "react";
import { useResource } from "@/lib/api/use-resource";
import { z } from "zod";
import {
  invoiceSourceLabels,
  parseInvoiceSources,
  type InvoiceSourceType,
  type InvoiceSource,
} from "@/lib/admin/work-invoices";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
export function InvoiceSourcePicker({
  kind,
  value,
  onChange,
  onSelected,
  onDenied,
  inputRef,
  error,
}: {
  kind: InvoiceSourceType;
  value: string;
  onChange: (id: string, label: string) => void;
  onSelected?: (value: InvoiceSource | undefined) => void;
  onDenied?: () => void;
  inputRef: Ref<HTMLSelectElement>;
  error?: string;
}) {
  const pagination = useCursorPage(),
    [search, setSearch] = useState(""),
    [term, setTerm] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setTerm(search.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  const params = new URLSearchParams({ sourceType: kind, limit: "25" });
  if (term.length >= 2) params.set("search", term);
  if (pagination.cursor) params.set("cursor", pagination.cursor);
  const parse = useCallback(
    (v: unknown) => parseInvoiceSources(v, kind, undefined, pagination.cursor ?? null),
    [kind, pagination.cursor],
  );
  const sources = useResource(
    term.length === 1 || search.trim() !== term
      ? null
      : `/staff/invoices/sources?${params}`,
    parse,
  );
  const parseSelected = useCallback(
    (v: unknown) => parseInvoiceSources(v, kind, value),
    [kind, value],
  );
  const selected = useResource(
    value &&
      z.uuid().safeParse(value).success &&
      !sources.data?.items.some((v) => v.id === value)
      ? `/staff/invoices/sources?sourceType=${kind}&sourceId=${value}&limit=25`
      : null,
    parseSelected,
  );
  const current =
    sources.data?.items.find((v) => v.id === value) ?? selected.data?.items[0];
  useEffect(() => {
    onSelected?.(current);
  }, [current, onSelected]);
  useEffect(() => {
    if (sources.denied || selected.denied) onDenied?.();
  }, [sources.denied, selected.denied, onDenied]);
  const busy = sources.loading || sources.refreshing || search.trim() !== term;
  return (
    <>
      <div className="iv-source-search">
        <label className="wi-source-search-label" htmlFor="invoice-source-search">
          Find a source record
        </label>
        <input
          id="invoice-source-search"
          type="search"
          value={search}
          maxLength={120}
          autoComplete="off"
          onChange={(e) => {
            setSearch(e.target.value);
            pagination.reset();
          }}
          aria-describedby="invoice-source-search-hint"
          placeholder="Record prefix or exact UUID"
        />
        <p id="invoice-source-search-hint" className="field-hint">
          Search by record, service or vehicle-title prefix (2+ characters), or exact
          UUID.
        </p>
      </div>
      <div className="iv-source-choice">
        <label htmlFor="invoice-source">Source record</label>
        <select
          id="invoice-source"
          ref={inputRef}
          value={value}
          disabled={
            busy || !!sources.error || !!sources.refreshError || term.length === 1
          }
          aria-invalid={!!error}
          aria-describedby={error ? "invoice-source-error" : "invoice-source-hint"}
          onChange={(e) =>
            onChange(e.target.value, e.target.selectedOptions[0]?.textContent ?? "")
          }
        >
          <option value="">Choose a {invoiceSourceLabels[kind].toLowerCase()}</option>
          {value && !sources.data?.items.some((v) => v.id === value) && (
            <option value={value}>
              {current?.label ?? "Selected source — checking availability"}
            </option>
          )}
          {sources.data?.items.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="field-error" id="invoice-source-error" role="alert">
            {error}
          </p>
        )}
        <p className="field-hint" id="invoice-source-hint">
          Only sources without an invoice are listed. The server checks pricing and
          eligibility at creation.
        </p>
        {term.length === 1 && (
          <p role="status">Enter at least two characters to search.</p>
        )}
        {busy && <p role="status">Loading invoice sources…</p>}
        <Feedback
          message={
            sources.error ||
            sources.refreshError ||
            selected.error ||
            selected.refreshError
          }
        />
        {(sources.error ||
          sources.refreshError ||
          selected.error ||
          selected.refreshError) && (
          <button
            type="button"
            className="text-link"
            onClick={() => {
              sources.refresh();
              selected.refresh();
            }}
          >
            Retry invoice sources
          </button>
        )}
        {value && selected.loading && <p role="status">Checking selected source…</p>}
        {value && !selected.loading && !current && !selected.error && (
          <p role="status">
            This source is no longer available for a new invoice. Check whether an invoice
            already exists.
          </p>
        )}
        {current && (
          <p className="iv-source-current">
            <strong>Selected: {current.label}</strong>
            <span>Reference: {current.id}</span>
            <span>{current.branch?.name ?? "Unassigned branch"}</span>
          </p>
        )}
        {!busy && !sources.error && sources.data?.items.length === 0 && (
          <p>No eligible sources match this search on this page.</p>
        )}
        {(sources.data?.nextCursor || pagination.page > 1) && (
          <CursorPagination
            pagination={pagination}
            nextCursor={sources.data?.nextCursor}
            disabled={busy || !!sources.error || !!sources.refreshError}
            label="Invoice sources"
          />
        )}
      </div>
    </>
  );
}
