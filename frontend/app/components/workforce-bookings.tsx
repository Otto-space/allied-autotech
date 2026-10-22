"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, RefreshCw, Search } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import type { WorkforceAccess } from "@/lib/api/workforce-schemas";
import { sameWorkforceScope } from "@/lib/admin/workforce-overview";
import {
  bookingsHref,
  parseScopedWorkforceBookings,
  workforceBookingsPageParams,
  workforceBookingsQuery,
  bookingStatusLabels,
} from "@/lib/admin/workforce-bookings";
import { formatBusinessDate } from "@/lib/format/date";
import "./workforce-bookings.css";

export function WorkforceBookings({
  access,
  refreshAccess,
}: {
  access: WorkforceAccess;
  refreshAccess: () => void;
}) {
  const router = useRouter(),
    search = useSearchParams(),
    query = workforceBookingsQuery(new URLSearchParams(search.toString()));
  const record = useResource(query.path, parseScopedWorkforceBookings);
  const busy = record.loading || record.refreshing,
    failure = record.error || record.refreshError;
  const mismatch = !!record.data && !sameWorkforceScope(access, record.data.access);
  const data = !query.invalid && !busy && !failure && !mismatch ? record.data : undefined;
  const filtered = !!(query.params.get("q") || query.params.get("status"));
  const navigate = (params: URLSearchParams) =>
    router.push(bookingsHref(params), { scroll: false });
  const first = new URLSearchParams(query.params);
  first.delete("cursor");
  first.delete("_trail");
  function refresh() {
    refreshAccess();
    record.refresh();
  }
  return (
    <div className="workforce-bookings">
      <nav className="wfb-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">Bookings</span>
          </li>
        </ol>
      </nav>
      <header className="wfb-heading">
        <div>
          <h1>Bookings</h1>
          <p>Review customer appointments in your permitted branches.</p>
        </div>
        <div className="wfb-refresh">
          <button
            className="button secondary"
            onClick={refresh}
            disabled={busy || query.invalid}
          >
            <RefreshCw size={17} aria-hidden="true" />
            {busy ? "Refreshing bookings…" : "Refresh bookings"}
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
        className="wfb-filters"
        aria-label="Filter bookings"
        onSubmit={(event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget),
            params = new URLSearchParams();
          const q = String(values.get("q") ?? "").trim(),
            status = String(values.get("status") ?? "");
          if (q) params.set("q", q);
          if (status) params.set("status", status);
          navigate(params);
        }}
      >
        <div className="field wfb-search">
          <label htmlFor="wfb-q">Search bookings</label>
          <div>
            <Search size={18} aria-hidden="true" />
            <input
              id="wfb-q"
              name="q"
              type="search"
              maxLength={120}
              defaultValue={query.params.get("q") ?? ""}
              placeholder="Customer, phone, service or vehicle"
              aria-describedby="wfb-search-hint"
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="wfb-work-status">Booking status</label>
          <select
            id="wfb-work-status"
            name="status"
            defaultValue={
              Object.hasOwn(bookingStatusLabels, query.params.get("status") ?? "")
                ? query.params.get("status")!
                : ""
            }
          >
            <option value="">All booking states</option>
            {Object.entries(bookingStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="wfb-filter-actions">
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
        <p id="wfb-search-hint">Search covers all bookings in your current scope.</p>
      </form>
      {(query.invalid || failure || mismatch) && (
        <section className="wfb-feedback" role="alert">
          <h2>
            {query.invalid
              ? "Booking filters unavailable"
              : mismatch
                ? "Your responsibilities changed"
                : record.denied
                  ? "Booking access unavailable"
                  : "Bookings could not be refreshed"}
          </h2>
          <p>
            {query.invalid
              ? "This link contains invalid booking filters. Clear filters to start again."
              : mismatch
                ? "Refresh bookings to check your current access and records together."
                : "Refresh bookings to check current records. Previous results are hidden until verification succeeds."}
          </p>
        </section>
      )}
      <section
        className="wfb-results"
        aria-labelledby="wfb-results-title"
        aria-busy={busy}
      >
        <header>
          <h2 id="wfb-results-title">Bookings</h2>
          {data && <span role="status">{data.items.length} on this page</span>}
        </header>
        {busy && !query.invalid ? (
          <div className="wfb-state" role="status">
            Checking permitted bookings…
            <div className="wfb-skeleton" aria-hidden="true" />
            <div className="wfb-skeleton" aria-hidden="true" />
            <div className="wfb-skeleton" aria-hidden="true" />
          </div>
        ) : data?.items.length ? (
          <table>
            <caption className="sr-only">
              Bookings in your current responsibility scope
            </caption>
            <thead>
              <tr>
                <th scope="col">Service</th>
                <th scope="col">Customer</th>
                <th scope="col">Vehicle</th>
                <th scope="col">Branch</th>
                <th scope="col">Scheduled</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((booking) => (
                <tr key={booking.id}>
                  <th scope="row">{booking.service.name}</th>
                  <td data-label="Customer">
                    <span>
                      {[booking.customer.firstName, booking.customer.lastName]
                        .filter(Boolean)
                        .join(" ")}
                    </span>
                    <small>{booking.customer.phone}</small>
                  </td>
                  <td data-label="Vehicle">
                    {booking.vehicle ? (
                      <>
                        <span>
                          {[
                            booking.vehicle.make,
                            booking.vehicle.model,
                            booking.vehicle.year,
                          ]
                            .filter((value) => value !== null)
                            .join(" ")}
                        </span>
                        <small>
                          {booking.vehicle.registrationNumber ??
                            "Registration not recorded"}
                        </small>
                      </>
                    ) : (
                      <span>Vehicle not recorded</span>
                    )}
                  </td>
                  <td data-label="Branch">
                    <span>{booking.branch?.name ?? "Branch not recorded"}</span>
                  </td>
                  <td data-label="Scheduled">
                    <time dateTime={booking.scheduledAt}>
                      {formatBusinessDate(booking.scheduledAt)}
                    </time>
                  </td>
                  <td data-label="Status">
                    <span className={`wfb-status is-${booking.status.toLowerCase()}`}>
                      {bookingStatusLabels[booking.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : data ? (
          <div className="wfb-state">
            <h3>
              {filtered
                ? "No bookings match these filters"
                : "No bookings in your current scope"}
            </h3>
            <p>
              {filtered
                ? "Try a different search or clear filters to see your permitted bookings."
                : "Bookings will appear here when they fall within your active responsibilities."}
            </p>
          </div>
        ) : (
          !busy && (
            <div className="wfb-state">
              <p>
                Current bookings are unavailable until access and records are verified.
              </p>
            </div>
          )
        )}
        <footer>
          <p>Appointment information is read-only for your current responsibilities.</p>
          <nav aria-label="Booking pages">
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
                navigate(workforceBookingsPageParams(query.params, undefined, true))
              }
            >
              Previous page
            </button>
            <button
              className="button secondary"
              disabled={!data?.nextCursor}
              onClick={() =>
                data?.nextCursor &&
                navigate(workforceBookingsPageParams(query.params, data.nextCursor))
              }
            >
              Next bookings
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </nav>
        </footer>
      </section>
    </div>
  );
}
