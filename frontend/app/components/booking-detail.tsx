"use client";
import { NotificationRecordContext } from "./notification-record-context";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, RefreshCw } from "lucide-react";
import { apiRequest, ApiError, newIdempotencyKey } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { useAccountMutation } from "@/lib/api/use-account-mutation";
import { parseBookingPolicy, parseSlots } from "@/lib/api/booking-schemas";
import {
  parseCustomerBookingDetail,
  type CustomerBookingDetail,
} from "@/lib/api/customer-booking-detail-schema";
import { formatBusinessDate } from "@/lib/format/date";
import { formatKobo } from "@/lib/format/money";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import {
  BookingAppointment,
  BookingDeposit,
  BookingProgress,
  BookingQuotations,
  quoteOpen,
  vehicleName,
  type BookingQuote,
} from "./booking-detail-sections";

type Decision = {
  title: string;
  description: string;
  path: string;
  method: "POST" | "PATCH";
  body: unknown;
  facts: MutationProposal["facts"];
  idempotent?: boolean;
  quote?: BookingQuote;
};
export function BookingDetail({ bookingId }: { bookingId: string }) {
  const path = `/customers/bookings/${encodeURIComponent(bookingId)}`;
  const parse = useCallback(
    (value: unknown) => parseCustomerBookingDetail(value, bookingId),
    [bookingId],
  );
  const booking = useResource(path, parse);
  const policy = useResource("/public/booking-policy", parseBookingPolicy);
  const [showSlots, setShowSlots] = useState(false);
  const [slot, setSlot] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [slotTrail, setSlotTrail] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string>();
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [message, setMessage] = useState<string>();
  const [requiredRevision, setRequiredRevision] = useState<number | null>(null);
  const attempted = useRef(false);
  const reset = useCallback(() => {
    setProposal(null);
    setShowSlots(false);
    setSlot("");
    setPreferredTime("");
    setSlotTrail([]);
    setReason("");
    setReasonError(undefined);
    setMessage(undefined);
  }, []);
  const mutation = useAccountMutation(reset);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const current = !booking.loading && !booking.error ? booking.data : undefined;
  const fresh =
    !!current &&
    !booking.refreshing &&
    !booking.refreshError &&
    (requiredRevision === null ||
      (booking.settledRevision !== null && booking.settledRevision > requiredRevision));
  const verifiedPolicy =
    !policy.loading && !policy.error && !policy.refreshing && !policy.refreshError
      ? policy.data
      : undefined;
  const disruption =
    current?.status === "CONFIRMED" &&
    !!current.disruptionRequestedAt &&
    current.disruptionResolution === "PENDING";
  const hasDeposit = !!current?.depositPayment && !!current.depositPaidAt;
  const canReschedule =
    current?.status === "CONFIRMED" &&
    !!current.branch &&
    !!verifiedPolicy &&
    current.customerRescheduleCount < verifiedPolicy.customerRescheduleLimit &&
    !!current.scheduledAt &&
    Date.parse(current.scheduledAt) - now >
      verifiedPolicy.customerRescheduleCutoffHours * 3600000;
  const canChooseSlot =
    !!current?.branch && ((!!current.bookingSlotId && disruption) || canReschedule);
  const slotCursor = slotTrail.at(-1);
  const slots = useResource(
    showSlots && canChooseSlot && current?.service
      ? `/public/services/${current.service.id}/slots?branchId=${current.branch!.id}&limit=50${slotCursor ? `&cursor=${encodeURIComponent(slotCursor)}` : ""}`
      : null,
    parseSlots,
  );
  const alternatives =
    !slots.loading && !slots.error && !slots.refreshing && !slots.refreshError
      ? (slots.data?.items.filter(
          (item) =>
            item.id !== current?.bookingSlotId &&
            item.serviceId === current?.service?.id &&
            item.branchId === current?.branch?.id &&
            Date.parse(item.startsAt) > now,
        ) ?? [])
      : [];
  const selectedSlot = alternatives.find((item) => item.id === slot);
  const preferredDate = preferredTime ? new Date(`${preferredTime}:00+01:00`) : null;
  const preferredAt =
    !disruption && preferredDate && Number.isFinite(preferredDate.getTime())
      ? preferredDate.toISOString()
      : null;
  const replacementAt = selectedSlot?.startsAt ?? preferredAt;
  const disabled = !fresh || mutation.busy || !!proposal;
  function refresh() {
    setProposal(null);
    setSlot("");
    setPreferredTime("");
    setRequiredRevision(booking.settledRevision ?? 0);
    booking.refresh();
  }
  function toggleSlots() {
    setShowSlots((value) => !value);
    setSlot("");
    setPreferredTime("");
    setSlotTrail([]);
  }
  function ask(value: Decision) {
    if (!current || disabled) return;
    const reviewed: CustomerBookingDetail = current;
    const key = value.idempotent ? newIdempotencyKey() : undefined;
    let sent = false;
    attempted.current = false;
    setMessage(undefined);
    setProposal({
      title: value.title,
      description: value.description,
      facts: [
        { label: "Service", value: current.service?.name ?? "Vehicle concern" },
        { label: "Vehicle", value: vehicleName(current) },
        ...value.facts,
      ],
      retrySafely: !!value.idempotent,
      retryAfterRejection: false,
      submit: async () => {
        const controller = mutation.begin();
        if (!controller) throw new Error("A booking change is already pending.");
        attempted.current = true;
        try {
          // Recheck the reviewed record before the first write. An uncertain keyed
          // retry must reach the server's replay lookup with the original payload.
          if (!sent) {
            const response = await apiRequest<unknown>(path, {
              signal: controller.signal,
            });
            const latest = parse(response.data);
            if (latest.version !== reviewed.version || latest.status !== reviewed.status)
              throw new ApiError(409, { error: { code: "STALE_VERSION" } });
            if (value.quote) {
              const quote = latest.quotes.find((item) => item.id === value.quote!.id);
              if (
                !quote ||
                quote.revision !== value.quote.revision ||
                !quoteOpen(quote, Date.now())
              )
                throw new ApiError(409, { error: { code: "STALE_VERSION" } });
            }
          }
          sent = true;
          await apiRequest(value.path, {
            method: value.method,
            body: value.body,
            csrf: true,
            idempotencyKey: key,
            signal: controller.signal,
          });
        } finally {
          mutation.finish(controller);
        }
      },
    });
  }
  function closeReview() {
    setProposal(null);
    if (attempted.current) {
      setRequiredRevision(booking.settledRevision ?? 0);
      booking.refresh();
    }
  }
  function reviewQuote(quote: BookingQuote, action: "accept" | "reject") {
    if (!quoteOpen(quote, now)) return;
    ask({
      title: `${action === "accept" ? "Accept" : "Reject"} this quotation?`,
      description: "Review the quotation total before confirming.",
      path: `${path}/quotes/${quote.id}/${action}`,
      method: "POST",
      body: { expectedRevision: quote.revision },
      quote,
      facts: [
        { label: "Quotation", value: quote.quoteNumber },
        { label: "Revision", value: String(quote.revision) },
        { label: "Total", value: formatKobo(quote.totalKobo) },
        { label: "Expires", value: formatBusinessDate(quote.expiresAt) },
      ],
    });
  }
  return (
    <div className="customer-booking-detail">
      <nav className="booking-detail-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/dashboard">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <Link href="/dashboard/bookings">Bookings</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">{current?.service?.name ?? "Booking details"}</span>
          </li>
        </ol>
      </nav>
      <header className="booking-detail-heading">
        <h1>Booking details</h1>
        <button
          className="button secondary"
          disabled={booking.loading || booking.refreshing || mutation.busy || !!proposal}
          onClick={refresh}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Refresh booking
        </button>
      </header>
      <Feedback message={booking.error} />
      <Feedback message={message} tone="info" toast="Booking update recorded." />
      {booking.loading && (
        <div className="booking-detail-loading" role="status">
          <p>Checking your booking...</p>
          <span />
          <span />
          <span />
        </div>
      )}
      {booking.refreshing && <p role="status">Checking for booking updates...</p>}
      {booking.refreshError && (
        <div className="booking-detail-warning" role="status">
          <p>
            We could not refresh this booking. The details below may be out of date.
            Refresh before making a change.
          </p>
        </div>
      )}
      {!booking.loading && !current && (
        <div className="booking-detail-surface">
          <h2>Booking unavailable</h2>
          <p>We could not load this booking. Try again using Refresh booking.</p>
          <Link className="button secondary" href="/dashboard/bookings">
            Your bookings
          </Link>
        </div>
      )}
      {current &&
        !booking.loading &&
        !booking.refreshing &&
        !booking.error &&
        !booking.refreshError && (
          <NotificationRecordContext resourceType="BOOKING" resourceId={current.id} />
        )}
      {current && (
        <>
          <div className="booking-detail-grid">
            <div className="booking-detail-primary">
              <BookingAppointment booking={current} />
              <BookingDeposit booking={current} />
            </div>
            <BookingProgress booking={current} />
          </div>
          <section className="booking-changes" aria-labelledby="booking-changes-title">
            <h2 id="booking-changes-title">Appointment changes</h2>
            {current.alternativeStartsAt &&
              ["REQUESTED", "CONFIRMED"].includes(current.status) && (
                <section
                  className="booking-detail-notice"
                  aria-labelledby="customer-alternative-title"
                >
                  <h3 id="customer-alternative-title">
                    The workshop proposed another time
                  </h3>
                  <p>{formatBusinessDate(current.alternativeStartsAt)}</p>
                  <p>{current.alternativeReason}</p>
                  <p>
                    Your existing appointment is unchanged. Accepting requests this time
                    for staff confirmation; it does not reserve capacity, charge a fee or
                    use your reschedule allowance.
                  </p>
                  {current.alternativeVersion !== current.version ? (
                    <p>
                      This proposal is out of date. Ask the workshop for an updated
                      suggestion.
                    </p>
                  ) : (
                    <div className="actions">
                      {(["ACCEPT", "DECLINE"] as const).map((decision) => (
                        <button
                          key={decision}
                          className="button secondary"
                          disabled={disabled}
                          onClick={() =>
                            ask({
                              title:
                                decision === "ACCEPT"
                                  ? "Request the proposed time?"
                                  : "Decline the proposed time?",
                              description:
                                decision === "ACCEPT"
                                  ? "Your booking will await staff confirmation at the proposed time. This is not a confirmed appointment and does not use your customer reschedule allowance."
                                  : "Your current appointment time and status will stay unchanged.",
                              path: `${path}/alternative-response`,
                              method: "POST",
                              body: { decision, expectedVersion: current.version },
                              facts: [
                                {
                                  label: "Proposed time",
                                  value: formatBusinessDate(current.alternativeStartsAt!),
                                },
                                {
                                  label: "Workshop reason",
                                  value: current.alternativeReason ?? "Not recorded",
                                },
                              ],
                            })
                          }
                        >
                          {decision === "ACCEPT"
                            ? "Review proposed time"
                            : "Decline proposed time"}
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              )}
            {policy.loading && <p role="status">Checking booking terms...</p>}
            {(policy.error || policy.refreshError) && (
              <div className="booking-detail-warning">
                <p>
                  Booking terms are unavailable. Refresh the policy before changing your
                  appointment.
                </p>
                <button
                  className="button secondary"
                  disabled={policy.loading || policy.refreshing}
                  onClick={policy.refresh}
                >
                  Retry booking policy
                </button>
              </div>
            )}
            {disruption && (
              <div className="booking-disruption">
                <h3>Your appointment was disrupted</h3>
                {current.disruptionReason && <p>{current.disruptionReason}</p>}
                <p>
                  Request another available slot without using your customer reschedule,
                  or cancel free. A replacement slot still needs workshop confirmation.
                  {hasDeposit &&
                    " You can request review of your historical deposit; a refund request does not mean a refund has been completed."}
                </p>
                <div className="actions">
                  {canChooseSlot && (
                    <button
                      className="button secondary"
                      disabled={disabled}
                      aria-expanded={showSlots}
                      aria-controls="booking-slot-choices"
                      onClick={toggleSlots}
                    >
                      Choose another slot
                    </button>
                  )}
                  {hasDeposit && (
                    <button
                      className="button secondary"
                      disabled={disabled}
                      onClick={() =>
                        ask({
                          title: "Request a disruption refund?",
                          description:
                            "This cancels the disrupted booking and requests a refund review. It does not confirm that a refund has been completed.",
                          path: `${path}/disruption-resolution`,
                          method: "POST",
                          body: {
                            resolution: "REFUND",
                            expectedVersion: current.version,
                          },
                          idempotent: true,
                          facts: [
                            {
                              label: "Appointment",
                              value: formatBusinessDate(current.scheduledAt),
                            },
                            {
                              label: "Recorded deposit",
                              value: formatKobo(current.depositPayment!.amountKobo),
                            },
                            {
                              label: "Requested outcome",
                              value: "Cancel booking and request refund review",
                            },
                          ],
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
              <button
                className="button secondary"
                disabled={disabled}
                aria-expanded={showSlots}
                aria-controls="booking-slot-choices"
                onClick={toggleSlots}
              >
                Reschedule appointment
              </button>
            )}
            {!disruption &&
              current.status === "CONFIRMED" &&
              verifiedPolicy &&
              !canReschedule && (
                <p>
                  Online rescheduling is unavailable for this booking. Contact customer
                  care if you need help with the appointment.
                </p>
              )}
            {showSlots && canChooseSlot && (
              <section
                className="booking-slot-choices booking-detail-surface"
                id="booking-slot-choices"
                aria-labelledby="slot-title"
              >
                <h3 id="slot-title">Choose a new slot</h3>
                <p>A replacement slot needs workshop confirmation.</p>
                <Feedback message={slots.error ?? slots.refreshError} />
                {(slots.error || slots.refreshError) && (
                  <button
                    className="button secondary"
                    onClick={() => {
                      setSlot("");
                      setPreferredTime("");
                      slots.refresh();
                    }}
                  >
                    Retry slots
                  </button>
                )}
                {(slots.loading || slots.refreshing) && (
                  <p role="status">Loading slots...</p>
                )}
                <div className="booking-slot-grid">
                  {alternatives.map((item) => (
                    <button
                      className="booking-slot"
                      disabled={disabled}
                      aria-pressed={slot === item.id}
                      onClick={() => {
                        setSlot(item.id);
                        setPreferredTime("");
                      }}
                      key={item.id}
                    >
                      {formatBusinessDate(item.startsAt)}
                    </button>
                  ))}
                </div>
                {!slots.loading &&
                  !slots.error &&
                  !slots.refreshError &&
                  !alternatives.length && (
                    <p>
                      No alternative slots on this page. You can request a preferred time
                      below, or contact customer care for help.
                    </p>
                  )}
                {!disruption && (
                  <div className="field">
                    <label htmlFor="reschedule-preferred">
                      Or request a preferred time (Lagos time)
                    </label>
                    <input
                      id="reschedule-preferred"
                      type="datetime-local"
                      value={preferredTime}
                      disabled={disabled}
                      onChange={(event) => {
                        setPreferredTime(event.target.value);
                        setSlot("");
                      }}
                    />
                    <p>
                      This uses your permitted reschedule and returns the booking to
                      workshop review. Availability is not confirmed.
                    </p>
                  </div>
                )}
                <div className="actions">
                  {!!slotTrail.length && (
                    <button
                      className="button secondary"
                      disabled={slots.loading || disabled}
                      onClick={() => {
                        setSlotTrail((value) => value.slice(0, -1));
                        setSlot("");
                        setPreferredTime("");
                      }}
                    >
                      Previous slots
                    </button>
                  )}
                  {slots.data?.nextCursor && (
                    <button
                      className="button secondary"
                      disabled={slots.loading || !!slots.error || disabled}
                      onClick={() => {
                        setSlotTrail((value) => [...value, slots.data!.nextCursor!]);
                        setSlot("");
                        setPreferredTime("");
                      }}
                    >
                      More slots
                    </button>
                  )}
                  <button
                    className="button"
                    disabled={disabled || !replacementAt}
                    onClick={() => {
                      if (!replacementAt) return;
                      ask({
                        title: "Request the new appointment time?",
                        description:
                          "The new requested time needs workshop confirmation.",
                        path: `${path}/${disruption ? "disruption-resolution" : "schedule"}`,
                        method: disruption ? "POST" : "PATCH",
                        body: {
                          ...(selectedSlot
                            ? { slotId: selectedSlot.id }
                            : { preferredAt }),
                          expectedVersion: current.version,
                          ...(disruption ? { resolution: "TRANSFER" } : {}),
                        },
                        idempotent: true,
                        facts: [
                          {
                            label: "Current appointment",
                            value: formatBusinessDate(current.scheduledAt),
                          },
                          {
                            label: "New appointment",
                            value: formatBusinessDate(replacementAt),
                          },
                          { label: "Workshop", value: current.branch!.name },
                        ],
                      });
                    }}
                  >
                    Review reschedule
                  </button>
                </div>
              </section>
            )}
            {["REQUESTED", "AWAITING_DEPOSIT", "CONFIRMED"].includes(current.status) &&
              (!disruption || !hasDeposit) && (
                <details className="booking-cancellation">
                  <summary>Cancel this booking</summary>
                  <p>
                    {verifiedPolicy?.depositBasisPoints === 0
                      ? "You can cancel this booking free of charge."
                      : "Review the published cancellation policy or contact customer care before cancelling."}
                    {hasDeposit &&
                      " Any historical deposit requires a separate refund review; cancelling does not complete a refund."}
                  </p>
                  <form
                    data-draft-key={JSON.stringify(["booking-detail:1", bookingId])}
                    onSubmit={(event) => {
                      event.preventDefault();
                      const clean = reason.trim();
                      if (!clean || /[\u0000-\u001f\u007f]/.test(clean)) {
                        setReasonError(
                          "Enter a reason without line breaks or control characters.",
                        );
                        document.getElementById("booking-cancel-reason")?.focus();
                        return;
                      }
                      setReasonError(undefined);
                      ask({
                        title: "Cancel this booking?",
                        description: hasDeposit
                          ? "Cancelling releases the appointment. Any historical deposit requires a separate refund review."
                          : "Cancelling releases the appointment.",
                        path: `${path}/cancel`,
                        method: "POST",
                        body: { reason: clean, expectedVersion: current.version },
                        facts: [
                          {
                            label: "Appointment",
                            value: formatBusinessDate(current.scheduledAt),
                          },
                          { label: "Reason", value: clean },
                        ],
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
                        value={reason}
                        onChange={(event) => {
                          setReason(event.target.value);
                          setReasonError(undefined);
                        }}
                        aria-invalid={!!reasonError}
                        aria-describedby="booking-cancel-help"
                      />
                      <p id="booking-cancel-help">
                        {reasonError ?? "500 characters maximum."}
                      </p>
                    </div>
                    <button
                      className="button secondary"
                      disabled={disabled || !verifiedPolicy}
                    >
                      Review cancellation
                    </button>
                  </form>
                </details>
              )}
          </section>
          <BookingQuotations
            quotes={current.quotes}
            now={now}
            disabled={disabled}
            onReview={reviewQuote}
          />
        </>
      )}
      {proposal && current && (
        <MutationReview
          proposal={proposal}
          onClose={closeReview}
          exposeBusyState
          onSuccess={() => {
            setMessage(
              "Your request was recorded. Review the updated booking status below.",
            );
            setShowSlots(false);
            setSlot("");
            setPreferredTime("");
            setReason("");
          }}
        />
      )}
    </div>
  );
}
