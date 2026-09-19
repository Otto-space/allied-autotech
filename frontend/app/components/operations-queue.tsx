"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useResource } from "@/lib/api/use-resource";
import { useAccountSession } from "./dashboard-shell";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
export function OperationsQueue<T>({
  title,
  description,
  endpoint,
  parse,
  filters,
  initialFilters = {},
  paginate = true,
  render,
}: {
  title: string;
  description: string;
  endpoint: string;
  parse: (value: unknown) => { items: T[]; nextCursor?: string };
  filters: {
    name: string;
    label: string;
    options: readonly string[];
    required?: boolean;
  }[];
  initialFilters?: Record<string, string>;
  paginate?: boolean;
  render: (
    item: T,
    actions: {
      disabled: boolean;
      uncertain: (key: string) => boolean;
      review: (key: string, proposal: MutationProposal) => void;
    },
  ) => ReactNode;
}) {
  const session = useAccountSession();
  const allowed = session?.user.role === "ADMIN" || session?.user.role === "SUPER_ADMIN";
  const [values, setValues] = useState(initialFilters);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [uncertain, setUncertain] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<string>();
  const pagination = useCursorPage();
  const query = new URLSearchParams({ limit: "25" });
  for (const [key, value] of Object.entries(values)) if (value) query.set(key, value);
  if (paginate && pagination.cursor) query.set("cursor", pagination.cursor);
  const records = useResource(allowed ? `${endpoint}?${query}` : null, parse);
  const disabled = records.loading || !!records.error || !!proposal;
  if (!allowed)
    return (
      <>
        <h1>{title}</h1>
        <Feedback message="Administrator access is required to view these records." />
      </>
    );
  return (
    <>
      <h1>{title}</h1>
      <p className="lead">{description}</p>
      <Link className="text-link" href="/admin">
        Back to operations
      </Link>
      <div className="catalogue-filters">
        {filters.map((filter) => (
          <div className="field" key={filter.name}>
            <label htmlFor={`operation-${filter.name}`}>{filter.label}</label>
            <select
              id={`operation-${filter.name}`}
              value={values[filter.name] ?? ""}
              disabled={!!proposal}
              onChange={(event) => {
                setValues((current) => ({
                  ...current,
                  [filter.name]: event.target.value,
                }));
                pagination.reset();
              }}
            >
              {!filter.required && <option value="">All</option>}
              {filter.options.map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <Feedback message={records.error} />
      <Feedback message={message} tone="info" />
      <div className="actions">
        <button
          className="button secondary"
          disabled={records.loading || !!proposal}
          onClick={records.refresh}
        >
          Refresh {title.toLowerCase()}
        </button>
        <button
          className="button secondary"
          disabled={!!proposal}
          onClick={() => {
            setValues(initialFilters);
            pagination.reset();
          }}
        >
          Clear filters
        </button>
      </div>
      {records.loading && <p role="status">Checking {title.toLowerCase()}…</p>}
      {!records.loading && !records.error && !records.data?.items.length && (
        <div className="empty">
          <h2>No matching records</h2>
          <p>Try another filter or refresh to check for updates.</p>
        </div>
      )}
      {!paginate && (
        <p className="notice">
          Showing up to 25 recent matching records. Older pages are not currently
          available in this view. Filter by source and status or consult the operational
          logs.{records.data?.nextCursor && " More matching records exist."}
        </p>
      )}
      {records.data?.items.map((item) =>
        render(item, {
          disabled,
          uncertain: (key) => !!uncertain[key],
          review: (key, next) => {
            if (disabled || uncertain[key]) return;
            setMessage(undefined);
            setProposal({
              ...next,
              onUncertain: () => {
                next.onUncertain?.();
                setUncertain((current) => ({ ...current, [key]: true }));
              },
            });
          },
        }),
      )}
      {paginate && (
        <CursorPagination
          pagination={pagination}
          nextCursor={records.data?.nextCursor}
          disabled={disabled}
          label={title}
        />
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => {
            setProposal(null);
            records.refresh();
          }}
          onSuccess={() =>
            setMessage(
              "Action recorded. Review the refreshed record for its current state.",
            )
          }
        />
      )}
    </>
  );
}
