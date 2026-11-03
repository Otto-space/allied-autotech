"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { AppointmentTiming } from "./appointment-timing";
import { usePublicCapabilities } from "@/app/components/public-capabilities";
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
  const { restrictedLaunchPage } = usePublicCapabilities();
  if (restrictedLaunchPage(href)) return null;
  return (
    <Link className="care-link" href={href}>
      {children}
      <ArrowUpRight size={16} aria-hidden="true" />
    </Link>
  );
}
function VehiclePhoto({ vehicle }: { vehicle: NonNullable<CustomerCare["vehicle"]> }) {
  const [failed, setFailed] = useState(false);
  const photo = vehicle.photo;
  if (!photo) return <CarFront size={36} aria-hidden="true" />;
  return (
    <span className="care-vehicle-photo">
      {failed ? (
        <span role="img" aria-label="Vehicle photo unavailable">
          <CarFront size={28} aria-hidden="true" />
          Photo unavailable
        </span>
      ) : (
        <Image
          unoptimized
          src={photo.url}
          width={photo.width}
          height={photo.height}
          alt={photo.altText || `${vehicle.year} ${vehicle.make} ${vehicle.model}`}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
export function CustomerCareSummary({
  care,
  current = true,
}: {
  care: CustomerCare;
  current?: boolean;
}) {
  const { checkoutEnabled } = usePublicCapabilities();
  const booking = care.currentBooking;
  const bookedVehicle = care.vehicleSource === "BOOKING" && care.vehicle;
  const vehicle = bookedVehicle || care.defaultVehicle || care.vehicle;
  const vehicleLabel = bookedVehicle
    ? "Booked vehicle"
    : care.defaultVehicle
      ? "Default vehicle"
      : "Recently added vehicle";
  const hasService = Boolean(booking || vehicle || care.nextBooking);
  const hasReview = Boolean(care.quote || care.payment);
  const hasAttention = Boolean(care.enquiry || care.invoice || care.collectionOrder);
  const latestOrder = care.order?.id !== care.collectionOrder?.id ? care.order : null;
  const hasUpdates = Boolean(latestOrder || care.inspection || care.notification);
  const dates = booking
    ? [
        ["Requested", booking.requestedAt],
        ["Confirmed", booking.confirmedAt],
        ["Started", booking.startedAt],
      ].filter((row): row is [string, string] => row[1] !== null)
    : [];
  return (
    <section className="customer-care" aria-label="Current vehicle care">
      {!hasService && !hasReview && !hasUpdates && !hasAttention && (
        <div className="care-empty">
          <h2>No service in progress</h2>
          <p>
            Add a vehicle to keep its details together. Your bookings and updates will
            appear here when recorded.
          </p>
        </div>
      )}
      {hasAttention && (
        <section className="care-attention" aria-label="Your next steps">
          <h2>Your next steps</h2>
          <div className="care-attention-grid">
            {care.collectionOrder && (
              <section>
                <h3>Ready for collection</h3>
                <strong>{care.collectionOrder.orderNumber}</strong>
                <p>
                  Your order is marked ready. Check its details for collection
                  instructions.
                </p>
                <Action href={`/dashboard/orders/${care.collectionOrder.id}`}>
                  View collection order
                </Action>
              </section>
            )}
            {care.enquiry && (
              <section>
                <h3>Open enquiry</h3>
                <strong>{care.enquiry.subject}</strong>
                <State value={care.enquiry.status} />
                <p>
                  Updated {formatBusinessDate(care.enquiry.updatedAt)}. Open the
                  conversation to check replies.
                </p>
                <Action href={`/dashboard/support/enquiries/${care.enquiry.id}`}>
                  View enquiry
                </Action>
              </section>
            )}
            {care.invoice && (
              <section>
                <h3>Issued invoice</h3>
                <strong>{care.invoice.invoiceNumber}</strong>
                <p>
                  Invoice total:{" "}
                  {overviewMoney(care.invoice.totalKobo, care.invoice.currency)}
                </p>
                <p>
                  Issued {formatBusinessDate(care.invoice.issuedAt)}. Check credits and
                  confirmed payments in its details.
                </p>
                <Action href={`/dashboard/invoices/${care.invoice.id}`}>
                  View invoice
                </Action>
              </section>
            )}
          </div>
        </section>
      )}
      {(hasService || hasReview) && (
        <div className="care-primary-grid">
          {hasService && (
            <div className="care-service-column">
              {(booking || vehicle) && (
                <section className={booking ? "care-service" : "care-vehicle-summary"}>
                  <div className="care-heading">
                    <h2>{booking ? "Current service" : "Your vehicle"}</h2>
                    {booking && <State value={booking.status} />}
                  </div>
                  {booking ? (
                    <h3>{booking.serviceName}</h3>
                  ) : (
                    <p>No service in progress</p>
                  )}
                  {vehicle ? (
                    <div className="care-vehicle">
                      <VehiclePhoto
                        key={`${vehicle.id}:${vehicle.photo?.id ?? "none"}`}
                        vehicle={vehicle}
                      />
                      <div>
                        <span>{vehicleLabel}</span>
                        <strong>
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </strong>
                        {vehicle.registrationNumber && (
                          <span>{vehicle.registrationNumber}</span>
                        )}
                      </div>
                      <Action href={`/dashboard/vehicles/${vehicle.id}`}>
                        View vehicle
                      </Action>
                    </div>
                  ) : null}
                  {booking ? (
                    <>
                      <p>Appointment: {formatBusinessDate(booking.scheduledAt)}</p>
                      <ol
                        className="care-timeline"
                        aria-label="Recorded service activity"
                      >
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
                  ) : null}
                </section>
              )}
              {care.nextBooking && (
                <section className="customer-care-next">
                  <CalendarDays size={22} aria-hidden="true" />
                  <div>
                    <h2>Next booking</h2>
                    <h3>{care.nextBooking.serviceName}</h3>
                    <State value={care.nextBooking.status} />
                    <AppointmentTiming
                      status={care.nextBooking.status}
                      scheduledAt={care.nextBooking.scheduledAt}
                      current={current}
                    />
                    <Action href={`/dashboard/bookings/${care.nextBooking.id}`}>
                      View next booking
                    </Action>
                  </div>
                </section>
              )}
            </div>
          )}
          {hasReview && (
            <section className="care-review">
              <h2>To review</h2>
              <p>
                {!checkoutEnabled
                  ? "Recorded quote and payment information. Online payment is unavailable."
                  : "Latest issued quote and open payment request."}
              </p>
              {care.quote && (
                <div className="care-review-row">
                  <FileText size={22} aria-hidden="true" />
                  <div>
                    <h3>Issued quotation</h3>
                    <strong className="care-amount">
                      {overviewMoney(care.quote.totalKobo, care.quote.currency)}
                    </strong>
                    <p>{care.quote.quoteNumber}</p>
                    <p>Issued {formatBusinessDate(care.quote.issuedAt)}</p>
                    <Action href={`/dashboard/bookings/${care.quote.bookingId}`}>
                      View quotation
                    </Action>
                  </div>
                </div>
              )}
              {care.payment && (
                <div className="care-review-row">
                  <Wallet size={22} aria-hidden="true" />
                  <div>
                    <h3>Payment request</h3>
                    <strong className="care-amount">
                      {overviewMoney(care.payment.amountKobo, care.payment.currency)}
                    </strong>
                    <State value={care.payment.status} />
                    <p>{care.payment.paymentNumber}</p>
                    <p>
                      Requested amount. Check its details for the latest payment state.
                    </p>
                    <Action href={`/dashboard/payments/${care.payment.id}`}>
                      View payment
                    </Action>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      )}
      {hasUpdates && (
        <div className="customer-care-secondary">
          {latestOrder && (
            <section>
              <Package size={22} aria-hidden="true" />
              <div>
                <h2>Latest order</h2>
                <h3>{latestOrder.orderNumber}</h3>
                <State value={latestOrder.status} />
                <p>{label(latestOrder.fulfillmentMethod)}</p>
                <Action href={`/dashboard/orders/${latestOrder.id}`}>View order</Action>
              </div>
            </section>
          )}
          {care.inspection && (
            <section>
              <CalendarDays size={22} aria-hidden="true" />
              <div>
                <h2>Inspection</h2>
                <h3>{care.inspection.title}</h3>
                <State value={care.inspection.status} />
                <p>
                  {care.inspection.dateKind === "SCHEDULED"
                    ? "Scheduled date"
                    : "Preferred date"}
                  : {formatBusinessDate(care.inspection.startsAt)}
                </p>
                <Action href="/dashboard/inspections">View inspections</Action>
              </div>
            </section>
          )}
          {care.notification && (
            <section>
              <Bell size={22} aria-hidden="true" />
              <div>
                <h2>Latest update</h2>
                <h3>{care.notification.title}</h3>
                <p>{formatBusinessDate(care.notification.createdAt)}</p>
                {!care.notification.readAt && <span className="care-status">Unread</span>}
                <Action href="/dashboard/notifications">Read updates</Action>
              </div>
            </section>
          )}
        </div>
      )}
      <nav className="care-shortcuts" aria-label="Customer quick links">
        <Action href="/dashboard/vehicles">Manage garage</Action>
        <Action href="/dashboard/support">Get support</Action>
      </nav>
    </section>
  );
}
