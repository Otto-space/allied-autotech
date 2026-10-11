"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, Fragment } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CarFront,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import {
  parseCustomerInspections,
  type CustomerInspection,
} from "@/lib/api/customer-inspections-schema";
import {
  customerInspectionQuery,
  inspectionStatuses,
  inspectionLabels,
} from "@/lib/customer-inspection-query";
import { inspectionWindow } from "@/lib/customer-inspection-time";
import { formatBusinessDate } from "@/lib/format/date";

function DateWindow({ start, end }: { start: string; end: string | null }) {
  const label = inspectionWindow(start, end);
  return (
    <>
      <time dateTime={start}>{label.start}</time>
      {end && (
        <>
          <span className="inspection-window-to">–</span>
          <time dateTime={end}>{label.end}</time>
        </>
      )}
    </>
  );
}

function InspectionRow({ item }: { item: CustomerInspection }) {
  const [open, setOpen] = useState(false);
  const terminal = ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(item.status);
  const report = item.conditionReport;
  const findings = Object.entries(report?.findings ?? {});
  return (
    <Fragment>
      <tr className="inspection-row">
        <th scope="row" id={`inspection-${item.id}`}>
          <div className="inspection-vehicle">
            <CarFront size={20} aria-hidden="true" />
            <span>{item.vehicleListing.title}</span>
          </div>
        </th>
        <td
          className="inspection-appointment"
          headers={`inspection-${item.id} inspection-appointment-heading`}
        >
          <strong>
            {item.scheduledStartAt
              ? terminal
                ? "Last scheduled"
                : "Scheduled"
              : "Requested"}
          </strong>
          <DateWindow
            start={item.scheduledStartAt ?? item.preferredStartAt}
            end={item.scheduledStartAt ? item.scheduledEndAt : item.preferredEndAt}
          />
          {item.status === "REQUESTED" && !item.scheduledStartAt && (
            <small>Awaiting confirmation</small>
          )}
        </td>
        <td
          className="inspection-status-cell"
          headers={`inspection-${item.id} inspection-status-heading`}
        >
          <span
            className={`inspection-status ${["CANCELLED", "NO_SHOW"].includes(item.status) ? "closed" : ""}`}
          >
            {inspectionLabels[item.status]}
          </span>
        </td>
        <td className="inspection-row-action">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={`inspection-details-${item.id}`}
            aria-label={`${open ? "Hide" : "View"} details for ${item.vehicleListing.title}`}
            onClick={() => setOpen(!open)}
          >
            {open ? "Hide" : "View"} details
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        </td>
      </tr>
      <tr className="inspection-detail-row" hidden={!open}>
        <td colSpan={4}>
          <div
            id={`inspection-details-${item.id}`}
            className="inspection-details"
            role="region"
            aria-label={`Details for ${item.vehicleListing.title}`}
          >
            <section className="inspection-request">
              <h3>Appointment details</h3>
              <dl>
                <div>
                  <dt>Preferred time</dt>
                  <dd>
                    <DateWindow start={item.preferredStartAt} end={item.preferredEndAt} />
                  </dd>
                </div>
              </dl>
              {item.notes && (
                <>
                  <h4>Your notes</h4>
                  <p className="inspection-preserve">{item.notes}</p>
                </>
              )}
              {item.cancellationReason && (
                <>
                  <h4>Cancellation reason</h4>
                  <p className="inspection-preserve">{item.cancellationReason}</p>
                </>
              )}
              <Link href="/dashboard/support" prefetch={false}>
                Contact customer care
              </Link>
            </section>
            <section className="inspection-report">
              <h3>Inspection report</h3>
              {report ? (
                <>
                  <p className="inspection-preserve">{report.summary}</p>
                  <dl className="inspection-report-facts">
                    <div>
                      <dt>Inspected</dt>
                      <dd>
                        <time dateTime={report.inspectedAt}>
                          {formatBusinessDate(report.inspectedAt)}
                        </time>
                      </dd>
                    </div>
                    <div>
                      <dt>Odometer</dt>
                      <dd>
                        {report.odometerKm === null
                          ? "Not recorded"
                          : `${report.odometerKm.toLocaleString("en-NG")} km`}
                      </dd>
                    </div>
                    <div>
                      <dt>Condition score</dt>
                      <dd>
                        {report.conditionScore === null
                          ? "Not recorded"
                          : `${report.conditionScore}/100`}
                      </dd>
                    </div>
                  </dl>
                  {findings.length > 0 && (
                    <>
                      <h4>Findings</h4>
                      <dl className="inspection-findings">
                        {findings.map(([name, value]) => (
                          <div key={name}>
                            <dt>{name}</dt>
                            <dd className="inspection-preserve">
                              {value === null
                                ? "Not recorded"
                                : typeof value === "boolean"
                                  ? value
                                    ? "Yes"
                                    : "No"
                                  : String(value)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </>
                  )}
                </>
              ) : (
                <p>No inspection report available.</p>
              )}
            </section>
          </div>
        </td>
      </tr>
    </Fragment>
  );
}

export function InspectionHistory() {
  const search = useSearchParams();
  const { params, invalid, path } = customerInspectionQuery(
    new URLSearchParams(search.toString()),
  );
  const status = params.get("status") ?? "",
    limit = params.get("limit")!,
    cursor = params.get("cursor"),
    trail = params.get("_trail")?.split(",") ?? [];
  const inspections = useResource(path, parseCustomerInspections);
  const data = !inspections.loading && !inspections.error ? inspections.data : undefined;
  const stale = !!inspections.refreshError;
  function navigate(next: URLSearchParams, focus = false) {
    window.history.pushState(
      null,
      "",
      `/dashboard/inspections?${customerInspectionQuery(next).params}`,
    );
    if (focus) {
      document.getElementById("inspection-results")?.focus({ preventScroll: true });
      document.getElementById("inspection-results")?.scrollIntoView({ block: "start" });
    }
  }
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    next.delete("cursor");
    next.delete("_trail");
    if (value) next.set(key, value);
    else next.delete(key);
    navigate(next);
  }
  function reset() {
    navigate(new URLSearchParams());
    document.getElementById("inspection-status")?.focus();
  }
  function firstPage() {
    const next = new URLSearchParams(params);
    next.delete("cursor");
    next.delete("_trail");
    navigate(next, true);
  }
  return (
    <div className="customer-inspections">
      <nav className="inspection-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/dashboard">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">Inspections</span>
          </li>
        </ol>
      </nav>
      <header className="inspection-heading">
        <div>
          <h1>Vehicle inspections</h1>
          <p>Follow your requests, appointment times and inspection reports.</p>
        </div>
        <div className="inspection-actions">
          <button
            className="button secondary"
            onClick={inspections.refresh}
            disabled={inspections.loading || inspections.refreshing}
          >
            <RefreshCw size={16} aria-hidden="true" />
            {inspections.refreshing ? "Updating…" : "Refresh inspections"}
          </button>
          <Link className="button" href="/vehicles">
            Browse vehicles
          </Link>
        </div>
      </header>
      <aside className="inspection-guidance">
        <CalendarDays size={26} aria-hidden="true" />
        <div>
          <h2>Your inspection appointments</h2>
          <p>
            Requested times are preferences. Check the confirmed schedule before you
            visit.
          </p>
        </div>
      </aside>
      <div className="inspection-filters" role="group" aria-label="Inspection filters">
        <div>
          <label htmlFor="inspection-status">Inspection status</label>
          <select
            id="inspection-status"
            value={status}
            onChange={(e) => filter("status", e.target.value)}
          >
            <option value="">All statuses</option>
            {inspectionStatuses.map((value) => (
              <option key={value} value={value}>
                {inspectionLabels[value]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="inspection-limit">Rows per page</label>
          <select
            id="inspection-limit"
            value={limit}
            onChange={(e) => filter("limit", e.target.value)}
          >
            {[10, 20, 50].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <button
          className="inspection-text-button"
          onClick={reset}
          disabled={!status && limit === "20" && !cursor && !invalid}
        >
          Reset filters
        </button>
        <p>All times in Lagos</p>
      </div>
      {invalid && (
        <p role="status">
          Some invalid filters were ignored. Reset filters to clear them.
        </p>
      )}
      {stale && (
        <div className="inspection-warning" role="alert">
          <p>
            <strong>These inspections may be out of date.</strong> Refresh before relying
            on an appointment time.
          </p>
          <button className="button secondary" onClick={inspections.refresh}>
            Retry inspections
          </button>
        </div>
      )}
      <section aria-label="Inspection results">
        <h2
          id="inspection-results"
          className="inspection-count"
          tabIndex={-1}
          aria-live="polite"
        >
          {inspections.loading
            ? "Checking inspection requests…"
            : inspections.error
              ? "Inspections unavailable"
              : data
                ? `${data.items.length} inspection${data.items.length === 1 ? "" : "s"} on this page`
                : "Checking inspection requests…"}
        </h2>
        {inspections.loading && (
          <div className="inspection-skeleton" aria-hidden="true">
            {[1, 2, 3].map((n) => (
              <div key={n}>
                <span />
                <span />
                <span />
              </div>
            ))}
          </div>
        )}
        {inspections.error && (
          <div className="inspection-empty" role="alert">
            <CalendarDays size={28} aria-hidden="true" />
            <h3>We couldn’t load your inspections</h3>
            <p>{inspections.error}</p>
            <button className="button secondary" onClick={inspections.refresh}>
              Retry inspections
            </button>
            {cursor && (
              <button className="inspection-text-button" onClick={firstPage}>
                First page
              </button>
            )}
          </div>
        )}
        {!!data?.items.length && (
          <div className="inspection-table-wrap">
            <table className="inspection-table">
              <caption className="sr-only">
                Your vehicle inspection requests. All appointment times are in Lagos time.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Vehicle</th>
                  <th id="inspection-appointment-heading" scope="col">
                    Appointment
                  </th>
                  <th id="inspection-status-heading" scope="col">
                    Status
                  </th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody key={path}>
                {data.items.map((item) => (
                  <InspectionRow key={item.id} item={item} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data?.items.length === 0 && (
          <div className="inspection-empty">
            <CalendarDays size={30} aria-hidden="true" />
            <h3>
              {cursor
                ? "No inspections on this page"
                : status
                  ? "No inspections with this status"
                  : "No inspection requests yet"}
            </h3>
            <p>
              {cursor
                ? "Return to the first page to check the current list."
                : status
                  ? "Try a different status or reset your filters."
                  : "Browse available vehicles and request an inspection from a vehicle page."}
            </p>
            {cursor ? (
              <button className="button secondary" onClick={firstPage}>
                First page
              </button>
            ) : status ? (
              <button className="button secondary" onClick={reset}>
                Reset inspection filters
              </button>
            ) : (
              <Link className="button" href="/vehicles">
                Browse vehicles
              </Link>
            )}
          </div>
        )}
      </section>
      <footer className="inspection-footer">
        <nav className="inspection-pagination" aria-label="Inspection pages">
          <button
            className="button secondary"
            disabled={
              !trail.length || inspections.loading || stale || !!inspections.error
            }
            onClick={() => {
              const next = new URLSearchParams(params),
                previous = trail.at(-1)!;
              if (previous === "start") next.delete("cursor");
              else next.set("cursor", previous);
              const remaining = trail.slice(0, -1);
              if (remaining.length) next.set("_trail", remaining.join(","));
              else next.delete("_trail");
              navigate(next, true);
            }}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Previous
          </button>
          <span>
            {cursor && !trail.length ? "Later page" : `Page ${trail.length + 1}`}
          </span>
          <button
            className="button secondary"
            disabled={!data?.nextCursor || inspections.loading || stale}
            onClick={() => {
              if (!data?.nextCursor) return;
              const next = new URLSearchParams(params);
              next.set("cursor", data.nextCursor);
              if ((!cursor || trail.length) && trail.length < 50)
                next.set("_trail", [...trail, cursor ?? "start"].join(","));
              else next.delete("_trail");
              navigate(next, true);
            }}
          >
            Next
            <ArrowRight size={16} aria-hidden="true" />
          </button>
          {cursor && !trail.length && (
            <button className="inspection-text-button" onClick={firstPage}>
              First page
            </button>
          )}
        </nav>
        <p>
          Need to change an appointment?{" "}
          <Link href="/dashboard/support">Contact customer care</Link>
        </p>
      </footer>
    </div>
  );
}
