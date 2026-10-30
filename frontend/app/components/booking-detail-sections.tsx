import { WorkflowProgress } from "./status-progress";
import Link from "next/link";
import { CalendarDays, CarFront, MapPin, NotebookPen } from "lucide-react";
import type { CustomerBookingDetail } from "@/lib/api/customer-booking-detail-schema";
import { bookingLabel } from "@/lib/customer-booking-query";
import { formatBusinessDate } from "@/lib/format/date";
import { formatKobo } from "@/lib/format/money";

export type BookingQuote = CustomerBookingDetail["quotes"][number];
export const vehicleName = (booking: CustomerBookingDetail) =>
  booking.vehicle
    ? `${booking.vehicle.year} ${booking.vehicle.make} ${booking.vehicle.model}${booking.vehicle.registrationNumber ? ` · ${booking.vehicle.registrationNumber}` : ""}`
    : "Vehicle not linked";
export const quoteOpen = (quote: BookingQuote, now: number) =>
  quote.status === "ISSUED" && !!quote.expiresAt && Date.parse(quote.expiresAt) > now;

export function BookingAppointment({ booking }: { booking: CustomerBookingDetail }) {
  return (
    <section className="booking-appointment" aria-labelledby="appointment-title">
      <div className="booking-section-heading">
        <h2 id="appointment-title">{booking.service?.name ?? "Vehicle concern"}</h2>
        <span className="booking-detail-status" data-status={booking.status}>
          {bookingLabel(booking.status)}
        </span>
      </div>
      {booking.customerConcern && (
        <p className="booking-concern-description">{booking.customerConcern}</p>
      )}
      <dl className="booking-facts">
        <div>
          <dt>
            <CalendarDays aria-hidden="true" size={18} />
            Appointment
          </dt>
          <dd>
            {booking.scheduledAt
              ? formatBusinessDate(booking.scheduledAt)
              : "Time not assigned"}
            {booking.status === "REQUESTED" && (
              <small>Awaiting workshop confirmation.</small>
            )}
          </dd>
        </div>
        <div>
          <dt>
            <MapPin aria-hidden="true" size={18} />
            Workshop
          </dt>
          <dd>{booking.branch?.name ?? "Branch not assigned"}</dd>
        </div>
        <div>
          <dt>
            <CarFront aria-hidden="true" size={18} />
            Vehicle
          </dt>
          <dd>{vehicleName(booking)}</dd>
        </div>
        {booking.customerNotes && (
          <div>
            <dt>
              <NotebookPen aria-hidden="true" size={18} />
              Your notes
            </dt>
            <dd>{booking.customerNotes}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

export function BookingDeposit({ booking }: { booking: CustomerBookingDetail }) {
  return (
    <section
      className="booking-deposit booking-detail-surface"
      aria-labelledby="deposit-title"
    >
      <div className="booking-section-heading">
        <h2 id="deposit-title">Deposit</h2>
        {booking.depositPayment && (
          <span
            className="booking-detail-status"
            data-status={booking.depositPayment.status}
          >
            {bookingLabel(booking.depositPayment.status)}
          </span>
        )}
      </div>
      <p className="booking-deposit-amount">
        {booking.depositAmountKobo !== null
          ? formatKobo(booking.depositAmountKobo)
          : "No deposit amount recorded"}
      </p>
      {booking.depositPaidAt && <p>Paid {formatBusinessDate(booking.depositPaidAt)}</p>}
      {booking.paymentHoldExpiresAt && booking.status === "AWAITING_DEPOSIT" && (
        <p>Payment hold expires {formatBusinessDate(booking.paymentHoldExpiresAt)}</p>
      )}
      {booking.depositPayment ? (
        <Link
          className="button secondary"
          href={`/dashboard/payments/${booking.depositPayment.id}`}
        >
          Check deposit &amp; payment options
        </Link>
      ) : (
        <p>No deposit payment request is linked to this booking.</p>
      )}
    </section>
  );
}

export function BookingProgress({ booking }: { booking: CustomerBookingDetail }) {
  const events = [
    { label: "Requested", at: booking.requestedAt },
    { label: "Confirmed", at: booking.confirmedAt },
    { label: "Started", at: booking.startedAt },
    { label: "Completed", at: booking.completedAt },
    { label: "Cancelled", at: booking.cancelledAt },
  ]
    .filter((event) => !!event.at)
    .sort((a, b) => Date.parse(a.at!) - Date.parse(b.at!));
  return (
    <section
      className="booking-progress booking-detail-surface"
      aria-labelledby="progress-title"
    >
      <h2 id="progress-title">Service progress</h2>
      <WorkflowProgress workflow="booking" status={booking.status} />
      {events.length ? (
        <ol className="booking-timeline">
          {events.map((event) => (
            <li key={event.label}>
              <strong>{event.label}</strong>
              <time dateTime={event.at!}>{formatBusinessDate(event.at)}</time>
            </li>
          ))}
        </ol>
      ) : (
        <p>No milestone dates have been recorded.</p>
      )}
      {booking.workOrder ? (
        <div className="booking-work-order">
          <div className="booking-section-heading">
            <h3>{booking.workOrder.workOrderNumber}</h3>
            <span
              className="booking-detail-status"
              data-status={booking.workOrder.status}
            >
              {bookingLabel(booking.workOrder.status)}
            </span>
          </div>
          <WorkflowProgress workflow="workOrder" status={booking.workOrder.status} />
          {booking.workOrder.diagnosis && <p>{booking.workOrder.diagnosis}</p>}
        </div>
      ) : (
        <p>No work order has been shared yet.</p>
      )}
    </section>
  );
}

export function BookingQuotations({
  quotes,
  now,
  disabled,
  onReview,
}: {
  quotes: BookingQuote[];
  now: number;
  disabled: boolean;
  onReview: (quote: BookingQuote, action: "accept" | "reject") => void;
}) {
  const issued = quotes.filter((quote) => quote.status !== "DRAFT");
  return (
    <section className="booking-quotations" aria-labelledby="quotations-title">
      <h2 id="quotations-title">Quotations</h2>
      {!issued.length && (
        <p className="booking-detail-surface">No issued quotations are available.</p>
      )}
      {issued.map((quote) => (
        <article
          className="booking-quotation booking-detail-surface"
          key={quote.id}
          aria-labelledby={`quote-${quote.id}`}
        >
          <div className="booking-section-heading">
            <h3 id={`quote-${quote.id}`}>{quote.quoteNumber}</h3>
            <span className="booking-detail-status" data-status={quote.status}>
              {bookingLabel(quote.status)}
            </span>
            <span className="booking-revision">Revision {quote.revision}</span>
          </div>
          <WorkflowProgress workflow="quote" status={quote.status} />
          {quote.expiresAt && <p>Expires {formatBusinessDate(quote.expiresAt)}</p>}
          <table className="booking-quote-items">
            <caption className="sr-only">Items in quotation {quote.quoteNumber}</caption>
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Quantity</th>
                <th scope="col">Unit price</th>
                <th scope="col">Amount</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((item) => (
                <tr key={item.id}>
                  <th scope="row">{item.description}</th>
                  <td data-label="Quantity">{item.quantity}</td>
                  <td data-label="Unit price">{formatKobo(item.unitPriceKobo)}</td>
                  <td data-label="Amount">{formatKobo(item.subtotalKobo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="booking-quote-totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{formatKobo(quote.subtotalKobo)}</dd>
            </div>
            <div>
              <dt>Tax</dt>
              <dd>{formatKobo(quote.taxKobo)}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{formatKobo(quote.totalKobo)}</dd>
            </div>
          </dl>
          <div className="booking-quote-footer">
            <div>
              {quote.notes && (
                <>
                  <h4>Notes</h4>
                  <p>{quote.notes}</p>
                </>
              )}
              {quote.status === "ISSUED" && !quoteOpen(quote, now) && (
                <p role="status">
                  This quotation cannot be changed because its expiry is missing or has
                  passed. Contact customer care for an updated quotation.
                </p>
              )}
            </div>
            {quoteOpen(quote, now) && (
              <div className="actions">
                <button
                  className="button"
                  disabled={disabled}
                  onClick={() => onReview(quote, "accept")}
                >
                  Accept quotation
                </button>
                <button
                  className="button secondary"
                  disabled={disabled}
                  onClick={() => onReview(quote, "reject")}
                >
                  Reject quotation
                </button>
              </div>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}
