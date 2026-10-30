"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import { parseBookings } from "@/lib/api/booking-schemas";
import {
  customerBookingQuery,
  bookingStatuses,
  bookingLabel,
} from "@/lib/customer-booking-query";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";

const paymentLabels: Record<string, string> = {
  REQUIRES_PAYMENT: "Awaiting payment",
  REQUIRES_REVIEW: "Under review",
  PROCESSING: "Processing",
  SUCCEEDED: "Payment confirmed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};
export function BookingsPanel() {
  const search = useSearchParams();
  const { params, invalid, path } = customerBookingQuery(
    new URLSearchParams(search.toString()),
  );
  const status = params.get("status") ?? "";
  const limit = params.get("limit")!;
  const cursor = params.get("cursor");
  const trail = params.get("_trail")?.split(",") ?? [];
  const bookings = useResource(path, parseBookings);
  const data = !bookings.loading && !bookings.error ? bookings.data : undefined;
  function navigate(next: URLSearchParams, focus = false) {
    window.history.pushState(
      null,
      "",
      `/dashboard/bookings?${customerBookingQuery(next).params}`,
    );
    if (focus) {
      document.getElementById("booking-results")?.focus({ preventScroll: true });
      document.getElementById("booking-results")?.scrollIntoView({ block: "start" });
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
  function firstPage() {
    const next = new URLSearchParams(params);
    next.delete("cursor");
    next.delete("_trail");
    navigate(next, true);
  }
  function reset() {
    navigate(new URLSearchParams());
    document.getElementById("booking-filter")?.focus();
  }
  return (
    <div className="customer-bookings">
      <nav className="booking-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/dashboard">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">Bookings</span>
          </li>
        </ol>
      </nav>
      <header className="booking-list-heading">
        <div>
          <h1>Your bookings</h1>
          <p>Appointments, deposit status, quotations and service progress.</p>
        </div>
        <div className="booking-list-actions">
          <Link className="button" href="/services">
            Book a service
          </Link>
          <button
            className="button secondary"
            onClick={bookings.refresh}
            disabled={bookings.loading || bookings.refreshing}
          >
            <RefreshCw size={16} aria-hidden="true" />
            {bookings.refreshing ? "Updating…" : "Refresh"}
          </button>
        </div>
      </header>
      <aside className="booking-guidance">
        <CalendarDays size={24} aria-hidden="true" />
        <div>
          <h2>Your next step is in the details</h2>
          <p>
            Review appointment times, quotations and available actions for each booking.
          </p>
        </div>
      </aside>
      <div className="booking-filters" role="group" aria-label="Booking filters">
        <div className="booking-filter-field">
          <label htmlFor="booking-filter">Booking status</label>
          <select
            id="booking-filter"
            value={status}
            onChange={(event) => filter("status", event.target.value)}
          >
            <option value="">All statuses</option>
            {bookingStatuses.map((value) => (
              <option value={value} key={value}>
                {bookingLabel(value)}
              </option>
            ))}
          </select>
        </div>
        <div className="booking-filter-field">
          <label htmlFor="booking-limit">Rows per page</label>
          <select
            id="booking-limit"
            value={limit}
            onChange={(event) => filter("limit", event.target.value)}
          >
            {[10, 20, 50].map((value) => (
              <option value={value} key={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="booking-reset"
          onClick={reset}
          disabled={!status && limit === "20" && !cursor && !invalid}
        >
          Reset filters
        </button>
      </div>
      {invalid && (
        <p role="status">
          Some invalid filters were ignored. Reset filters to clear them.
        </p>
      )}
      {bookings.refreshError && (
        <p className="booking-refresh-error" role="alert">
          We could not refresh these bookings. The list may be out of date.{" "}
          <button type="button" onClick={bookings.refresh}>
            Retry bookings
          </button>
        </p>
      )}
      <section className="booking-results" aria-label="Booking results">
        <h2
          id="booking-results"
          tabIndex={-1}
          className="booking-result-count"
          aria-live="polite"
        >
          {bookings.loading
            ? "Checking bookings…"
            : bookings.error
              ? "Bookings unavailable"
              : data
                ? `${data.items.length} booking${data.items.length === 1 ? "" : "s"} on this page`
                : "Checking bookings…"}
        </h2>
        {bookings.error && (
          <div className="booking-list-state" role="alert">
            <CalendarDays size={28} aria-hidden="true" />
            <h3>We couldn’t load your bookings</h3>
            <p>{bookings.error}</p>
            <button className="button secondary" onClick={bookings.refresh}>
              Retry bookings
            </button>
          </div>
        )}
        {bookings.loading && (
          <div className="booking-list-skeleton" aria-hidden="true">
            {[1, 2, 3].map((n) => (
              <div key={n}>
                <span />
                <span />
              </div>
            ))}
          </div>
        )}
        {data && data.items.length > 0 && (
          <div className="booking-table">
            <table>
              <caption className="sr-only">Your bookings on this page</caption>
              <thead>
                <tr>
                  <th scope="col">Service &amp; vehicle</th>
                  <th scope="col">Appointment</th>
                  <th scope="col">Status</th>
                  <th scope="col">Deposit</th>
                  <th scope="col">
                    <span className="sr-only">Booking details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((booking) => (
                  <tr key={booking.id}>
                    <td className="booking-identity">
                      <h3>{booking.service?.name ?? "Vehicle concern"}</h3>
                      {booking.vehicle ? (
                        <>
                          <p>
                            {booking.vehicle.year} {booking.vehicle.make}{" "}
                            {booking.vehicle.model}
                          </p>
                          {booking.vehicle.registrationNumber && (
                            <small>{booking.vehicle.registrationNumber}</small>
                          )}
                        </>
                      ) : (
                        <p>No vehicle linked</p>
                      )}
                      {booking.quotes.length > 0 && (
                        <small>
                          {booking.quotes.length} quotation
                          {booking.quotes.length === 1 ? "" : "s"} available
                        </small>
                      )}
                    </td>
                    <td data-label="Appointment">
                      <strong>
                        {booking.scheduledAt
                          ? formatBusinessDate(booking.scheduledAt)
                          : "Time not set"}
                      </strong>
                      <p>{booking.branch?.name ?? "Branch not assigned"}</p>
                      {["REQUESTED", "AWAITING_DEPOSIT"].includes(booking.status) && (
                        <small>Requested time; not yet confirmed.</small>
                      )}
                    </td>
                    <td data-label="Status">
                      <span
                        className={`booking-state ${["CANCELLED", "EXPIRED", "NO_SHOW"].includes(booking.status) ? "closed" : ""}`}
                        data-status={booking.status}
                      >
                        {bookingLabel(booking.status)}
                      </span>
                      {booking.workOrder && (
                        <p>Work order: {bookingLabel(booking.workOrder.status)}</p>
                      )}
                    </td>
                    <td data-label="Deposit">
                      <strong>
                        {booking.depositAmountKobo !== null
                          ? formatKobo(booking.depositAmountKobo)
                          : "No deposit set"}
                      </strong>
                      {booking.depositPaidAt ? (
                        <p>Deposit recorded</p>
                      ) : booking.depositPayment ? (
                        <p>
                          {paymentLabels[booking.depositPayment.status] ??
                            bookingLabel(booking.depositPayment.status)}
                        </p>
                      ) : (
                        <p>No payment request</p>
                      )}
                    </td>
                    <td className="booking-row-action">
                      <Link
                        href={`/dashboard/bookings/${booking.id}`}
                        aria-label={`View booking: ${booking.service?.name ?? "Vehicle concern"}`}
                        prefetch={false}
                      >
                        View booking <ArrowRight size={16} aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data?.items.length === 0 && (
          <div className="booking-list-state">
            <CalendarDays size={28} aria-hidden="true" />
            <h3>
              {cursor
                ? "No bookings on this page"
                : status
                  ? "No bookings with this status"
                  : "No bookings yet"}
            </h3>
            <p>
              {cursor
                ? "Return to the first page to check the current list."
                : status
                  ? "Try a different status or reset your filters."
                  : "Choose a service to request your first appointment."}
            </p>
            {cursor ? (
              <button className="button secondary" onClick={firstPage}>
                First page
              </button>
            ) : status ? (
              <button className="button secondary" onClick={reset}>
                Reset booking filters
              </button>
            ) : (
              <Link className="button" href="/services">
                Choose a service
              </Link>
            )}
          </div>
        )}
      </section>
      <nav className="booking-pagination" aria-label="Booking pages">
        <button
          className="button secondary"
          disabled={!trail.length || bookings.loading}
          onClick={() => {
            const next = new URLSearchParams(params);
            const previous = trail.at(-1)!;
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
        <span>{cursor && !trail.length ? "Later page" : `Page ${trail.length + 1}`}</span>
        <button
          className="button secondary"
          disabled={!data?.nextCursor || bookings.loading}
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
          <button className="booking-reset" onClick={firstPage}>
            First page
          </button>
        )}
      </nav>
      <footer className="booking-list-footer">
        <p>Times shown in Lagos time.</p>
        <p>
          Need help with a booking? <Link href="/dashboard/support">Contact support</Link>
        </p>
      </footer>
    </div>
  );
}
