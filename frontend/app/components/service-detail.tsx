"use client";
import Link from "next/link";
import Image from "next/image";
import { ServicePhoto } from "./service-photo";
import {
  ArrowDown,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  MessageCircle,
  Phone,
  Wrench,
} from "lucide-react";
import { business } from "@/lib/business";
import { ServiceChoice } from "../services/[serviceId]/service-choice";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import "../contact/contact.css";
import "../services/[serviceId]/service-detail.css";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { z } from "zod";
import {
  apiRequest,
  ApiError,
  newIdempotencyKey,
  SESSION_CHANGED,
} from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { parseBookingPolicy, parseSlots, bookingSchema } from "@/lib/api/booking-schemas";
import { serviceSchema } from "@/lib/api/public-schemas";
import { branchRef } from "@/lib/api/commerce-schemas";
import type { RequestBody } from "@/lib/api/contracts";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountMutation } from "@/lib/api/use-account-mutation";
import { AccountChangeNotice } from "./account-change-notice";
import { Feedback } from "./feedback";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { PublicEnquiryForm } from "./public-enquiry-form";
import { BookingAccountDetails } from "./booking-account-details";
import { CopyControl } from "./copy-control";
import type { CustomerVehicle } from "@/lib/api/vehicle-schemas";
type BookingReview = {
  body: RequestBody<"/customers/bookings", "post">;
  serviceName: string;
  branchName: string;
  startsAt: string;
  endsAt: string;
  vehicleName: string;
  priceKobo: string;
  terms: ReturnType<typeof parseBookingPolicy>;
};
const parseBranches = (value: unknown) =>
  z.object({ items: z.array(branchRef), nextCursor: z.string().optional() }).parse(value);
