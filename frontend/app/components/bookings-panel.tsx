"use client";
import Link from "next/link";
import { useState } from "react";
import { useResource } from "@/lib/api/use-resource";
import { parseBookings } from "@/lib/api/booking-schemas";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { Feedback } from "./feedback";
export function BookingsPanel() {
  const [status, setStatus] = useState("");
  const [cursor, setCursor] = useState<string>();
  const [history, setHistory] = useState<(string | undefined)[]>([]);
  const bookings = useResource(
    `/customers/bookings?limit=20${status ? `&status=${status}` : ""}${cursor ? `&cursor=${cursor}` : ""}`,
    parseBookings,
  );
  return (
    <>
      <h1>Your bookings</h1>
      <p className="muted">
        Appointments, deposit status, quotations and service progress.
      </p>
      <div className="field filter-field">
        <label htmlFor="booking-filter">Booking status</label>
        <select
          id="booking-filter"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setCursor(undefined);
            setHistory([]);
          }}
        >
          <option value="">All statuses</option>
          {[
            "REQUESTED",
            "AWAITING_DEPOSIT",
            "CONFIRMED",
            "IN_PROGRESS",
            "COMPLETED",
            "CANCELLED",
            "NO_SHOW",
            "EXPIRED",
          ].map((value) => (
            <option value={value} key={value}>
              {value.replaceAll("_", " ").toLowerCase()}
            </option>
          ))}
        </select>
      </div>
      <Feedback message={bookings.error} />
      {bookings.error && (
        <button className="button secondary" onClick={bookings.refresh}>
          Retry bookings
        </button>
      )}
      {bookings.loading && <p role="status">Checking bookings…</p>}
      <div className="list">
        {bookings.data?.items.map((booking) => (
          <article className="list-item" key={booking.id}>
            <div>
              <h2>
                <Link className="text-link" href={`/dashboard/bookings/${booking.id}`}>
                  {booking.service.name}
                </Link>
              </h2>
              <p className="muted">
                {formatBusinessDate(booking.scheduledAt)} ·{" "}
                {booking.branch?.name ?? "Branch not assigned"}
              </p>
              <span className="status">{booking.status.replaceAll("_", " ")}</span>
            </div>
            <div>
              {booking.depositAmountKobo !== null && (
                <p>Deposit: {formatKobo(booking.depositAmountKobo)}</p>
              )}
              <p>
                {booking.depositPayment?.status.replaceAll("_", " ") ??
                  "No deposit payment request"}
              </p>
              <Link className="text-link" href={`/dashboard/bookings/${booking.id}`}>
                Details & next steps →
              </Link>
            </div>
          </article>
        ))}
      </div>
      {!bookings.loading && !bookings.error && bookings.data?.items.length === 0 && (
        <div className="empty">
          <h2>{status ? "No bookings with this status" : "No bookings yet"}</h2>
          <Link className="button" href="/services">
            Choose a service
          </Link>
        </div>
      )}
      <nav className="pagination" aria-label="Booking pages">
        <button
          className="button secondary"
          disabled={!history.length || bookings.loading}
          onClick={() => {
            setCursor(history.at(-1));
            setHistory((value) => value.slice(0, -1));
          }}
        >
          Previous
        </button>
        <span>Page {history.length + 1}</span>
        <button
          className="button secondary"
          disabled={!bookings.data?.nextCursor || bookings.loading || !!bookings.error}
          onClick={() => {
            setHistory((value) => [...value, cursor]);
            setCursor(bookings.data?.nextCursor);
          }}
        >
          Next
        </button>
      </nav>
    </>
  );
}
