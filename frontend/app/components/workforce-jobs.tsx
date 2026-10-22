"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, RefreshCw, Search } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import type { WorkforceAccess } from "@/lib/api/workforce-schemas";
import { sameWorkforceScope } from "@/lib/admin/workforce-overview";
import {
  jobsHref,
  parseScopedWorkforceJobs,
  workforceJobsPageParams,
  workforceJobsQuery,
  workStatusLabels,
} from "@/lib/admin/workforce-jobs";
import { formatBusinessDate } from "@/lib/format/date";
import "./workforce-jobs.css";

const bookingLabels: Record<string, string> = {
  REQUESTED: "Requested",
  AWAITING_DEPOSIT: "Awaiting deposit",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No show",
  EXPIRED: "Expired",
};
export function WorkforceJobs({
  access,
  refreshAccess,
}: {
  access: WorkforceAccess;
  refreshAccess: () => void;
}) {
  const router = useRouter(),
    search = useSearchParams(),
    query = workforceJobsQuery(new URLSearchParams(search.toString()));
  const record = useResource(query.path, parseScopedWorkforceJobs);
  const busy = record.loading || record.refreshing,
    failure = record.error || record.refreshError;
  const mismatch = !!record.data && !sameWorkforceScope(access, record.data.access);
  const data = !query.invalid && !busy && !failure && !mismatch ? record.data : undefined;
  const filtered = !!(query.params.get("q") || query.params.get("workStatus"));
  const navigate = (params: URLSearchParams) =>
    router.push(jobsHref(params), { scroll: false });
  const first = new URLSearchParams(query.params);
  first.delete("cursor");
  first.delete("_trail");
  function refresh() {
    refreshAccess();
    record.refresh();
  }
  return (
    <div className="workforce-jobs">
      <nav className="wfj-breadcrumb" aria-label="Breadcrumb">
        <Link href="/admin">Overview</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <span aria-current="page">Workshop jobs</span>
      </nav>
      <header className="wfj-heading">
        <div>
          <h1>Workshop jobs</h1>
          <p>Review permitted jobs, vehicle details and work progress.</p>
        </div>
        <div className="wfj-refresh">
          <button
            className="button secondary"
            onClick={refresh}
            disabled={busy || query.invalid}
          >
            <RefreshCw size={17} aria-hidden="true" />
            {busy ? "Refreshing jobs…" : "Refresh jobs"}
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
        className="wfj-filters"
        aria-label="Filter workshop jobs"
        onSubmit={(event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget),
            params = new URLSearchParams();
          const q = String(values.get("q") ?? "").trim(),
            workStatus = String(values.get("workStatus") ?? "");
          if (q) params.set("q", q);
          if (workStatus) params.set("workStatus", workStatus);
          navigate(params);
        }}
      >
        <div className="field wfj-search">
          <label htmlFor="wfj-q">Search jobs</label>
          <div>
            <Search size={18} aria-hidden="true" />
            <input
              id="wfj-q"
              name="q"
              type="search"
              maxLength={120}
              defaultValue={query.params.get("q") ?? ""}
              placeholder="Work order, service or vehicle"
              aria-describedby="wfj-search-hint"
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="wfj-work-status">Work status</label>
          <select
            id="wfj-work-status"
            name="workStatus"
            defaultValue={
              Object.hasOwn(workStatusLabels, query.params.get("workStatus") ?? "")
                ? query.params.get("workStatus")!
                : ""
            }
          >
            <option value="">All work states</option>
            {Object.entries(workStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="wfj-filter-actions">
          <button className="button" disabled={busy}>
            Apply filters
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={(event) => {
              event.currentTarget.form?.reset();
              navigate(new URLSearchParams());
            }}
          >
            Clear filters
          </button>
        </div>
        <p id="wfj-search-hint">Search covers all jobs in your current scope.</p>
      </form>
      {(query.invalid || failure || mismatch) && (
        <section className="wfj-feedback" role="alert">
          <h2>
            {query.invalid
              ? "Job filters unavailable"
              : mismatch
                ? "Your responsibilities changed"
                : record.denied
                  ? "Job access unavailable"
                  : "Jobs could not be refreshed"}
          </h2>
          <p>
            {query.invalid
              ? "This link contains invalid job filters. Clear filters to start again."
              : mismatch
                ? "Refresh jobs to check your current access and records together."
                : "Refresh jobs to check current records. Previous results are hidden until verification succeeds."}
          </p>
        </section>
      )}
      <section
        className="wfj-results"
        aria-labelledby="wfj-results-title"
        aria-busy={busy}
      >
        <header>
          <h2 id="wfj-results-title">Jobs</h2>
          {data && <span role="status">{data.items.length} on this page</span>}
        </header>
        {busy && !query.invalid ? (
          <div className="wfj-state" role="status">
            Checking permitted jobs…
            <div className="wfj-skeleton" aria-hidden="true" />
            <div className="wfj-skeleton" aria-hidden="true" />
            <div className="wfj-skeleton" aria-hidden="true" />
          </div>
        ) : data?.items.length ? (
          <table>
            <caption className="sr-only">
              Jobs in your current responsibility scope
            </caption>
            <thead>
              <tr>
                <th scope="col">Job</th>
                <th scope="col">Vehicle</th>
                <th scope="col">Scheduled</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr-only">Open job</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((job) => {
                const status = job.workOrder?.status ?? "NOT_CREATED",
                  label =
                    workStatusLabels[status as keyof typeof workStatusLabels] ??
                    status.replaceAll("_", " ").toLowerCase();
                const href = `/admin/workforce/jobs/${job.id}${query.params.size ? `?${query.params}` : ""}`;
                const title = job.workOrder?.workOrderNumber ?? "Work order pending";
                return (
                  <tr key={job.id}>
                    <th scope="row">
                      <Link className="wfj-job-link" href={href} prefetch={false}>
                        {title}
                      </Link>
                      <small>{job.service.name}</small>
                    </th>
                    <td data-label="Vehicle">
                      {job.vehicle ? (
                        <>
                          <span>
                            {[job.vehicle.make, job.vehicle.model, job.vehicle.year]
                              .filter((value) => value !== null)
                              .join(" ")}
                          </span>
                          <small>
                            {job.vehicle.registrationNumber ??
                              "Registration not recorded"}
                          </small>
                        </>
                      ) : (
                        <span>Vehicle not recorded</span>
                      )}
                    </td>
                    <td data-label="Scheduled">
                      <time dateTime={job.scheduledAt}>
                        {formatBusinessDate(job.scheduledAt)}
                      </time>
                    </td>
                    <td data-label="Status">
                      <span
                        data-status={status}
                        className={`wfj-status is-${status.toLowerCase()}`}
                      >
                        {label}
                      </span>
                      <small>
                        Booking:{" "}
                        {bookingLabels[job.status] ??
                          job.status.replaceAll("_", " ").toLowerCase()}
                      </small>
                    </td>
                    <td className="wfj-open">
                      <Link
                        href={href}
                        prefetch={false}
                        aria-label={`Open ${title} — ${job.service.name}`}
                      >
                        <ChevronRight size={20} aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : data ? (
          <div className="wfj-state">
            <h3>
              {filtered ? "No jobs match these filters" : "No jobs in your current scope"}
            </h3>
            <p>
              {filtered
                ? "Try a different search or clear filters to see your permitted jobs."
                : "Jobs will appear here when they fall within your active responsibilities."}
            </p>
          </div>
        ) : (
          !busy && (
            <div className="wfj-state">
              <p>Current jobs are unavailable until access and records are verified.</p>
            </div>
          )
        )}
        <footer>
          <p>Open a job to review its details and permitted actions.</p>
          <nav aria-label="Job pages">
            <button
              className="button secondary"
              disabled={!query.params.has("cursor") || busy || query.invalid}
              onClick={() => navigate(first)}
            >
              First page
            </button>
            <button
              className="button secondary"
              disabled={!query.params.has("_trail") || busy || query.invalid}
              onClick={() =>
                navigate(workforceJobsPageParams(query.params, undefined, true))
              }
            >
              Previous page
            </button>
            <button
              className="button secondary"
              disabled={!data?.nextCursor}
              onClick={() =>
                data?.nextCursor &&
                navigate(workforceJobsPageParams(query.params, data.nextCursor))
              }
            >
              Next jobs
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </nav>
        </footer>
      </section>
    </div>
  );
}
