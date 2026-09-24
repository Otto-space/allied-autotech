"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiRequest, ApiError, newIdempotencyKey } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { parseBooking, parseBookingPolicy, parseSlots } from "@/lib/api/booking-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import { formatKobo } from "@/lib/format/money";
import { Feedback } from "./feedback";
type Decision = {
  title: string;
  path: string;
  method: string;
  body: unknown;
  idempotent?: boolean;
};
export function BookingDetail({ bookingId }: { bookingId: string }) {
  const booking = useResource(
    `/customers/bookings/${encodeURIComponent(bookingId)}`,
    parseBooking,
  );
  const policy = useResource("/public/booking-policy", parseBookingPolicy);
  const [showSlots, setShowSlots] = useState(false);
  const [slot, setSlot] = useState("");
  const [slotCursor, setSlotCursor] = useState<string>();
  const slots = useResource(
    showSlots && booking.data?.branch
      ? `/public/services/${booking.data.service.id}/slots?branchId=${booking.data.branch.id}&limit=50${slotCursor ? `&cursor=${slotCursor}` : ""}`
      : null,
    parseSlots,
  );
  const [decision, setDecision] = useState<Decision | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const requestKey = useRef<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  function ask(value: Decision) {
    setError(undefined);
    setDecision(value);
    requestKey.current = value.idempotent ? newIdempotencyKey() : undefined;
    dialog.current?.showModal();
  }
  async function confirm() {
    if (busy || !decision) return;
    setBusy(true);
    setError(undefined);
    try {
      await apiRequest(decision.path, {
        method: decision.method,
        body: decision.body,
        csrf: true,
        idempotencyKey: requestKey.current,
      });
      dialog.current?.close();
      setMessage("Your request was recorded. Review the updated booking status below.");
      booking.refresh();
      setShowSlots(false);
    } catch (value) {
      setError(
        value instanceof ApiError
          ? value.message
          : "We could not confirm this action. Refresh the booking before making another change.",
      );
    } finally {
      setBusy(false);
    }
  }
  const current = booking.data;
  const disruption =
    current?.status === "CONFIRMED" &&
    !!current.disruptionRequestedAt &&
    current.disruptionResolution === "PENDING";
  const hasDeposit = !!current?.depositPayment && !!current.depositPaidAt;
  const canReschedule =
    current?.status === "CONFIRMED" &&
    !!current.branch &&
    !!policy.data &&
    current.customerRescheduleCount < policy.data.customerRescheduleLimit &&
    !!current.scheduledAt &&
    Date.parse(current.scheduledAt) - now >
      policy.data.customerRescheduleCutoffHours * 3600000;
  return (
    <>
      <Link className="text-link" href="/dashboard/bookings">
        ← Your bookings
      </Link>
      <h1>Booking details</h1>
      <Feedback message={error ?? booking.error} />
      <Feedback message={message} tone="info" toast="Booking update recorded." />
      {booking.loading && <p role="status">Checking your booking…</p>}
      <button
        className="button secondary"
        disabled={booking.loading}
        onClick={booking.refresh}
      >
        Refresh booking
      </button>
      {current && (
        <>
          <section className="detail-section">
            <h2>{current.service.name}</h2>
            <span className="status">{current.status.replaceAll("_", " ")}</span>
            <p>
              {formatBusinessDate(current.scheduledAt)} ·{" "}
              {current.branch?.name ?? "Branch not assigned"}
            </p>
            {current.depositAmountKobo !== null && (
              <p>Deposit: {formatKobo(current.depositAmountKobo)}</p>
            )}
            {current.vehicle && (
              <p>
                Vehicle: {current.vehicle.year} {current.vehicle.make}{" "}
                {current.vehicle.model}
                {current.vehicle.registrationNumber
                  ? ` · ${current.vehicle.registrationNumber}`
                  : ""}
              </p>
            )}
            {current.customerNotes && <p>Your notes: {current.customerNotes}</p>}
            {current.paymentHoldExpiresAt && current.status === "AWAITING_DEPOSIT" && (
              <p>
                Payment hold expires {formatBusinessDate(current.paymentHoldExpiresAt)}
              </p>
            )}
            {current.depositPayment && (
              <Link
                className="button"
                href={`/dashboard/payments/${current.depositPayment.id}`}
              >
                Check deposit & payment options
              </Link>
            )}
            {disruption && (
              <div className="notice">
                <h3>Your appointment was disrupted</h3>
                <p>{current.disruptionReason}</p>
                <p>
                  Request another available slot without using your customer reschedule,
                  or cancel free. A replacement slot still needs workshop confirmation.
                  {hasDeposit &&
                    " You can request review of your historical deposit; a refund request does not mean a refund has been completed."}
                </p>
                <div className="actions">
                  <button className="button secondary" onClick={() => setShowSlots(true)}>
                    Choose another slot
                  </button>
                  {hasDeposit && (
                    <button
                      className="button secondary"
                      onClick={() =>
                        ask({
                          title: "Request a disruption refund?",
                          path: `/customers/bookings/${bookingId}/disruption-resolution`,
                          method: "POST",
                          body: {
                            resolution: "REFUND",
                            expectedVersion: current.version,
                          },
                          idempotent: true,
                        })
                      }
                    >
                      Request refund
                    </button>
                  )}
                </div>
              </div>
            )}
            {canReschedule && !disruption && (
              <div className="actions">
                <button
                  className="button secondary"
                  onClick={() => setShowSlots((value) => !value)}
                >
                  Reschedule appointment
                </button>
              </div>
            )}
            {showSlots && (
              <section className="detail-section">
                <h3>Choose a new slot</h3>
                <Feedback message={slots.error} />
                {slots.error && (
                  <button className="button secondary" onClick={slots.refresh}>
                    Retry slots
                  </button>
                )}
                {slots.loading && <p role="status">Loading slots…</p>}
                <div className="slot-grid">
                  {slots.data?.items.map((item) => (
                    <button
                      className="slot"
                      aria-pressed={slot === item.id}
                      onClick={() => setSlot(item.id)}
                      key={item.id}
                    >
                      {formatBusinessDate(item.startsAt)}
                    </button>
                  ))}
                </div>
                {!slots.loading && !slots.error && slots.data?.items.length === 0 && (
                  <p>
                    No alternative slots on this page. Contact customer care for help.
                  </p>
                )}
                {slots.data?.nextCursor && (
                  <button
                    className="button secondary"
                    onClick={() => {
                      setSlotCursor(slots.data?.nextCursor);
                      setSlot("");
                    }}
                  >
                    More slots
                  </button>
                )}
                <div className="actions">
                  <button
                    className="button"
                    disabled={!slot || slots.loading || !!slots.error}
                    onClick={() =>
                      ask({
                        title: "Request the new appointment time?",
                        path: `/customers/bookings/${bookingId}/${disruption ? "disruption-resolution" : "schedule"}`,
                        method: disruption ? "POST" : "PATCH",
                        body: {
                          slotId: slot,
                          expectedVersion: current.version,
                          ...(disruption ? { resolution: "TRANSFER" } : {}),
                        },
                        idempotent: true,
                      })
                    }
                  >
                    Review reschedule
                  </button>
                </div>
              </section>
            )}
            {["REQUESTED", "AWAITING_DEPOSIT", "CONFIRMED"].includes(current.status) &&
              (!disruption || !hasDeposit) && (
                <details className="detail-section">
                  <summary>Cancel this booking</summary>
                  <p>
                    {policy.data?.depositBasisPoints === 0
                      ? "You can cancel this booking free of charge."
                      : policy.data?.depositRefundableForCustomerCancellation === false
                        ? "Your deposit is non-refundable if you cancel."
                        : "Review the published cancellation policy or contact customer care before cancelling."}
                  </p>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      ask({
                        title: "Cancel this booking?",
                        path: `/customers/bookings/${bookingId}/cancel`,
                        method: "POST",
                        body: {
                          reason: String(new FormData(event.currentTarget).get("reason")),
                          expectedVersion: current.version,
                        },
                      });
                    }}
                  >
                    <div className="field">
                      <label htmlFor="booking-cancel-reason">Reason</label>
                      <textarea
                        id="booking-cancel-reason"
                        name="reason"
                        required
                        maxLength={500}
                      />
                    </div>
                    <button className="button secondary">Review cancellation</button>
                  </form>
                </details>
              )}
          </section>
          <section className="detail-section">
            <h2>Quotations</h2>
            {current.quotes
              .filter((quote) => quote.status !== "DRAFT")
              .map((quote) => (
                <article className="card" key={quote.id}>
                  <h3>{quote.quoteNumber}</h3>
                  <span className="status">{quote.status}</span>
                  <dl className="totals">
                    {quote.items.map((item) => (
                      <div className="spec-row" key={item.id}>
                        <dt>
                          {item.description} · {item.quantity} ×{" "}
                          {formatKobo(item.unitPriceKobo)}
                        </dt>
                        <dd>{formatKobo(item.subtotalKobo)}</dd>
                      </div>
                    ))}
                    <dt>Tax</dt>
                    <dd>{formatKobo(quote.taxKobo)}</dd>
                    <dt>Total</dt>
                    <dd>{formatKobo(quote.totalKobo)}</dd>
                  </dl>
                  {quote.notes && <p>{quote.notes}</p>}
                  {quote.expiresAt && (
                    <p>Expires {formatBusinessDate(quote.expiresAt)}</p>
                  )}
                  {quote.status === "ISSUED" && (
                    <div className="actions">
                      {(["accept", "reject"] as const).map((action) => (
                        <button
                          className={`button ${action === "reject" ? "secondary" : ""}`}
                          key={action}
                          onClick={() =>
                            ask({
                              title: `${action === "accept" ? "Accept" : "Reject"} this quotation?`,
                              path: `/customers/bookings/${bookingId}/quotes/${quote.id}/${action}`,
                              method: "POST",
                              body: { expectedRevision: quote.revision },
                            })
                          }
                        >
                          {action === "accept" ? "Accept quotation" : "Reject quotation"}
                        </button>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            {!current.quotes.some((quote) => quote.status !== "DRAFT") && (
              <p className="muted">No issued quotations are available.</p>
            )}
          </section>
          {current.workOrder && (
            <section className="detail-section">
              <h2>Service progress</h2>
              <p>{current.workOrder.workOrderNumber}</p>
              <span className="status">
                {current.workOrder.status.replaceAll("_", " ")}
              </span>
              {current.workOrder.diagnosis && <p>{current.workOrder.diagnosis}</p>}
            </section>
          )}
        </>
      )}
      <dialog
        ref={dialog}
        className="support-dialog"
        aria-labelledby="booking-decision-title"
      >
        <h2 id="booking-decision-title">{decision?.title}</h2>
        <p>Review the booking and any applicable terms before confirming.</p>
        <Feedback message={error} />
        <div className="actions">
          <button className="button" disabled={busy} onClick={() => void confirm()}>
            {busy ? "Submitting…" : "Confirm"}
          </button>
          <button className="button secondary" onClick={() => dialog.current?.close()}>
            Go back
          </button>
        </div>
      </dialog>
    </>
  );
}
