"use client";
import Link from "next/link";
import { useState } from "react";
import { useResource } from "@/lib/api/use-resource";
import { parseStaffBookings } from "@/lib/api/staff-booking-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import { Feedback } from "./feedback";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
export function StaffBookings() {
  const [status, setStatus] = useState("");
  const pagination = useCursorPage();
  const bookings = useResource(
    `/staff/bookings?limit=25${status ? `&status=${status}` : ""}${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`,
    parseStaffBookings,
  );
  return (
    <>
      <h1>Workshop bookings</h1>
      <p className="lead">
        Manage appointments, quotations and work orders within your permitted branches.
      </p>
      <div className="field">
        <label htmlFor="staff-booking-status">Booking status</label>
        <select
          id="staff-booking-status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            pagination.reset();
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
              {value.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <Feedback message={bookings.error} />
      <button
        className="button secondary"
        disabled={bookings.loading}
        onClick={bookings.refresh}
      >
        Refresh bookings
      </button>
      {bookings.loading && <p role="status">Checking workshop bookings…</p>}
      <div
        className="table-region"
        role="region"
        aria-label="Workshop booking records"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th>Service & appointment</th>
              <th>Branch</th>
              <th>Status</th>
              <th>Assigned staff</th>
              <th>Vehicle</th>
            </tr>
          </thead>
          <tbody>
            {bookings.data?.items.map((booking) => (
              <tr key={booking.id}>
                <td>
                  <Link className="text-link" href={`/admin/bookings/${booking.id}`}>
                    {booking.service.name}
                  </Link>
                  <p>{formatBusinessDate(booking.scheduledAt)}</p>
                  <p className="muted">Ref {booking.id.slice(-8)}</p>
                </td>
                <td>{booking.branch?.name ?? "Not assigned"}</td>
                <td>{booking.status.replaceAll("_", " ")}</td>
                <td>
                  {booking.assignedStaff
                    ? `${booking.assignedStaff.firstName} ${booking.assignedStaff.lastName}`
                    : "Not assigned"}
                </td>
                <td>
                  {booking.vehicle
                    ? `${booking.vehicle.year} ${booking.vehicle.make} ${booking.vehicle.model}`
                    : "Not linked"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!bookings.loading && !bookings.error && bookings.data?.items.length === 0 && (
        <div className="empty">
          <h2>{status ? "No bookings match this status" : "No bookings on this page"}</h2>
          {status && (
            <button
              className="button secondary"
              onClick={() => {
                setStatus("");
                pagination.reset();
              }}
            >
              Clear filter
            </button>
          )}
        </div>
      )}
      <CursorPagination
        pagination={pagination}
        nextCursor={bookings.data?.nextCursor}
        disabled={bookings.loading || !!bookings.error}
        label="Workshop bookings"
      />
    </>
  );
}
