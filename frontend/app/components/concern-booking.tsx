"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { z } from "zod";
import {
  apiRequest,
  ApiError,
  newIdempotencyKey,
  SESSION_CHANGED,
} from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import { useResource } from "@/lib/api/use-resource";
import { useAccountMutation } from "@/lib/api/use-account-mutation";
import { bookingSchema, parseBookingPolicy } from "@/lib/api/booking-schemas";
import { branchRef } from "@/lib/api/commerce-schemas";
import type { CustomerVehicle } from "@/lib/api/vehicle-schemas";
import {
  consumeConcernSignInDraft,
  saveConcernSignInDraft,
  clearBookingSignInDraft,
} from "@/lib/forms/booking-sign-in-draft";
import { formatBusinessDate } from "@/lib/format/date";
import { BookingAccountDetails } from "./booking-account-details";
import { Feedback } from "./feedback";
import { AccountChangeNotice } from "./account-change-notice";
const parseBranches = (value: unknown) =>
  z.object({ items: z.array(branchRef), nextCursor: z.string().optional() }).parse(value);
const identitySchema = z.object({
  user: z.object({
    id: z.uuid(),
    role: z.enum(["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"]),
  }),
  mfaRequired: z.boolean().optional(),
  mfaVerifiedAt: z.string().nullable().optional(),
});
type Body = RequestBody<"/customers/bookings", "post">;
type Review = {
  body: Body;
  branchName: string;
  vehicleName: string;
  owner: string | null;
  policy: string;
};
export function ConcernBooking() {
  const policy = useResource("/public/booking-policy", parseBookingPolicy);
  const [cursor, setCursor] = useState<string>();
  const branches = useResource(
    `/public/branches?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    parseBranches,
  );
  const [branch, setBranch] = useState("");
  const [branchName, setBranchName] = useState("");
  const [concern, setConcern] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [notes, setNotes] = useState("");
  const [vehicle, setVehicle] = useState<CustomerVehicle | null>(null);
  const [identity, setIdentity] = useState<z.infer<typeof identitySchema> | null>();
  const [sessionError, setSessionError] = useState(false);
  const [sessionRevision, setSessionRevision] = useState(0);
  const [review, setReview] = useState<Review>();
  const [booking, setBooking] = useState<z.infer<typeof bookingSchema>>();
  const [error, setError] = useState<string>();
  const [restored, setRestored] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const attempt = useRef<{ body: Body; key: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const reset = useCallback(() => {
    setBranch("");
    setBranchName("");
    setConcern("");
    setPreferredTime("");
    setNotes("");
    setVehicle(null);
    setReview(undefined);
    setBooking(undefined);
    setError(undefined);
    setUncertain(false);
    setRestored(false);
    attempt.current = null;
  }, []);
  const operation = useAccountMutation(reset);
  useEffect(() => {
    let controller: AbortController | undefined;
    async function check() {
      controller?.abort();
      const next = new AbortController();
      controller = next;
      setIdentity(undefined);
      setSessionError(false);
      try {
        const value = identitySchema.parse(
          (
            await apiRequest("/auth/session", {
              optionalSession: true,
              signal: next.signal,
            })
          ).data,
        );
        if (next.signal.aborted) return;
        setIdentity(value);
        if (value.user.role !== "CUSTOMER") clearBookingSignInDraft();
        else if (!value.mfaRequired || value.mfaVerifiedAt) {
          const draft = consumeConcernSignInDraft();
          if (draft) {
            setBranch(draft.branchId);
            setBranchName(draft.branchName);
            setConcern(draft.customerConcern);
            setPreferredTime(draft.preferredTime);
            setNotes(draft.notes);
            setRestored(true);
          }
        }
      } catch (failure) {
        if (next.signal.aborted) return;
        if (failure instanceof ApiError && failure.status === 401) setIdentity(null);
        else setSessionError(true);
      }
    }
    void check();
    window.addEventListener(SESSION_CHANGED, check);
    return () => {
      controller?.abort();
      window.removeEventListener(SESSION_CHANGED, check);
    };
  }, [sessionRevision]);
  useEffect(() => {
    if (review || booking) {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: "center", behavior: "instant" });
    }
  }, [review, booking]);
  const customer =
    identity?.user.role === "CUSTOMER" &&
    (!identity.mfaRequired || !!identity.mfaVerifiedAt);
  const unavailable =
    !policy.data ||
    !!policy.error ||
    !!policy.refreshError ||
    policy.loading ||
    policy.refreshing;
  const changed = !!review && review.policy !== JSON.stringify(policy.data);
  function preserve(event: MouseEvent<HTMLAnchorElement>) {
    if (
      !saveConcernSignInDraft({
        branchId: branch,
        branchName,
        customerConcern: concern,
        preferredTime,
        notes,
      })
    ) {
      event.preventDefault();
      setError(
        "This browser could not keep your draft. Copy your details before signing in.",
      );
    }
  }
  function prepare() {
    if (
      operation.busy ||
      uncertain ||
      unavailable ||
      !policy.data ||
      identity === undefined
    )
      return;
    setError(undefined);
    const date = new Date(`${preferredTime}:00+01:00`);
    const hours = (date.getTime() - Date.now()) / 3600000;
    if (
      !branch ||
      !branchName ||
      concern.trim().length < 10 ||
      concern.length > 2000 ||
      notes.length > 2000 ||
      !Number.isFinite(hours)
    ) {
      setError(
        "Choose a workshop, describe the concern in at least 10 characters, and enter a preferred time.",
      );
      return;
    }
    if (
      hours < policy.data.minimumAdvanceHours ||
      hours > policy.data.maximumAdvanceHours
    ) {
      setError(
        `Choose a preferred time between ${policy.data.minimumAdvanceHours / 24} and ${policy.data.maximumAdvanceHours / 24} days from now.`,
      );
      return;
    }
    const body: Body = {
      branchId: branch,
      customerConcern: concern.trim(),
      preferredAt: date.toISOString(),
      customerNotes: notes.trim() || null,
      policyVersion: policy.data.version,
      ...(vehicle ? { vehicleId: vehicle.id } : {}),
    };
    attempt.current = null;
    setReview({
      body,
      branchName,
      vehicleName: vehicle
        ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
        : "Described in your notes / to be confirmed",
      owner: customer ? identity!.user.id : null,
      policy: JSON.stringify(policy.data),
    });
  }
  async function submit() {
    if (
      !review ||
      !customer ||
      operation.busy ||
      booking ||
      (!uncertain && (unavailable || changed))
    )
      return;
    const controller = operation.begin();
    if (!controller) return;
    setError(undefined);
    let sent = false;
    try {
      const checked = identitySchema.parse(
        (
          await apiRequest("/auth/session", {
            optionalSession: true,
            signal: controller.signal,
          })
        ).data,
      );
      if (controller.signal.aborted) return;
      if (
        checked.user.role !== "CUSTOMER" ||
        checked.user.id !== review.owner ||
        (checked.mfaRequired && !checked.mfaVerifiedAt)
      ) {
        reset();
        setError(
          "Your account changed. Review the request again from your customer account.",
        );
        return;
      }
      attempt.current ??= { body: review.body, key: newIdempotencyKey() };
      sent = true;
      const result = await apiRequest("/customers/bookings", {
        method: "POST",
        csrf: true,
        signal: controller.signal,
        idempotencyKey: attempt.current.key,
        body: attempt.current.body,
      });
      if (controller.signal.aborted) return;
      const saved = z.object({ booking: bookingSchema }).parse(result.data).booking;
      if (saved.customerConcern !== review.body.customerConcern)
        throw Error("Unexpected booking concern");
      setBooking(saved);
      setUncertain(false);
      clearBookingSignInDraft();
    } catch (failure) {
      if (controller.signal.aborted) return;
      if (sent)
        setUncertain(
          !(failure instanceof ApiError && failure.status >= 400 && failure.status < 500),
        );
      setError(
        failure instanceof ApiError
          ? failure.message
          : "We could not confirm the result. Check your bookings or retry this same request before starting another.",
      );
    } finally {
      operation.finish(controller);
    }
  }
  return (
    <section className="concern-form" aria-label="Concern booking request">
      <AccountChangeNotice visible={operation.sessionChanged} />
      <Feedback message={error} scrollToMessage />
      {restored && !booking && (
        <p role="status">Your draft is restored. Review it again before submitting.</p>
      )}
      {booking ? (
        <>
          <h2 ref={heading} tabIndex={-1}>
            Your request is saved
          </h2>
          <p>
            The workshop will review your concern. Your preferred time is not a confirmed
            appointment.
          </p>
          <dl>
            <dt>Booking reference</dt>
            <dd>{booking.id}</dd>
            <dt>Concern</dt>
            <dd>{booking.customerConcern}</dd>
          </dl>
          <Link className="button" href={`/dashboard/bookings/${booking.id}`}>
            View your booking
          </Link>
        </>
      ) : (
        <>
          {unavailable && (
            <div>
              <p role="status">
                We need the current booking rules before you can review a request.
              </p>
              <button type="button" className="button secondary" onClick={policy.refresh}>
                Retry booking rules
              </button>
            </div>
          )}
          {identity === undefined && !sessionError && (
            <p role="status">Checking your account before you enter a request…</p>
          )}
          {sessionError && (
            <div>
              <p role="alert">We could not check your account.</p>
              <button
                type="button"
                className="button secondary"
                onClick={() => setSessionRevision((n) => n + 1)}
              >
                Retry account check
              </button>
            </div>
          )}
          {review ? (
            <>
              <h2 ref={heading} tabIndex={-1}>
                Review your request
              </h2>
              <dl>
                <dt>Concern</dt>
                <dd>{review.body.customerConcern}</dd>
                <dt>Workshop</dt>
                <dd>{review.branchName}</dd>
                <dt>Preferred time (Lagos)</dt>
                <dd>{formatBusinessDate(review.body.preferredAt!)}</dd>
                <dt>Vehicle</dt>
                <dd>{review.vehicleName}</dd>
                <dt>Notes</dt>
                <dd>{review.body.customerNotes || "None"}</dd>
                <dt>Price</dt>
                <dd>
                  Not agreed yet. The team must review the concern and any quotation. No
                  booking deposit is required.
                </dd>
              </dl>
              <p>
                Your account contact details are used for this request. Submission does
                not reserve capacity or confirm a visit.
              </p>
              {changed && !uncertain && (
                <p role="alert">
                  The booking rules changed. Edit and review your request again.
                </p>
              )}
              <div className="concern-actions">
                <button
                  type="button"
                  className="button secondary"
                  disabled={operation.busy || uncertain}
                  onClick={() => {
                    setReview(undefined);
                    setError(undefined);
                  }}
                >
                  Edit details
                </button>
                {customer && (
                  <button
                    type="button"
                    className="button"
                    disabled={operation.busy || (!uncertain && (unavailable || changed))}
                    onClick={() => void submit()}
                  >
                    {operation.busy
                      ? "Sending request…"
                      : uncertain
                        ? "Retry the same request"
                        : "Request a workshop visit"}
                  </button>
                )}
                {identity === null && (
                  <Link
                    className="button"
                    href="/login?next=%2Fservices%2Frequest"
                    onClick={preserve}
                  >
                    Sign in to send your request
                  </Link>
                )}
                {identity && identity.user.role !== "CUSTOMER" && (
                  <p>Use a customer account to send a booking request.</p>
                )}
                {identity?.user.role === "CUSTOMER" &&
                  identity.mfaRequired &&
                  !identity.mfaVerifiedAt && (
                    <Link className="button" href="/mfa" onClick={preserve}>
                      Complete your security check
                    </Link>
                  )}
                {uncertain && (
                  <Link className="button secondary" href="/dashboard/bookings">
                    Check your bookings
                  </Link>
                )}
              </div>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                prepare();
              }}
            >
              <h2 ref={heading} tabIndex={-1}>
                Describe your concern
              </h2>
              <fieldset disabled={operation.busy || identity === undefined}>
                <label htmlFor="concern-text">
                  What have you noticed?
                  <textarea
                    id="concern-text"
                    rows={4}
                    required
                    minLength={10}
                    maxLength={2000}
                    value={concern}
                    onChange={(e) => setConcern(e.target.value)}
                  />
                </label>
                <label htmlFor="concern-branch">
                  Workshop
                  <select
                    id="concern-branch"
                    required
                    value={branch}
                    onChange={(e) => {
                      setBranch(e.target.value);
                      setBranchName(
                        branches.data?.items.find((item) => item.id === e.target.value)
                          ?.name ?? "",
                      );
                    }}
                  >
                    <option value="">Choose a workshop</option>
                    {branch &&
                      !branches.data?.items.some((item) => item.id === branch) && (
                        <option value={branch}>{branchName}</option>
                      )}
                    {branches.data?.items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                {branches.error && (
                  <>
                    <Feedback message={branches.error} />
                    <button
                      type="button"
                      className="button secondary"
                      onClick={branches.refresh}
                    >
                      Retry workshops
                    </button>
                  </>
                )}
                {branches.data?.nextCursor && (
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setCursor(branches.data?.nextCursor)}
                  >
                    More workshops
                  </button>
                )}
                {cursor && (
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setCursor(undefined)}
                  >
                    First workshops
                  </button>
                )}
                <label htmlFor="concern-time">
                  Preferred date and time (Lagos)
                  <input
                    id="concern-time"
                    type="datetime-local"
                    required
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                  />
                </label>
                {policy.data && (
                  <p>
                    Request a time {policy.data.minimumAdvanceHours / 24}–
                    {policy.data.maximumAdvanceHours / 24} days ahead. The workshop must
                    confirm availability.
                  </p>
                )}
                <BookingAccountDetails
                  serviceId="request"
                  vehicle={vehicle}
                  onVehicleChange={setVehicle}
                  disabled={operation.busy}
                  onSignIn={preserve}
                />
                <label htmlFor="concern-notes">
                  Vehicle details and other notes (optional)
                  <textarea
                    id="concern-notes"
                    rows={3}
                    maxLength={2000}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
              </fieldset>
              <div className="concern-actions">
                <button
                  className="button"
                  disabled={operation.busy || unavailable || identity === undefined}
                >
                  {identity === undefined ? "Checking your account…" : "Review request"}
                </button>
                <Link className="button secondary" href="/contact#enquiry">
                  Ask the workshop instead
                </Link>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
}
