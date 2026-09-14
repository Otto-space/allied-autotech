"use client";
import Link from "next/link";
import { CalendarDays, Package, CreditCard } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import { parseBookings } from "@/lib/api/booking-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import { Feedback } from "./feedback";
export function DashboardOverview() {
  const bookings = useResource("/customers/bookings?limit=5", parseBookings);
  return (
    <>
      <h1>Your vehicle care, connected.</h1>
      <p className="lead">Plan your next visit and keep track of what comes next.</p>
      <div className="grid">
        <Link className="card" href="/dashboard/bookings">
          <CalendarDays size={25} />
          <h2>Your appointments</h2>
          <p>Booking details, quotations and service progress.</p>
          <span className="text-link">View bookings →</span>
        </Link>
        <Link className="card" href="/dashboard/orders">
          <Package size={25} />
          <h2>Your orders</h2>
          <p>Parts orders and collection updates.</p>
          <span className="text-link">View orders →</span>
        </Link>
        <Link className="card" href="/dashboard/payments">
          <CreditCard size={25} />
          <h2>Your payments</h2>
          <p>Check payment requests and verification status.</p>
          <span className="text-link">Check payments →</span>
        </Link>
      </div>
      <section className="detail-section">
        <div className="section-head">
          <div>
            <h2>Bookings at a glance</h2>
            <p className="muted">
              Up to five bookings. Open all bookings for the complete list.
            </p>
          </div>
          <Link className="button" href="/services">
            Book a service
          </Link>
        </div>
        <Feedback message={bookings.error} />
        {bookings.error && (
          <button className="button secondary" onClick={bookings.refresh}>
            Retry bookings
          </button>
        )}
        {bookings.loading && <p role="status">Loading your bookings…</p>}
        <div className="list">
          {bookings.data?.items.map((booking) => (
            <article className="list-item" key={booking.id}>
              <div>
                <h3>{booking.service.name}</h3>
                <p className="muted">{formatBusinessDate(booking.scheduledAt)}</p>
                <span className="status">{booking.status.replaceAll("_", " ")}</span>
              </div>
              <Link className="text-link" href={`/dashboard/bookings/${booking.id}`}>
                View booking →
              </Link>
            </article>
          ))}
        </div>
        {!bookings.loading && !bookings.error && bookings.data?.items.length === 0 && (
          <div className="empty">
            Your bookings will appear here after you submit a request.
          </div>
        )}
        <p>
          <Link className="text-link" href="/dashboard/bookings">
            All bookings →
          </Link>
        </p>
      </section>
    </>
  );
}
