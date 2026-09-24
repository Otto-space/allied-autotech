"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { z } from "zod";
import { apiRequest, ApiError, newIdempotencyKey } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { parseBookingPolicy, parseSlots, bookingSchema } from "@/lib/api/booking-schemas";
import { serviceSchema } from "@/lib/api/public-schemas";
import { branchRef } from "@/lib/api/commerce-schemas";
import type { RequestBody } from "@/lib/api/contracts";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountMutation } from "@/lib/api/use-account-mutation";
import { notify } from "@/lib/notifications";
import { useScrollToMessage } from "@/lib/use-scroll-to-message";
import { AccountChangeNotice } from "./account-change-notice";
import { Feedback } from "./feedback";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { PublicEnquiryForm } from "./public-enquiry-form";
import { BookingAccountDetails } from "./booking-account-details";
import type { CustomerVehicle } from "@/lib/api/vehicle-schemas";
const parseService = (value: unknown) => serviceSchema.parse(value);
const parseBranches = (value: unknown) =>
  z.object({ items: z.array(branchRef), nextCursor: z.string().optional() }).parse(value);
export function ServiceDetail({
  serviceId,
  initialService,
}: {
  serviceId: string;
  initialService: z.infer<typeof serviceSchema>;
}) {
  const router = useRouter();
  const service = useResource(
    `/public/services/${encodeURIComponent(serviceId)}`,
    parseService,
    initialService,
  );
  const policy = useResource("/public/booking-policy", parseBookingPolicy);
  const branches = useResource("/public/branches?limit=100", parseBranches);
  const [branch, setBranch] = useState("");
  const [slot, setSlot] = useState("");
  const [slotCursor, setSlotCursor] = useState<string>();
  const [accepted, setAccepted] = useState(false);
  const [notes, setNotes] = useState("");
  const [vehicle, setVehicle] = useState<CustomerVehicle | null>(null);
  const requiresDeposit = (policy.data?.depositBasisPoints ?? 0) > 0;
  const slots = useResource(
    branch && service.data?.pricingType === "FIXED"
      ? `/public/services/${serviceId}/slots?branchId=${branch}&limit=50${slotCursor ? `&cursor=${slotCursor}` : ""}`
      : null,
    parseSlots,
  );
  const [error, setError] = useState<string>();
  const [booking, setBooking] = useState<z.infer<typeof bookingSchema>>();
  const confirmation = useScrollToMessage(booking?.id);
  const [uncertain, setUncertain] = useState(false);
  // Public support is anonymous: preserve its lock when account-scoped reads remount it.
  const [quotationUncertain, setQuotationUncertain] = useState(false);
  const attempt = useRef<{
    fingerprint: string;
    key: string;
    body: RequestBody<"/customers/bookings", "post">;
  } | null>(null);
  const discard = useCallback(() => {
    setBranch("");
    setSlot("");
    setSlotCursor(undefined);
    setAccepted(false);
    setNotes("");
    setVehicle(null);
    setError(undefined);
    setBooking(undefined);
    setUncertain(false);
    attempt.current = null;
  }, []);
  const operation = useAccountMutation(discard);
  const { busy } = operation;
  async function book() {
    if (busy || !slot || (requiresDeposit && !accepted) || !policy.data || booking)
      return;
    const customerNotes = notes.replace(/[\r\n\t]+/g, " ").trim();
    if (
      !uncertain &&
      (customerNotes.length > 2000 || /[\u0000-\u001f\u007f]/.test(customerNotes))
    ) {
      setError("Use ordinary text of up to 2,000 characters for your booking notes.");
      document.getElementById("booking-notes")?.focus();
      return;
    }
    const controller = operation.begin();
    if (!controller) return;
    setError(undefined);
    const body: RequestBody<"/customers/bookings", "post"> =
      uncertain && attempt.current
        ? attempt.current.body
        : {
            slotId: slot,
            policyVersion: policy.data.version,
            ...(requiresDeposit ? { acceptNonRefundableDeposit: true } : {}),
            ...(customerNotes ? { customerNotes } : {}),
            ...(vehicle ? { vehicleId: vehicle.id } : {}),
          };
    const fingerprint = JSON.stringify(body);
    if (attempt.current?.fingerprint !== fingerprint)
      attempt.current = { fingerprint, key: newIdempotencyKey(), body };
    try {
      const result = await apiRequest("/customers/bookings", {
        method: "POST",
        csrf: true,
        signal: controller.signal,
        idempotencyKey: attempt.current.key,
        body,
      });
      if (controller.signal.aborted) return;
      const response = z.object({ booking: bookingSchema }).parse(result.data);
      setBooking(response.booking);
      setUncertain(false);
      notify("Booking request received. Review its status in your account.", {
        tone: "success",
        action: {
          label: "View booking",
          href: `/dashboard/bookings/${response.booking.id}`,
        },
      });
    } catch (value) {
      if (controller.signal.aborted) return;
      if (value instanceof ApiError && value.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/services/${serviceId}`)}`);
        return;
      }
      setUncertain(
        !(value instanceof ApiError && value.status >= 400 && value.status < 500),
      );
      setError(
        value instanceof ApiError
          ? value.message
          : "We could not confirm the booking. Check your bookings before making another request.",
      );
    } finally {
      operation.finish(controller);
    }
  }
  const current = service.data;
  return (
    <>
      <SiteHeader />
      <main id="main" className="section">
        <div className="container narrow">
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <Link href="/services">Services</Link>
            <span aria-hidden="true">/</span>
            <span>{current?.name ?? "Service details"}</span>
          </nav>
          <AccountChangeNotice visible={operation.sessionChanged} />
          <Feedback message={service.error} />
          {service.error && (
            <button className="button secondary" onClick={service.refresh}>
              Retry service
            </button>
          )}
          {service.loading && <p role="status">Loading service…</p>}
          {current && (
            <>
              <h1>{current.name}</h1>
              <p className="lead">
                {current.description ??
                  current.shortDescription ??
                  "Discuss your vehicle’s needs with our team."}
              </p>
              <p className="price">{formatKobo(current.priceKobo)}</p>
              {current.durationMinutes !== null && (
                <p className="muted">
                  Listed duration: {current.durationMinutes} minutes
                </p>
              )}
              {current.pricingType === "QUOTE_REQUIRED" ? (
                <section className="detail-section">
                  <h2>Tell us what your vehicle needs.</h2>
                  <PublicEnquiryForm
                    serviceId={current.id}
                    serviceName={current.name}
                    submissionLocked={quotationUncertain}
                    onSubmissionUncertain={() => setQuotationUncertain(true)}
                  />
                </section>
              ) : (
                <section className="detail-section">
                  <h2>Choose an available appointment.</h2>
                  <Feedback
                    message={error ?? policy.error ?? branches.error ?? slots.error}
                  />
                  {(policy.error || branches.error || slots.error) && (
                    <button
                      className="button secondary"
                      onClick={() => {
                        policy.refresh();
                        branches.refresh();
                        slots.refresh();
                      }}
                    >
                      Refresh availability & terms
                    </button>
                  )}
                  {booking ? (
                    <div className="notice success" ref={confirmation} role="status">
                      <h3>Booking request received</h3>
                      <p>Status: {booking.status.replaceAll("_", " ")}</p>
                      <p>
                        {formatBusinessDate(booking.scheduledAt)} ·{" "}
                        {booking.branch?.name ?? "Branch not assigned"}
                      </p>
                      {booking.vehicle && (
                        <p>
                          Vehicle: {booking.vehicle.year} {booking.vehicle.make}{" "}
                          {booking.vehicle.model}
                          {booking.vehicle.registrationNumber
                            ? ` · ${booking.vehicle.registrationNumber}`
                            : ""}
                        </p>
                      )}
                      {booking.customerNotes && (
                        <p>Your notes: {booking.customerNotes}</p>
                      )}
                      {booking.depositPayment && (
                        <p>Deposit due: {formatKobo(booking.depositAmountKobo)}</p>
                      )}
                      {booking.status === "REQUESTED" && (
                        <p>
                          Your appointment is awaiting workshop confirmation. No deposit
                          is required to submit this request.
                        </p>
                      )}
                      {booking.paymentHoldExpiresAt && (
                        <p>
                          Hold expires {formatBusinessDate(booking.paymentHoldExpiresAt)}.
                        </p>
                      )}
                      <Link className="button" href={`/dashboard/bookings/${booking.id}`}>
                        View booking
                      </Link>
                    </div>
                  ) : (
                    <>
                      <div className="field">
                        <label htmlFor="service-branch">Workshop branch</label>
                        <select
                          id="service-branch"
                          value={branch}
                          disabled={busy || uncertain}
                          onChange={(event) => {
                            setBranch(event.target.value);
                            setSlot("");
                            setSlotCursor(undefined);
                            setAccepted(false);
                          }}
                        >
                          <option value="">Choose a branch</option>
                          {branches.data?.items.map((item) => (
                            <option value={item.id} key={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      {slots.loading && (
                        <p role="status">Checking available appointments…</p>
                      )}
                      <div className="slot-grid">
                        {slots.data?.items.map((item) => (
                          <button
                            key={item.id}
                            disabled={busy || uncertain || slots.loading}
                            className="slot"
                            aria-pressed={slot === item.id}
                            onClick={() => setSlot(item.id)}
                          >
                            {formatBusinessDate(item.startsAt)}
                          </button>
                        ))}
                      </div>
                      {branch &&
                        !slots.loading &&
                        !slots.error &&
                        slots.data?.items.length === 0 && (
                          <div className="empty">
                            No published appointments on this page. Try another branch or
                            contact our team.
                          </div>
                        )}
                      {slots.data?.nextCursor && (
                        <button
                          className="button secondary"
                          disabled={busy || uncertain}
                          onClick={() => {
                            setSlotCursor(slots.data?.nextCursor);
                            setSlot("");
                          }}
                        >
                          More appointments
                        </button>
                      )}
                      {policy.data && (
                        <div className="notice">
                          <h3>
                            {requiresDeposit
                              ? "Booking deposit terms"
                              : "Before you request a booking"}
                          </h3>
                          {!requiresDeposit ? (
                            <p>
                              No deposit is required. The workshop will review your
                              request and confirm availability. Submitting a request does
                              not confirm an appointment. Cancellation is free.
                            </p>
                          ) : (
                            <>
                              <p>
                                The deposit is {policy.data.depositBasisPoints / 100}% of
                                the service price. Available appointments are{" "}
                                {policy.data.minimumAdvanceHours / 24}–
                                {policy.data.maximumAdvanceHours / 24} days ahead, with a{" "}
                                {policy.data.paymentHoldMinutes}-minute payment hold.
                              </p>
                              <p>
                                {policy.data.depositRefundableForCustomerCancellation
                                  ? "The published policy allows a refundable deposit for customer cancellation."
                                  : "The deposit is non-refundable if you cancel."}{" "}
                                You may reschedule up to{" "}
                                {policy.data.customerRescheduleLimit} time, at least{" "}
                                {policy.data.customerRescheduleCutoffHours} hours before
                                your appointment.
                              </p>
                              <label className="check-label">
                                <input
                                  type="checkbox"
                                  checked={accepted}
                                  disabled={busy || uncertain}
                                  onChange={(event) => setAccepted(event.target.checked)}
                                />{" "}
                                I have read and accept these deposit terms.
                              </label>
                            </>
                          )}
                        </div>
                      )}
                      <BookingAccountDetails
                        serviceId={serviceId}
                        vehicle={vehicle}
                        onVehicleChange={setVehicle}
                        disabled={busy || uncertain}
                      />
                      <div className="field">
                        <label htmlFor="booking-notes">
                          What should we know about your vehicle? (optional)
                        </label>
                        <textarea
                          id="booking-notes"
                          maxLength={2000}
                          value={notes}
                          disabled={busy || uncertain}
                          onChange={(event) => setNotes(event.target.value)}
                        />
                      </div>
                      {uncertain && (
                        <Feedback
                          message="Confirmation is pending. Check this same request again or view your bookings before choosing another appointment."
                          tone="info"
                        />
                      )}
                      <div className="actions">
                        <button
                          className="button"
                          disabled={
                            busy ||
                            !slot ||
                            (requiresDeposit && !accepted) ||
                            !policy.data ||
                            !!slots.error ||
                            slots.loading ||
                            !!policy.error
                          }
                          onClick={() => void book()}
                        >
                          {busy
                            ? "Submitting…"
                            : uncertain
                              ? "Check the same booking request"
                              : "Request booking"}
                        </button>
                        <Link className="text-link" href="/dashboard/bookings">
                          Your bookings →
                        </Link>
                      </div>
                    </>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
