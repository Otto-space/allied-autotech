"use client";
import { enquiryLabel } from "@/lib/support/enquiry-label";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ChevronRight, RefreshCw, Search } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import type { WorkforceAccess } from "@/lib/api/workforce-schemas";
import { sameWorkforceScope } from "@/lib/admin/workforce-overview";
import {
  enquiriesHref,
  enquiryTypeLabels,
  enquiryStatusLabels,
  enquiryStaffName,
  parseScopedWorkforceEnquiries,
  workforceEnquiriesPageParams,
  workforceEnquiriesQuery,
} from "@/lib/admin/workforce-enquiries";
import { formatBusinessDate } from "@/lib/format/date";
import { WorkforceEnquiryDetail } from "./workforce-enquiry-detail";
import "./workforce-enquiries.css";

export function WorkforceEnquiries({
  access,
  refreshAccess,
}: {
  access: WorkforceAccess;
  refreshAccess: () => void;
}) {
  const router = useRouter(),
    search = useSearchParams();
  const query = workforceEnquiriesQuery(new URLSearchParams(search.toString()));
  const [revision, setRevision] = useState(0);
  const record = useResource(query.path, parseScopedWorkforceEnquiries);
  const busy = record.loading || record.refreshing;
  const failure = record.error || record.refreshError;
  const mismatch = !!record.data && !sameWorkforceScope(access, record.data.access);
  const data = !query.invalid && !busy && !failure && !mismatch ? record.data : undefined;
  const selected = query.params.get("selected");
  const filtered = ["q", "type", "status"].some((name) => query.params.has(name));
  const navigate = (params: URLSearchParams) =>
    router.push(enquiriesHref(params), { scroll: false });
  function refresh() {
    refreshAccess();
    record.refresh();
    setRevision((v) => v + 1);
  }
  function select(id?: string) {
    const params = new URLSearchParams(query.params);
    params.delete("messageCursor");
    params.delete("messageId");
    params.delete("_messageTrail");
    if (id) params.set("selected", id);
    else params.delete("selected");
    navigate(params);
  }
  const first = new URLSearchParams(query.params);
  first.delete("cursor");
  first.delete("_trail");
  return (
    <div className="workforce-enquiries">
      <nav className="wfe-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">Enquiries</span>
          </li>
        </ol>
      </nav>
      <header className="wfe-heading">
        <div>
          <h1>Enquiries</h1>
          <p>Review conversations and respond within your responsibilities.</p>
        </div>
        <div className="wfe-refresh">
          <button
            className="button secondary"
            onClick={refresh}
            disabled={busy || query.invalid}
          >
            <RefreshCw size={17} aria-hidden="true" />
            {busy ? "Refreshing enquiries…" : "Refresh enquiries"}
          </button>
          {data && (
            <p>
              Updated{" "}
              <time dateTime={data.generatedAt}>
                {formatBusinessDate(data.generatedAt)}
              </time>
            </p>
          )}
        </div>
      </header>
      <form
        key={search.toString()}
        className="wfe-filters"
        aria-label="Filter enquiries"
        onSubmit={(e) => {
          e.preventDefault();
          const values = new FormData(e.currentTarget),
            params = new URLSearchParams();
          for (const name of ["q", "type", "status"]) {
            const v = String(values.get(name) ?? "").trim();
            if (v) params.set(name, v);
          }
          navigate(params);
          if (params.toString() === query.params.toString()) record.refresh();
        }}
      >
        <div className="field wfe-search">
          <label htmlFor="wfe-q">Search enquiries</label>
          <div>
            <Search size={18} aria-hidden="true" />
            <input
              id="wfe-q"
              data-learning-target="care-search"
              name="q"
              type="search"
              maxLength={120}
              defaultValue={query.params.get("q") ?? ""}
              placeholder="Subject or message"
              aria-describedby="wfe-search-hint"
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="wfe-type">Enquiry type</label>
          <select id="wfe-type" name="type" defaultValue={query.params.get("type") ?? ""}>
            <option value="">All enquiry types</option>
            {Object.entries(enquiryTypeLabels)
              .filter(
                ([value]) =>
                  access.permissions.includes("CUSTOMER_ENQUIRIES") ||
                  access.permissions.includes("CARE_CASE_VIEW") ||
                  ["PRODUCT", "VEHICLE"].includes(value),
              )
              .map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="wfe-status">Status</label>
          <select
            id="wfe-status"
            name="status"
            defaultValue={query.params.get("status") ?? ""}
          >
            <option value="">All enquiry states</option>
            {Object.entries(enquiryStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <p id="wfe-search-hint">Search covers all enquiries in your current scope.</p>
        <div className="wfe-filter-actions">
          <button className="button" disabled={busy}>
            Apply filters
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={(e) => {
              e.currentTarget.form?.reset();
              navigate(new URLSearchParams());
            }}
          >
            Clear filters
          </button>
        </div>
      </form>
      {(query.invalid || failure || mismatch) && (
        <section className="wfe-feedback" role="alert">
          <h2>
            {query.invalid
              ? "Enquiry filters unavailable"
              : mismatch
                ? "Your responsibilities changed"
                : record.denied
                  ? "Enquiry access unavailable"
                  : "Enquiries could not be refreshed"}
          </h2>
          <p>
            {query.invalid
              ? "This link contains invalid enquiry filters. Clear filters to start again."
              : "Refresh enquiries to check your current access and records. Previous results are hidden until verification succeeds."}
          </p>
        </section>
      )}
      <section
        className="wfe-results"
        data-learning-target="care-results"
        aria-labelledby="wfe-results-title"
        aria-busy={busy}
      >
        <header>
          <h2 id="wfe-results-title">Enquiries</h2>
          {data && <span role="status">{data.items.length} on this page</span>}
        </header>
        {busy && !query.invalid ? (
          <div className="wfe-state" role="status">
            Checking permitted enquiries…
            <div className="wfe-skeleton" aria-hidden="true" />
          </div>
        ) : data?.items.length ? (
          <table>
            <caption className="sr-only">
              Enquiries in your current responsibility scope
            </caption>
            <thead>
              <tr>
                {["Subject", "Type", "Branch", "Assigned to", "Status", "Open"].map(
                  (label) => (
                    <th scope="col" key={label}>
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr
                  key={row.id}
                  className={row.id === selected ? "is-selected" : undefined}
                >
                  <th scope="row">
                    {row.subject}
                    <small>
                      <time dateTime={row.createdAt}>
                        {formatBusinessDate(row.createdAt)}
                      </time>
                    </small>
                  </th>
                  <td data-label="Customer">
                    {row.contact?.name || "Not available in this scope"}
                  </td>
                  <td data-label="Type">
                    {enquiryLabel(row.type, row.vehicleEnquiryIntent)}
                  </td>
                  <td data-label="Branch">{row.branch?.name ?? "Branch not recorded"}</td>
                  <td data-label="Assigned to">{enquiryStaffName(row.assignedStaff)}</td>
                  <td data-label="Status">
                    <span
                      className={`wfe-status is-${row.status.toLowerCase()}`}
                      data-status={row.status}
                    >
                      {enquiryStatusLabels[row.status]}
                    </span>
                  </td>
                  <td data-label="Open">
                    <button
                      className="button secondary"
                      aria-label={`View enquiry: ${row.subject}`}
                      aria-pressed={row.id === selected}
                      onClick={() => select(row.id)}
                    >
                      View enquiry
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          data && (
            <div className="wfe-state">
              <h3>
                {filtered
                  ? "No enquiries match these filters"
                  : "No enquiries in your current scope"}
              </h3>
              <p>
                {filtered
                  ? "Adjust or clear filters to see other permitted enquiries."
                  : "Enquiries appear here when available within your responsibilities."}
              </p>
            </div>
          )
        )}
        {data && (
          <footer>
            <p>Only enquiries permitted by your current responsibilities are shown.</p>
            <nav aria-label="Enquiry pages">
              <button
                className="button secondary"
                disabled={!query.params.has("cursor")}
                onClick={() => navigate(first)}
              >
                First page
              </button>
              <button
                className="button secondary"
                disabled={!query.params.has("_trail")}
                onClick={() =>
                  navigate(workforceEnquiriesPageParams(query.params, undefined, true))
                }
              >
                Previous page
              </button>
              <button
                className="button secondary"
                disabled={!data.nextCursor}
                onClick={() =>
                  navigate(workforceEnquiriesPageParams(query.params, data.nextCursor))
                }
              >
                Next enquiries
              </button>
            </nav>
          </footer>
        )}
      </section>
      {selected && !query.invalid ? (
        <WorkforceEnquiryDetail
          key={`${access.userId}:${selected}`}
          id={selected}
          access={access}
          params={query.params}
          navigate={navigate}
          close={() => select()}
          refresh={refresh}
          refreshKey={revision}
          enabled={!!data}
          denied={record.denied || mismatch}
        />
      ) : (
        data && (
          <p className="wfe-selection-hint">
            Select an enquiry to review its conversation and available actions.
          </p>
        )
      )}
    </div>
  );
}
