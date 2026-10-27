import Link from "next/link";
import { browseEnquiriesOnly, restrictedLaunchPage } from "@/lib/public-launch";
import {
  CalendarDays,
  CarFront,
  FileText,
  Wallet,
  Package,
  Bell,
  ArrowUpRight,
} from "lucide-react";
import type { CustomerCare } from "@/lib/api/customer-care-schemas";
import { overviewMoney } from "@/lib/api/overview-schemas";
import { formatBusinessDate } from "@/lib/format/date";

const label = (value: string) => value.toLowerCase().replaceAll("_", " ");
function State({ value }: { value: string }) {
  return <span className="care-status">{label(value)}</span>;
}
function Action({ href, children }: { href: string; children: React.ReactNode }) {
  if (browseEnquiriesOnly() && restrictedLaunchPage(href)) return null;
  return (
    <Link className="care-link" href={href}>
      {children}
      <ArrowUpRight size={16} aria-hidden="true" />
    </Link>
  );
}
export function CustomerCareSummary({ care }: { care: CustomerCare }) {
  const booking = care.currentBooking;
  const vehicle = care.vehicle;
  const dates = booking
    ? [
        ["Requested", booking.requestedAt],
        ["Confirmed", booking.confirmedAt],
        ["Started", booking.startedAt],
      ].filter((row): row is [string, string] => row[1] !== null)
    : [];
  return (
    <section className="customer-care" aria-label="Current vehicle care">
      <div className="care-primary-grid">
        <div className="care-service-column">
          <section className="care-service">
            <div className="care-heading">
              <h2>Current service</h2>
              {booking && <State value={booking.status} />}
            </div>
            <h3>{booking?.serviceName ?? "No service in progress"}</h3>
            {vehicle ? (
              <div className="care-vehicle">
                <CarFront size={36} aria-hidden="true" />
                <div>
                  <span>
                    {care.vehicleSource === "BOOKING"
                      ? "Booked vehicle"
                      : "Recently added vehicle"}
                  </span>
                  <strong>
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </strong>
                  {vehicle.registrationNumber && (
                    <span>{vehicle.registrationNumber}</span>
                  )}
                </div>
                <Action href={`/dashboard/vehicles/${vehicle.id}`}>View vehicle</Action>
              </div>
            ) : (
              <p>
                No vehicle in your garage yet. Add one to keep its service details
                together.
              </p>
            )}
            {booking ? (
              <>
                <p>Appointment: {formatBusinessDate(booking.scheduledAt)}</p>
                <ol className="care-timeline" aria-label="Recorded service activity">
                  {dates.map(([name, date]) => (
                    <li key={name}>
                      <strong>{name}</strong>
                      <time dateTime={date}>{formatBusinessDate(date)}</time>
                    </li>
                  ))}
                </ol>
                <Action href={`/dashboard/bookings/${booking.id}`}>
                  View current booking
                </Action>
              </>
            ) : (
              <p>
                Your service status will appear here when work begins.{" "}
                <Action href="/services">Browse services</Action>
              </p>
            )}
          </section>
          <section className="customer-care-next">
            <CalendarDays size={22} aria-hidden="true" />
            <div>
              <h2>Next booking</h2>
              {care.nextBooking ? (
                <>
                  <h3>{care.nextBooking.serviceName}</h3>
                  <State value={care.nextBooking.status} />
                  <p>{formatBusinessDate(care.nextBooking.scheduledAt)}</p>
                  {care.nextBooking.status === "REQUESTED" && (
                    <p>Requested time; awaiting confirmation.</p>
                  )}
                  <Action href={`/dashboard/bookings/${care.nextBooking.id}`}>
                    View next booking
                  </Action>
                </>
              ) : (
                <p>No upcoming requested or confirmed booking.</p>
              )}
            </div>
          </section>
        </div>
        <section className="care-review">
          <h2>To review</h2>
          <p>
            {browseEnquiriesOnly()
              ? "Recorded quote and payment information. Online payment is unavailable."
              : "Latest issued quote and open payment request."}
          </p>
          <div className="care-review-row">
            <FileText size={22} aria-hidden="true" />
            <div>
              <h3>Issued quotation</h3>
              {care.quote ? (
                <>
                  <strong className="care-amount">
                    {overviewMoney(care.quote.totalKobo, care.quote.currency)}
                  </strong>
                  <p>{care.quote.quoteNumber}</p>
                  <p>Issued {formatBusinessDate(care.quote.issuedAt)}</p>
                  <Action href={`/dashboard/bookings/${care.quote.bookingId}`}>
                    View quotation
                  </Action>
                </>
              ) : (
                <p>No unexpired issued quotation to review.</p>
              )}
            </div>
          </div>
          <div className="care-review-row">
            <Wallet size={22} aria-hidden="true" />
            <div>
              <h3>Payment request</h3>
              {care.payment ? (
                <>
                  <strong className="care-amount">
                    {overviewMoney(care.payment.amountKobo, care.payment.currency)}
                  </strong>
                  <State value={care.payment.status} />
                  <p>{care.payment.paymentNumber}</p>
                  <p>Requested amount. Check its details for the latest payment state.</p>
                  <Action href={`/dashboard/payments/${care.payment.id}`}>
                    View payment
                  </Action>
                </>
              ) : (
                <p>No open payment request to show.</p>
              )}
            </div>
          </div>
        </section>
      </div>
      <div className="customer-care-secondary">
        <section>
          <Package size={22} aria-hidden="true" />
          <div>
            <h2>Latest order</h2>
            {care.order ? (
              <>
                <h3>{care.order.orderNumber}</h3>
                <State value={care.order.status} />
                <p>{label(care.order.fulfillmentMethod)}</p>
                <Action href={`/dashboard/orders/${care.order.id}`}>View order</Action>
              </>
            ) : (
              <>
                <p>No orders yet.</p>
                <Action href="/parts">Browse parts</Action>
              </>
            )}
          </div>
        </section>
        <section>
          <CalendarDays size={22} aria-hidden="true" />
          <div>
            <h2>Inspection</h2>
            {care.inspection ? (
              <>
                <h3>{care.inspection.title}</h3>
                <State value={care.inspection.status} />
                <p>
                  {care.inspection.dateKind === "SCHEDULED"
                    ? "Scheduled date"
                    : "Preferred date"}
                  : {formatBusinessDate(care.inspection.startsAt)}
                </p>
                <Action href="/dashboard/inspections">View inspections</Action>
              </>
            ) : (
              <>
                <p>No upcoming appointment or request.</p>
                <Action href="/vehicles">Browse vehicles</Action>
              </>
            )}
          </div>
        </section>
        <section>
          <Bell size={22} aria-hidden="true" />
          <div>
            <h2>Latest update</h2>
            {care.notification ? (
              <>
                <h3>{care.notification.title}</h3>
                <p>{formatBusinessDate(care.notification.createdAt)}</p>
                {!care.notification.readAt && <span className="care-status">Unread</span>}
              </>
            ) : (
              <p>No updates to show.</p>
            )}
            <Action href="/dashboard/notifications">Read updates</Action>
          </div>
        </section>
        <nav className="care-shortcuts" aria-label="Customer quick links">
          <Action href="/dashboard/vehicles">Manage garage</Action>
          <Action href="/dashboard/support">Get support</Action>
        </nav>
      </div>
    </section>
  );
}