function focus(element: HTMLElement | null) {
  element?.focus({ preventScroll: true });
  element?.scrollIntoView({
    block: "center",
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
  });
}
export function ServiceDetail({
  serviceId,
  initialService,
  relatedServices,
}: {
  serviceId: string;
  initialService: z.infer<typeof serviceSchema>;
  relatedServices?: ReactNode;
}) {
  const parseService = useCallback(
    (value: unknown) => {
      const parsed = serviceSchema.parse(value);
      if (parsed.id !== serviceId) throw new Error("Unconfirmed service identity");
      return parsed;
    },
    [serviceId],
  );
  const service = useResource(
    `/public/services/${encodeURIComponent(serviceId)}`,
    parseService,
    initialService,
    { revalidateOnMount: false },
  );
  const current = service.data;
  const fixed = current?.pricingType === "FIXED";
  const bookable =
    fixed && current.priceKobo !== null && current.durationMinutes !== null;
  const [access, setAccess] = useState<
    "checking" | "customer" | "anonymous" | "restricted" | "error"
  >("checking");
  const [accessRetry, setAccessRetry] = useState(0);
  useEffect(() => {
    if (!bookable) return;
    let pending: AbortController | undefined;
    async function check() {
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      try {
        const response = await apiRequest("/auth/session", {
          optionalSession: true,
          signal: controller.signal,
        });
        const identity = z
          .object({
            user: z.object({
              id: z.uuid(),
              role: z.enum(["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"]),
            }),
          })
          .parse(response.data);
        if (!controller.signal.aborted)
          setAccess(identity.user.role === "CUSTOMER" ? "customer" : "restricted");
      } catch (failure) {
        if (!controller.signal.aborted)
          setAccess(
            failure instanceof ApiError && failure.status === 401 ? "anonymous" : "error",
          );
      }
    }
    function changed() {
      setAccess("checking");
      void check();
    }
    void check();
    window.addEventListener(SESSION_CHANGED, changed);
    return () => {
      pending?.abort();
      window.removeEventListener(SESSION_CHANGED, changed);
    };
  }, [bookable, accessRetry]);
  const policy = useResource(
    bookable ? "/public/booking-policy" : null,
    parseBookingPolicy,
  );
  const branchPages = useCursorPage();
  const branchCursor = branchPages.cursor
    ? "&cursor=" + encodeURIComponent(branchPages.cursor)
    : "";
  const branches = useResource(
    bookable ? `/public/branches?limit=20${branchCursor}` : null,
    parseBranches,
  );
  const [branchName, setBranchName] = useState("");
  const [branch, setBranch] = useState("");
  const [slot, setSlot] = useState("");
  const [slotCursor, setSlotCursor] = useState<string>();
  const [accepted, setAccepted] = useState(false);
  const [notes, setNotes] = useState("");
  const [vehicle, setVehicle] = useState<CustomerVehicle | null>(null);
  const requiresDeposit = (policy.data?.depositBasisPoints ?? 0) > 0;
  const parseAvailableSlots = useCallback(
    (value: unknown) => {
      const parsed = parseSlots(value);
      if (
        parsed.items.some(
          (item) =>
            item.branchId !== branch ||
            item.serviceId !== serviceId ||
            !Number.isFinite(Date.parse(item.startsAt)) ||
            !Number.isFinite(Date.parse(item.endsAt)) ||
            Date.parse(item.endsAt) <= Date.parse(item.startsAt),
        )
      )
        throw new Error("Unconfirmed appointment details");
      return parsed;
    },
    [branch, serviceId],
  );
  const slots = useResource(
    branch && bookable
      ? `/public/services/${serviceId}/slots?branchId=${branch}&limit=50${slotCursor ? `&cursor=${slotCursor}` : ""}`
      : null,
    parseAvailableSlots,
  );
  const [error, setError] = useState<string>();
  const [booking, setBooking] = useState<z.infer<typeof bookingSchema>>();
  const [review, setReview] = useState<BookingReview>();
  const confirmation = useRef<HTMLHeadingElement>(null);
  const errorHeading = useRef<HTMLHeadingElement>(null);
  const [login, setLogin] = useState(false);
  const [notesError, setNotesError] = useState<string>();
  const formHeading = useRef<HTMLHeadingElement>(null);
  const notice = useRef<HTMLDivElement>(null);
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
    setBranchName("");
    setLogin(false);
    setNotesError(undefined);
    setSlot("");
    setSlotCursor(undefined);
    setAccepted(false);
    setNotes("");
    setVehicle(null);
    setError(undefined);
    setBooking(undefined);
    setReview(undefined);
    setUncertain(false);
    attempt.current = null;
  }, []);
  const operation = useAccountMutation(discard);
  const { busy } = operation;
  const selectedSlot = slots.data?.items.find(
    (item) =>
      item.id === slot && item.branchId === branch && item.serviceId === serviceId,
  );
  useEffect(() => {
    if (booking) focus(confirmation.current);
  }, [booking]);
  useEffect(() => {
    if (review) focus(formHeading.current);
  }, [review]);
  useEffect(() => {
    if (error)
      focus(notesError ? document.getElementById("booking-notes") : errorHeading.current);
  }, [error, notesError]);
  useEffect(() => {
    if (operation.sessionChanged) focus(notice.current);
  }, [operation.sessionChanged]);
  function reviewBooking() {
    if (
      busy ||
      uncertain ||
      booking ||
      !current ||
      service.error ||
      !selectedSlot ||
      !policy.data ||
      policy.error ||
      slots.loading ||
      slots.error ||
      (requiresDeposit && !accepted) ||
      current.priceKobo === null
    )
      return;
    const customerNotes = notes.replace(/[\r\n\t]+/g, " ").trim();
    if (customerNotes.length > 2000 || /[\u0000-\u001f\u007f]/.test(customerNotes)) {
      setNotesError(
        "Use ordinary text of up to 2,000 characters for your booking notes.",
      );
      setError("Please review your booking notes.");
      document.getElementById("booking-notes")?.focus();
      return;
    }
    setError(undefined);
    setLogin(false);
    setNotesError(undefined);
    setReview({
      body: {
        slotId: selectedSlot.id,
        policyVersion: policy.data.version,
        ...(requiresDeposit ? { acceptNonRefundableDeposit: true } : {}),
        ...(customerNotes ? { customerNotes } : {}),
        ...(vehicle ? { vehicleId: vehicle.id } : {}),
      },
      serviceName: current.name,
      branchName,
      startsAt: selectedSlot.startsAt,
      endsAt: selectedSlot.endsAt,
      vehicleName: vehicle
        ? `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.registrationNumber ? ` · ${vehicle.registrationNumber}` : ""}`
        : "No saved vehicle selected",
      priceKobo: String(current.priceKobo),
      terms: policy.data,
    });
  }
  function editDetails() {
    if (busy || uncertain) return;
    setReview(undefined);
    setError(undefined);
    setLogin(false);
    requestAnimationFrame(() => focus(formHeading.current));
  }
  const reviewChanged =
    !!review &&
    (review.body.policyVersion !== policy.data?.version ||
      JSON.stringify(review.terms) !== JSON.stringify(policy.data) ||
      review.body.slotId !== selectedSlot?.id ||
      review.startsAt !== selectedSlot?.startsAt ||
      review.endsAt !== selectedSlot?.endsAt ||
      review.priceKobo !== String(current?.priceKobo) ||
      review.serviceName !== current?.name ||
      !!policy.error ||
      !!slots.error);
  async function book() {
    if (
      busy ||
      booking ||
      !current ||
      !review ||
      access !== "customer" ||
      service.error ||
      (!uncertain &&
        (reviewChanged ||
          !selectedSlot ||
          (requiresDeposit && !accepted) ||
          !policy.data ||
          slots.loading ||
          !!slots.error ||
          !!policy.error))
    )
      return;
    const controller = operation.begin();
    if (!controller) return;
    setError(undefined);
    setLogin(false);
    setNotesError(undefined);
    const body: RequestBody<"/customers/bookings", "post"> =
      uncertain && attempt.current ? attempt.current.body : review.body;
    const fingerprint = JSON.stringify(body);
    if (attempt.current?.fingerprint !== fingerprint)
      attempt.current = { fingerprint, key: newIdempotencyKey(), body };
    let submitted = false;
    try {
      const session = z
        .object({
          user: z.object({ role: z.enum(["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"]) }),
        })
        .parse(
          (
            await apiRequest("/auth/session", {
              optionalSession: true,
              signal: controller.signal,
            })
          ).data,
        );
      if (controller.signal.aborted) return;
      if (session.user.role !== "CUSTOMER") {
        setAccess("restricted");
        setError(
          "Booking requests are available to customer accounts. Contact our team for help.",
        );
        return;
      }
      submitted = true;
      const result = await apiRequest("/customers/bookings", {
        method: "POST",
        csrf: true,
        signal: controller.signal,
        idempotencyKey: attempt.current.key,
        body,
      });
      if (controller.signal.aborted) return;
      const response = z.object({ booking: bookingSchema }).parse(result.data);
      if (response.booking.service.id !== serviceId)
        throw new Error("Unconfirmed service identity");
      setBooking(response.booking);
      setUncertain(false);
    } catch (value) {
      if (controller.signal.aborted) return;
      if (value instanceof ApiError && value.status === 401) {
        setLogin(true);
        setError("Sign in to your customer account, then request your appointment.");
        return;
      }
      if (submitted)
        setUncertain(
          !(value instanceof ApiError && value.status >= 400 && value.status < 500),
        );
      if (value instanceof ApiError && value.fields?.["body.customerNotes"]) {
        setReview(undefined);
        setNotesError("Check your booking notes and enter a valid value.");
      }
      setError(
        value instanceof ApiError
          ? value.message
          : "We could not confirm the booking. Check your bookings before making another request.",
      );
    } finally {
      operation.finish(controller);
    }
  }

  const locked = busy || uncertain;
  let formTitle = "Tell us what you need.";
  if (fixed) {
    if (booking) formTitle = "Your booking request";
    else if (review) formTitle = "Review your booking request";
    else formTitle = "Choose an available appointment.";
  }
  let priceText = "Quotation required";
  if (fixed && current) {
    if (current.priceKobo !== null) priceText = formatKobo(current.priceKobo);
    else priceText = "Contact us for pricing";
  }
  return (
    <>
      <SiteHeader />
      <main id="main" className="public-site contact-page service-detail">
        <div className="sd-container">
          <nav className="sd-breadcrumb" aria-label="Breadcrumb">
            <ol>
              <li>
                <Link href="/">Home</Link>
              </li>
              <li>
                <ChevronRight size={14} aria-hidden="true" />
                <Link href="/services">Services</Link>
              </li>
              <li>
                <ChevronRight size={14} aria-hidden="true" />
                <span aria-current="page" title={current?.name}>
                  {current?.name ?? "Service details"}
                </span>
              </li>
            </ol>
          </nav>
          <div ref={notice} tabIndex={-1}>
            <AccountChangeNotice visible={operation.sessionChanged} />
          </div>
          {service.error && (
            <div className="sd-recovery">
              <Feedback message={service.error} />
              <button
                type="button"
                className="button secondary"
                onClick={service.refresh}
              >
                Retry service details
              </button>
              <Link className="text-link" href="/services">
                Browse services
              </Link>
            </div>
          )}
          {!current && service.loading && (
            <output className="sd-recovery">
              Loading service details…
            </output>
          )}
        </div>
        {current && (
          <>
            <section
              className="sd-overview"
              id="service-overview"
              aria-labelledby="sd-title"
            >
              <div className="sd-container sd-hero">
                <div className="sd-identity">
                  <h1 id="sd-title">{current.name}</h1>
                  {current.shortDescription && (
                    <p className="sd-intro">{current.shortDescription}</p>
                  )}
                  <div className="sd-facts">
                    <div>
                      <p className="sd-price">
                        {priceText}
                      </p>
                      {fixed && current.priceKobo !== null && (
                        <p className="sd-price-label">Fixed price</p>
                      )}
                    </div>
                    <p className="sd-duration">
                      <Clock3 size={20} aria-hidden="true" />
                      {current.durationMinutes !== null && current.durationMinutes > 0
                        ? `Listed duration: ${current.durationMinutes} ${current.durationMinutes === 1 ? "minute" : "minutes"}`
                        : "Duration not listed"}
                    </p>
                  </div>
                  <div className="sd-actions">
                    {fixed && access === "restricted" ? (
                      <Link className="button" href="/admin">
                        Go to your dashboard <ArrowRight size={17} aria-hidden="true" />
                      </Link>
                    ) : (
                      <a
                        className="button"
                        href="#service-request"
                        onClick={(event) => {
                          event.preventDefault();
                          focus(booking ? confirmation.current : formHeading.current);
                        }}
                      >
                        {fixed ? "Choose an appointment" : "Send an enquiry"}
                        <ArrowDown size={17} aria-hidden="true" />
                      </a>
                    )}
                    <Link className="button secondary" href="/contact">
                      Talk to our team
                    </Link>
                  </div>
                </div>
                <div className={`sd-media${current.image ? "" : " sd-media-empty"}`}>
                  {current.image ? (
                    <ServicePhoto
                      key={current.image.url}
                      url={current.image.url}
                      alt={current.image.altText ?? current.name}
                      width={current.image.width}
                      height={current.image.height}
                    />
                  ) : (
                    <>
                      <Wrench size={52} strokeWidth={1.25} aria-hidden="true" />
                      <span>Service photo not available</span>
                    </>
                  )}
                </div>
              </div>
            </section>
            <nav className="sd-container sd-section-nav" aria-label="Service sections">
              <a href="#service-overview">Overview</a>
              <a href="#service-about">About this service</a>
              <a href="#service-request">Request</a>
              <a href="#service-questions">FAQ</a>
              {relatedServices && <a href="#service-more">Other services</a>}
            </nav>
          </>
        )}
        {current && (
          <section className="sd-workspace">
            <div className="sd-container sd-layout">
              <aside className="sd-context" aria-label="About this service">
                <div id="service-about">
                  <h2>About this service</h2>
                  <p className="sd-description">
                    {current.description ??
                      "Contact our team to discuss this service and what your vehicle needs."}
                  </p>
                </div>
                <ol className="sd-process">
                  <li>
                    <span>1</span>
                    {fixed
                      ? "Choose a branch and time"
                      : "Tell us what your vehicle needs"}
                  </li>
                  <li>
                    <span>2</span>
                    {fixed ? "Send your booking request" : "Review and send your enquiry"}
                  </li>
                  <li>
                    <span>3</span>
                    {fixed
                      ? "Review updates in your account"
                      : "Discuss the next steps with our team"}
                  </li>
                </ol>
                <div className="sd-preparation">
                  <h3>What to tell us</h3>
                  <ul>
                    <li>When the concern occurs.</li>
                    <li>Warning lights or changes you have noticed.</li>
                    <li>Relevant service history.</li>
                  </ul>
                </div>
                <div className="sd-help">
                  <h2>Need a hand?</h2>
                  <p>Speak with our team about your vehicle before you send a request.</p>
                  <a href={`tel:${business.internationalPhone}`}>
                    <Phone size={18} aria-hidden="true" />
                    {business.phone}
                  </a>
                  <a href={business.whatsapp} target="_blank" rel="noopener noreferrer">
                    <MessageCircle size={18} aria-hidden="true" />
                    Chat on WhatsApp <span className="sr-only">(new tab)</span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </a>
                </div>
              </aside>
              <div className="sd-panel" id="service-request">
                {bookable && (access === "customer" || access === "anonymous") && (
                  <ol className="sd-booking-progress" aria-label="Booking progress">
                    {["Details", "Review", "Received"].map((label, index) => {
                      let step = 0;
                      if (review) step = 1;
                      if (booking) step = 2;
                      return (
                        <li
                          key={label}
                          aria-current={index === step ? "step" : undefined}
                          data-complete={index < step}
                        >
                          <span aria-hidden="true">
                            {index < step ? <CheckCircle2 size={16} /> : index + 1}
                          </span>
                          {label}
                        </li>
                      );
                    })}
                  </ol>
                )}
                <h2
                  ref={formHeading}
                  tabIndex={-1}
                  className={booking ? "sr-only" : "sd-form-title"}
                >
                  {formTitle}
                </h2>
                {!fixed ? (
                  <>
                    <p className="sd-muted">
                      Send an enquiry about {current.name}. Our team can discuss your
                      requirements before preparing a quotation.
                    </p>
                    <div className="contact-form-panel">
                      <PublicEnquiryForm
                        serviceId={serviceId}
                        serviceName={current.name}
                        submissionLocked={quotationUncertain}
                        onSubmissionUncertain={() => setQuotationUncertain(true)}
                        presentation="contact"
                      />
                    </div>
                  </>
                ) : !bookable ? (
                  <div className="sd-recovery">
                    <p>
                      Online appointments are unavailable for this service while its price
                      or duration is being updated.
                    </p>
                    <Link className="button secondary" href="/contact">
                      Contact our team
                    </Link>
                  </div>
                ) : access === "checking" ? (
                  <p role="status" className="sd-muted">
                    Checking booking access…
                  </p>
                ) : access === "error" ? (
                  <div className="sd-recovery">
                    <p>We couldn’t check your account. Try again to continue booking.</p>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => {
                        setAccess("checking");
                        setAccessRetry((value) => value + 1);
                      }}
                    >
                      Retry account check
                    </button>
                  </div>
                ) : access === "restricted" ? (
                  <div className="sd-recovery">
                    <p>
                      Booking requests are available to customer accounts. Your work
                      account can use its dashboard for assigned operations.
                    </p>
                    <Link href="/admin" className="button secondary">
                      Open your dashboard
                    </Link>
                    <Link href="/contact" className="text-link">
                      Contact our team
                    </Link>
                  </div>
                ) : booking ? (
                  <div className="sd-confirmation" role="status">
                    <CheckCircle2 size={32} aria-hidden="true" />
                    <h3 ref={confirmation} tabIndex={-1}>
                      Booking request received
                    </h3>
                    <p>
                      {booking.status === "REQUESTED"
                        ? "Your request is waiting for workshop review. Check your account for the confirmed appointment and updates."
                        : "Review your booking for its current status and next steps."}
                    </p>
                    <div className="sd-booking-reference">
                      <label htmlFor="booking-reference">Booking reference</label>
                      <textarea
                        id="booking-reference"
                        rows={2}
                        readOnly
                        value={booking.id}
                      />
                      <CopyControl
                        value={booking.id}
                        label="Copy booking reference"
                        fieldId="booking-reference"
                      />
                    </div>
                    <dl>
                      <dt>Status</dt>
                      <dd>{booking.status.replaceAll("_", " ")}</dd>
                      <dt>Service</dt>
                      <dd>{booking.service.name}</dd>
                      {booking.branch && (
                        <>
                          <dt>Branch</dt>
                          <dd>{booking.branch.name}</dd>
                        </>
                      )}
                      {booking.scheduledAt && (
                        <>
                          <dt>Appointment</dt>
                          <dd>{formatBusinessDate(booking.scheduledAt)}</dd>
                        </>
                      )}
                    </dl>
                    {booking.vehicle && (
                      <p>
                        Vehicle: {booking.vehicle.year} {booking.vehicle.make}{" "}
                        {booking.vehicle.model}
                        {booking.vehicle.registrationNumber
                          ? ` · ${booking.vehicle.registrationNumber}`
                          : ""}
                      </p>
                    )}
                    {booking.customerNotes && <p>Your notes: {booking.customerNotes}</p>}
                    {booking.depositAmountKobo !== null &&
                      BigInt(booking.depositAmountKobo) > BigInt(0) && (
                        <p>Deposit due: {formatKobo(booking.depositAmountKobo)}</p>
                      )}
                    {booking.paymentHoldExpiresAt && (
                      <p>
                        Payment hold expires:{" "}
                        {formatBusinessDate(booking.paymentHoldExpiresAt)}
                      </p>
                    )}
                    <Link className="button" href={`/dashboard/bookings/${booking.id}`}>
                      View booking
                      <ArrowRight size={17} aria-hidden="true" />
                    </Link>
                  </div>
                ) : (
                  <form
                    className="sd-booking-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (review) void book();
                      else reviewBooking();
                    }}
                    aria-busy={busy}
                  >
                    {review && (
                      <section
                        className="sd-booking-review"
                        aria-label="Booking request review"
                      >
                        <p className="sd-muted">
                          Check these details before sending your request. All appointment
                          times are in Lagos time (UTC+1).
                        </p>
                        <dl>
                          <div>
                            <dt>Service</dt>
                            <dd>{review.serviceName}</dd>
                          </div>
                          <div>
                            <dt>Branch</dt>
                            <dd>{review.branchName}</dd>
                          </div>
                          <div>
                            <dt>Appointment</dt>
                            <dd>{formatBusinessDate(review.startsAt)}</dd>
                          </div>
                          <div>
                            <dt>Vehicle</dt>
                            <dd>{review.vehicleName}</dd>
                          </div>
                          <div>
                            <dt>Service price</dt>
                            <dd>{formatKobo(review.priceKobo)}</dd>
                          </div>
                          <div>
                            <dt>Your notes</dt>
                            <dd>{review.body.customerNotes || "No additional notes"}</dd>
                          </div>
                        </dl>
                        <div className="sd-terms">
                          {review.terms.depositBasisPoints === 0 && (
                            <p>No deposit is required to send your booking request.</p>
                          )}
                          {review.terms.depositBasisPoints > 0 && (
                            <p>
                              You accepted the published{" "}
                              {review.terms.depositBasisPoints / 100}% deposit terms shown
                              in the details step.
                            </p>
                          )}
                          <p>
                            The workshop reviews your request before confirming an
                            appointment. Your request uses the contact details in your
                            customer account.
                          </p>
                        </div>
                        {reviewChanged && !uncertain && (
                          <p role="alert" className="field-error">
                            The appointment or booking terms have changed. Edit your
                            details and review the latest information before sending.
                          </p>
                        )}
                      </section>
                    )}
                    <div className="sd-booking-details" hidden={!!review}>
                      <p className="sd-muted">
                        All appointment times are shown in Lagos time (UTC+1).
                      </p>
                      <div className="field">
                        <label htmlFor="booking-branch">Workshop branch</label>
                        <ServiceChoice
                          id="booking-branch"
                          label="Branches"
                          items={(branches.data?.items ?? []).map((item) => ({
                            id: item.id,
                            label: item.name,
                          }))}
                          value={branch ? { id: branch, label: branchName } : undefined}
                          onChange={(item) => {
                            setBranch(item.id);
                            setBranchName(item.label);
                            setSlot("");
                            setSlotCursor(undefined);
                            setAccepted(false);
                          }}
                          disabled={locked}
                          loading={branches.loading}
                          loadError={branches.error}
                          onRetry={branches.refresh}
                        >
                          {(branchPages.page > 1 || branches.data?.nextCursor) && (
                            <CursorPagination
                              pagination={branchPages}
                              nextCursor={branches.data?.nextCursor}
                              disabled={locked || branches.loading}
                              label="Branches"
                            />
                          )}
                        </ServiceChoice>
                      </div>
                      <fieldset className="sd-appointments" disabled={locked}>
                        <legend>Available appointments</legend>
                        {!branch ? (
                          <p className="sd-empty">
                            <CalendarDays size={22} aria-hidden="true" />
                            Choose a workshop branch to see available times.
                          </p>
                        ) : slots.loading ? (
                          <p className="sd-empty" role="status">
                            Loading available appointments…
                          </p>
                        ) : slots.error ? (
                          <div className="sd-recovery">
                            <Feedback message={slots.error} />
                            <button
                              className="button secondary"
                              type="button"
                              onClick={slots.refresh}
                            >
                              Retry appointments
                            </button>
                          </div>
                        ) : (
                          <>
                            {slots.data?.items.length ? (
                              <div className="sd-slots">
                                {slots.data.items
                                  .filter(
                                    (item) =>
                                      item.branchId === branch &&
                                      item.serviceId === serviceId,
                                  )
                                  .map((item) => (
                                    <button
                                      key={item.id}
                                      type="button"
                                      className="slot"
                                      aria-pressed={slot === item.id}
                                      onClick={() => {
                                        setSlot(item.id);
                                        setAccepted(false);
                                      }}
                                    >
                                      <span>
                                        {new Intl.DateTimeFormat("en-GB", {
                                          timeZone: "Africa/Lagos",
                                          weekday: "short",
                                          day: "numeric",
                                          month: "short",
                                          year: "numeric",
                                        }).format(new Date(item.startsAt))}
                                      </span>
                                      <strong>
                                        {new Intl.DateTimeFormat("en-GB", {
                                          timeZone: "Africa/Lagos",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                          hour12: false,
                                        }).format(new Date(item.startsAt))}{" "}
                                        –{" "}
                                        {new Intl.DateTimeFormat("en-GB", {
                                          timeZone: "Africa/Lagos",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                          hour12: false,
                                        }).format(new Date(item.endsAt))}
                                      </strong>
                                    </button>
                                  ))}
                              </div>
                            ) : (
                              <p className="sd-empty">
                                No appointments are available on this page. Try another
                                branch or contact our team.
                              </p>
                            )}
                            {(slotCursor || slots.data?.nextCursor) && (
                              <nav className="sd-actions" aria-label="Appointment pages">
                                {slotCursor && (
                                  <button
                                    type="button"
                                    className="button secondary"
                                    onClick={() => {
                                      setSlotCursor(undefined);
                                      setSlot("");
                                    }}
                                  >
                                    First appointments
                                  </button>
                                )}
                                {slots.data?.nextCursor && (
                                  <button
                                    type="button"
                                    className="button secondary"
                                    onClick={() => {
                                      setSlotCursor(slots.data?.nextCursor);
                                      setSlot("");
                                    }}
                                  >
                                    More appointments
                                  </button>
                                )}
                              </nav>
                            )}
                          </>
                        )}
                      </fieldset>
                      <BookingAccountDetails
                        serviceId={serviceId}
                        vehicle={vehicle}
                        onVehicleChange={setVehicle}
                        disabled={locked}
                      />
                      <div className="field">
                        <label htmlFor="booking-notes">
                          What should we know about your vehicle? (optional)
                        </label>
                        <textarea
                          id="booking-notes"
                          name="customerNotes"
                          rows={3}
                          maxLength={2000}
                          value={notes}
                          disabled={locked}
                          onChange={(event) => {
                            setNotes(event.target.value);
                            setNotesError(undefined);
                          }}
                          aria-invalid={!!notesError}
                          aria-describedby={`booking-notes-help${notesError ? " booking-notes-error" : ""}`}
                        />
                        <div id="booking-notes-help" className="sd-field-help">
                          <span>Describe the vehicle, symptoms or any concerns.</span>
                          <span>{notes.length.toLocaleString()} / 2,000</span>
                        </div>
                        {notesError && (
                          <p id="booking-notes-error" className="field-error">
                            {notesError}
                          </p>
                        )}
                      </div>
                      {policy.loading ? (
                        <p role="status">Loading booking terms…</p>
                      ) : policy.error ? (
                        <div className="sd-recovery">
                          <Feedback message={policy.error} />
                          <button
                            type="button"
                            className="button secondary"
                            onClick={policy.refresh}
                            disabled={busy}
                          >
                            Retry booking terms
                          </button>
                        </div>
                      ) : (
                        policy.data && (
                          <div className="sd-terms">
                            <h3>Before you request</h3>
                            <p>
                              Appointments can be requested{" "}
                              {policy.data.minimumAdvanceHours / 24}–
                              {policy.data.maximumAdvanceHours / 24} days in advance. The
                              workshop reviews each request before confirming it.
                            </p>
                            {!requiresDeposit ? (
                              <p>No deposit is required to send your booking request.</p>
                            ) : (
                              <>
                                <p>
                                  The published policy requires a{" "}
                                  {policy.data.depositBasisPoints / 100}% deposit.{" "}
                                  {policy.data.depositRefundableForCustomerCancellation
                                    ? "The deposit is refundable for customer cancellation under the published policy."
                                    : "The deposit is non-refundable for customer cancellation."}{" "}
                                  The payment hold lasts {policy.data.paymentHoldMinutes}{" "}
                                  minutes.
                                </p>
                                <label className="sd-consent">
                                  <input
                                    type="checkbox"
                                    checked={accepted}
                                    disabled={locked}
                                    onChange={(event) =>
                                      setAccepted(event.target.checked)
                                    }
                                  />
                                  <span>I have read and accept these deposit terms.</span>
                                </label>
                              </>
                            )}
                            <p>
                              Customer rescheduling: up to{" "}
                              {policy.data.customerRescheduleLimit} change
                              {policy.data.customerRescheduleLimit === 1 ? "" : "s"}, at
                              least {policy.data.customerRescheduleCutoffHours} hours
                              before the appointment.
                            </p>
                          </div>
                        )
                      )}
                    </div>
                    {error && (
                      <div className="sd-error" role="alert">
                        <h3 ref={errorHeading} tabIndex={-1}>
                          {uncertain
                            ? "Your request needs checking"
                            : "We couldn’t send your request"}
                        </h3>
                        <p>{error}</p>
                        {login && (
                          <Link
                            className="text-link"
                            href={`/login?next=${encodeURIComponent(`/services/${serviceId}`)}`}
                          >
                            Sign in to your account
                          </Link>
                        )}
                        {uncertain && (
                          <p>
                            The request may have reached us. Review your bookings or check
                            the same request below. Your original details will be reused
                            to avoid a duplicate.
                          </p>
                        )}
                      </div>
                    )}
                    <div className="sd-submit">
                      {review && (
                        <button
                          type="button"
                          className="button secondary"
                          disabled={locked}
                          onClick={editDetails}
                        >
                          Edit details
                        </button>
                      )}
                      {review && access === "anonymous" ? (
                        <Link
                          className="button"
                          href={`/login?next=${encodeURIComponent(`/services/${serviceId}`)}`}
                        >
                          Sign in to request booking
                          <ArrowRight size={17} aria-hidden="true" />
                        </Link>
                      ) : (
                        <button
                          type="submit"
                          className="button"
                          disabled={
                            busy ||
                            !!service.error ||
                            (!uncertain &&
                              (reviewChanged ||
                                !selectedSlot ||
                                !policy.data ||
                                !!policy.error ||
                                slots.loading ||
                                !!slots.error ||
                                (requiresDeposit && !accepted)))
                          }
                        >
                          {busy
                            ? "Sending request…"
                            : uncertain
                              ? "Check the same booking request"
                              : review
                                ? "Request booking"
                                : "Review booking request"}
                          <ArrowRight size={17} aria-hidden="true" />
                        </button>
                      )}
                      <Link className="text-link" href="/dashboard/bookings">
                        View my bookings
                      </Link>
                    </div>
                    <p className="sd-small">
                      A customer account is needed to request an appointment.
                    </p>
                  </form>
                )}
              </div>
            </div>
          </section>
        )}
        {current && (
          <>
            <section className="sd-care" aria-labelledby="sd-care-title">
              <div className="sd-container sd-care-layout">
                <figure className="about-hero-figure">
                  <div className="about-hero-photo">
                    <Image
                      src="/images/allied-autotech/technician-original.webp"
                      alt="Allied AutoTech technician in the original company campaign photograph"
                      fill
                      sizes="(max-width: 760px) calc(100vw - 40px), (max-width: 1023px) 36vw, 380px"
                      preload
                    />
                  </div>
                  <figcaption>From the Allied AutoTech workshop wall.</figcaption>
                </figure>
                <div>
                  <h2 id="sd-care-title">Clear advice. Careful workmanship.</h2>
                  <p>
                    We explain the issue, discuss the next steps and prioritise quality
                    workmanship.
                  </p>
                  <dl className="sd-care-principles">
                    <div>
                      <dt>Understand the concern</dt>
                      <dd>We listen and clarify the issue with you.</dd>
                    </div>
                    <div>
                      <dt>Discuss the work</dt>
                      <dd>
                        We explain the findings and talk through recommended next steps.
                      </dd>
                    </div>
                    <div>
                      <dt>Keep you informed</dt>
                      <dd>Clear communication before and after the work.</dd>
                    </div>
                  </dl>
                  <Link className="sd-editorial-link" href="/about">
                    Our workshop principles <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </section>
            <section
              className="sd-questions"
              id="service-questions"
              aria-labelledby="sd-questions-title"
            >
              <div className="sd-container sd-questions-layout">
                <div>
                  <h2 id="sd-questions-title">Before your visit</h2>
                  <p>Details to help you plan the next step.</p>
                </div>
                <div>
                  <details>
                    <summary>
                      What does this service include?
                      <ChevronDown size={18} aria-hidden="true" />
                    </summary>
                    <p>
                      Check the published description and ask our team to confirm the work
                      your vehicle needs.
                    </p>
                    <Link className="sd-editorial-link" href="/contact">
                      Discuss this service <ArrowRight size={17} aria-hidden="true" />
                    </Link>
                  </details>
                  <details>
                    <summary>
                      What happens after I send a request?
                      <ChevronDown size={18} aria-hidden="true" />
                    </summary>
                    <p>
                      {fixed
                        ? "A booking request is waiting for workshop review. Check your account for the confirmed appointment and updates."
                        : "Our team reviews your service enquiry and discusses the next steps with you. Sending an enquiry does not confirm a quotation or appointment."}
                    </p>
                  </details>
                  <details>
                    <summary>
                      Does the listed duration confirm my collection time?
                      <ChevronDown size={18} aria-hidden="true" />
                    </summary>
                    <p>
                      The listed duration describes the service. Confirm collection
                      arrangements with the workshop.
                    </p>
                  </details>
                </div>
              </div>
            </section>
            {relatedServices}
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
