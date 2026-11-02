"use client";
import "./customer-filter-picker.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useResource } from "@/lib/api/use-resource";
import { customersQuery, parseWorkCustomers } from "@/lib/admin/work-customers";
import { parseWorkCustomerDetail } from "@/lib/admin/work-customer-detail";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";

/** Read-only filter control. Mount only inside a verified administrator workspace. */
export function CustomerFilterPicker({
  id,
  value,
  onChange,
  disabled,
  error,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  error?: string;
}) {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [field, setField] = useState("name");
  const pagination = useCursorPage();
  const referenceInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (error) referenceInput.current?.focus();
  }, [error]);
  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const params = new URLSearchParams({ search: term, field });
  if (pagination.cursor) params.set("cursor", pagination.cursor);
  const query = customersQuery(params);
  const path =
    !disabled && term.length >= 2 && search.trim() === term ? query.path : null;
  const parse = useCallback(
    (data: unknown) => parseWorkCustomers(data, new URLSearchParams(path?.split("?")[1])),
    [path],
  );
  const results = useResource(path, parse);
  const parseSelected = useCallback(
    (data: unknown) => parseWorkCustomerDetail(data, value),
    [value],
  );
  const selected = useResource(
    !disabled && z.uuid().safeParse(value).success ? `/admin/customers/${value}` : null,
    parseSelected,
  );
  const busy = results.loading || results.refreshing;
  const failure = results.error || results.refreshError;
  const accessDenied = results.denied || selected.denied;
  const choices = failure || accessDenied ? [] : (results.data?.items ?? []);
  const selectedName =
    !accessDenied && selected.data && !selected.error && !selected.refreshError
      ? `${selected.data.firstName} ${selected.data.lastName} · ${selected.data.email}`
      : "Customer reference selected";
  return (
    <div className="customer-filter-picker">
      <div className="field customer-filter-selection">
        <label htmlFor={`${id}-choice`}>Customer (optional)</label>
        <select
          id={`${id}-choice`}
          value={value}
          disabled={disabled || busy}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">All customers</option>
          {value && !choices.some((row) => row.id === value) && (
            <option value={value}>{selectedName}</option>
          )}
          {choices.map((row) => (
            <option key={row.id} value={row.id}>
              {row.firstName} {row.lastName} · {row.email}
            </option>
          ))}
        </select>
        {value && (selected.error || selected.refreshError) && (
          <div>
            <p className="field-hint">
              The selected customer details are unavailable. The reference filter is
              retained.
            </p>
            <button
              type="button"
              className="text-link"
              disabled={disabled || selected.loading || selected.refreshing}
              onClick={selected.refresh}
            >
              Retry selected customer
            </button>
          </div>
        )}
      </div>
      <details>
        <summary>Find a customer</summary>
        <div className="field">
          <label htmlFor={`${id}-field`}>Search customers by</label>
          <select
            id={`${id}-field`}
            value={field}
            disabled={disabled}
            onChange={(event) => {
              setField(event.target.value);
              pagination.reset();
            }}
          >
            <option value="name">Name</option>
            <option value="email">Email</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-search`}>Customer search</label>
          <input
            id={`${id}-search`}
            value={search}
            disabled={disabled}
            maxLength={120}
            autoComplete="off"
            aria-describedby={`${id}-hint`}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
            }}
            onChange={(event) => {
              setSearch(event.target.value);
              pagination.reset();
            }}
          />
          <p id={`${id}-hint`} className="field-hint">
            Enter at least two characters from the start of a name or email, then choose
            the customer above.
          </p>
        </div>
        {query.invalid && term.length >= 2 && (
          <p role="alert">Check the customer search and try again.</p>
        )}
        {busy && <p role="status">Finding customers…</p>}
        <Feedback message={failure} />
        {failure && (
          <button
            type="button"
            className="button secondary"
            disabled={disabled || busy}
            onClick={results.refresh}
          >
            Retry customer search
          </button>
        )}
        {path && !busy && !failure && !accessDenied && results.data && (
          <>
            <p role="status">
              {choices.length
                ? `${choices.length} ${choices.length === 1 ? "customer" : "customers"} on this page. Choose from the Customer field.`
                : "No customers match this search."}
            </p>
            <CursorPagination
              pagination={pagination}
              nextCursor={results.data.nextCursor}
              disabled={disabled || busy}
              label="Customer search"
            />
          </>
        )}
      </details>
      <details open={!!error || undefined}>
        <summary>Use a customer reference</summary>
        <label htmlFor={id}>Customer profile reference (optional)</label>
        <input
          ref={referenceInput}
          id={id}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
          maxLength={36}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {error && (
          <p id={`${id}-error`} className="field-error" role="alert">
            {error}
          </p>
        )}
      </details>
    </div>
  );
}
