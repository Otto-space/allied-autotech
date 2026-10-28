"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ChevronRight, RefreshCw, Search } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import type { WorkforceAccess } from "@/lib/api/workforce-schemas";
import { sameWorkforceScope } from "@/lib/admin/workforce-overview";
import {
  complaintsHref,
  complaintPriorityLabels,
  complaintStatusLabels,
  parseScopedWorkforceComplaints,
  workforceComplaintsPageParams,
  workforceComplaintsQuery,
} from "@/lib/admin/workforce-complaints";
import { formatBusinessDate } from "@/lib/format/date";
import { WorkforceComplaintDetail } from "./workforce-complaint-detail";
import "./workforce-complaints.css";

export function WorkforceComplaints({
  access,
  refreshAccess,
}: {
  access: WorkforceAccess;
  refreshAccess: () => void;
}) {
  const router = useRouter(),
    search = useSearchParams();
  const query = workforceComplaintsQuery(new URLSearchParams(search.toString()));
  const [revision, setRevision] = useState(0);
  const record = useResource(query.path, parseScopedWorkforceComplaints);
  const busy = record.loading || record.refreshing;
  const failure = record.error || record.refreshError;
  const mismatch = !!record.data && !sameWorkforceScope(access, record.data.access);
  const data = !query.invalid && !busy && !failure && !mismatch ? record.data : undefined;
  const selected = query.params.get("selected");
  const filtered = ["q", "priority", "status"].some((name) => query.params.has(name));
  const navigate = (params: URLSearchParams) =>
    router.push(complaintsHref(params), { scroll: false });
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
    <div className="workforce-complaints">
      <nav className="wfc-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">Complaints</span>
          </li>
        </ol>
      </nav>
      <header className="wfc-heading">
        <div>
          <h1>Complaints</h1>
          <p>Review complaints and respond within your responsibilities.</p>
        </div>
        <div className="wfc-refresh">
          <button
            className="button secondary"
            onClick={refresh}
            disabled={busy || query.invalid}
          >
            <RefreshCw size={17} aria-hidden="true" />
            {busy ? "Refreshing records…" : "Refresh records"}
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
        className="wfc-filters"
        aria-label="Filter complaints"
        onSubmit={(e) => {
          e.preventDefault();
          const values = new FormData(e.currentTarget),
            params = new URLSearchParams();
          for (const name of ["q", "priority", "status"]) {
            const v = String(values.get(name) ?? "").trim();
            if (v) params.set(name, v);
          }
          navigate(params);
          if (params.toString() === query.params.toString()) record.refresh();
        }}
      >
        <div className="field wfc-search">
          <label htmlFor="wfc-q">Search complaints</label>
          <div>
            <Search size={18} aria-hidden="true" />
            <input
              id="wfc-q"
              name="q"
              type="search"
              maxLength={120}
              defaultValue={query.params.get("q") ?? ""}
              placeholder="Subject or message"
              aria-describedby="wfc-search-hint"
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="wfc-priority">Priority</label>
          <select
            id="wfc-priority"
            name="priority"
            defaultValue={query.params.get("priority") ?? ""}
          >
            <option value="">All priorities</option>
            {Object.entries(complaintPriorityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="wfc-status">Status</label>
          <select
            id="wfc-status"
            name="status"
            defaultValue={query.params.get("status") ?? ""}
          >
            <option value="">All complaint states</option>
            {Object.entries(complaintStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <p id="wfc-search-hint">Search covers all complaints in your current scope.</p>
        <div className="wfc-filter-actions">
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
        <section className="wfc-feedback" role="alert">
          <h2>
            {query.invalid
              ? "Complaint filters unavailable"
              : mismatch
                ? "Your responsibilities changed"
                : record.denied
                  ? "Complaint access unavailable"
                  : "Complaints could not be refreshed"}
          </h2>
          <p>
            {query.invalid
              ? "This link contains invalid complaint filters. Clear filters to start again."
              : "Refresh complaints to check your current access and records. Previous results are hidden until verification succeeds."}
          </p>
        </section>
      )}
      <section
        className="wfc-results"
        aria-labelledby="wfc-results-title"
        aria-busy={busy}
      >
        <header>
          <h2 id="wfc-results-title">Complaints</h2>
        </header>
        {busy && !query.invalid ? (
          <div className="wfc-state" role="status">
            Checking permitted complaints…
            <div className="wfc-skeleton" aria-hidden="true" />
          </div>
        ) : data?.items.length ? (
          <table>
            <caption className="sr-only">
              Complaints in your current responsibility scope
            </caption>
            <thead>
              <tr>
                {["Complaint", "Priority", "Branch", "Status", "Open"].map((label) => (
                  <th scope="col" key={label}>
                    {label}
                  </th>
                ))}
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
                  <td data-label="Priority">
                    <span className={`wfc-status is-${row.priority.toLowerCase()}`}>
                      {complaintPriorityLabels[row.priority]}
                    </span>
                  </td>
                  <td data-label="Branch">{row.branch?.name ?? "Branch not recorded"}</td>
                  <td data-label="Status">
                    <span
                      className={`wfc-status is-${row.status.toLowerCase()}`}
                      data-status={row.status}
                    >
                      {complaintStatusLabels[row.status]}
                    </span>
                  </td>
                  <td data-label="Open">
                    <button
                      className="button secondary"
                      aria-label={`View complaint: ${row.subject}`}
                      aria-pressed={row.id === selected}
                      onClick={() => select(row.id)}
                    >
                      View complaint
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          data && (
            <div className="wfc-state">
              <h3>
                {filtered
                  ? "No complaints match these filters"
                  : "No complaints in your current scope"}
              </h3>
              <p>
                {filtered
                  ? "Adjust or clear filters to see other permitted complaints."
                  : "Complaints appear here when available within your responsibilities."}
              </p>
            </div>
          )
        )}
        {data && (
          <footer>
            <p role="status">
              {data.items.length} {data.items.length === 1 ? "complaint" : "complaints"}{" "}
              on this page
            </p>
            <nav aria-label="Complaint pages">
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
                  navigate(workforceComplaintsPageParams(query.params, undefined, true))
                }
              >
                Previous page
              </button>
              <button
                className="button secondary"
                disabled={!data.nextCursor}
                onClick={() =>
                  navigate(workforceComplaintsPageParams(query.params, data.nextCursor))
                }
              >
                Next complaints
              </button>
            </nav>
          </footer>
        )}
      </section>
      {selected && !query.invalid ? (
        <WorkforceComplaintDetail
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
          <p className="wfc-selection-hint">
            Select an complaint to review its conversation and available actions.
          </p>
        )
      )}
    </div>
  );
}
