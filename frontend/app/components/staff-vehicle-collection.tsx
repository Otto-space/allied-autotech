"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import type { StaffBooking } from "@/lib/api/staff-booking-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import type { MutationProposal } from "./mutation-review";
import { Feedback } from "./feedback";
import styles from "./staff-vehicle-collection.module.css";

const readinessSchema = z
  .object({
    bookingId: z.uuid(),
    bookingVersion: z.number().int().nonnegative(),
    financialReviewHash: z.string().regex(/^[a-f0-9]{64}$/),
    ready: z.literal(true),
    checkedAt: z.iso.datetime({ offset: true }),
  })
  .strict();
const receiptSchema = z
  .object({
    id: z.uuid(),
    bookingId: z.uuid(),
    releasedAt: z.iso.datetime({ offset: true }),
    recipientName: z.string().min(1).max(120),
  })
  .strict();
const formSchema = z.object({
  recipientName: z
    .string()
    .trim()
    .min(1, "Enter the actual collector's name.")
    .max(120)
    .refine((v) => !/[\u0000-\u001f\u007f]/.test(v), "Use a single paragraph."),
  verificationNote: z
    .string()
    .trim()
    .min(12, "Describe the actual identity and collection-authority check.")
    .max(1000)
    .refine(
      (v) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v),
      "Remove control characters.",
    ),
  identityAndAuthorityVerified: z
    .boolean()
    .refine((v) => v, "Verify the collector's identity and authority first."),
});

export function StaffVehicleCollection({
  booking,
  canRelease,
  disabled,
  onReview,
  onRefresh,
}: {
  booking: StaffBooking;
  canRelease: boolean;
  disabled: boolean;
  onReview: (proposal: MutationProposal) => void;
  onRefresh: () => void;
}) {
  const [review, setReview] = useState<z.infer<typeof readinessSchema>>();
  const [checking, setChecking] = useState(false),
    [error, setError] = useState<string>(),
    [uncertain, setUncertain] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  const pending = useRef<AbortController | null>(null),
    heading = useRef<HTMLHeadingElement>(null),
    reviewButton = useRef<HTMLButtonElement>(null),
    recipient = useRef<HTMLInputElement>(null);
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    if ((!confirmed && !uncertain) || !booking.vehicleRelease?.id) return;
    const frame = requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [confirmed, uncertain, booking.vehicleRelease?.id]);
  useEffect(() => {
    if (!review) return;
    const frame = requestAnimationFrame(() => {
      recipient.current?.focus({ preventScroll: true });
      recipient.current?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [review]);
  const current =
    review?.bookingId === booking.id && review.bookingVersion === booking.version;
  async function check() {
    if (disabled || checking || !canRelease || booking.vehicleRelease) return;
    const controller = new AbortController();
    pending.current = controller;
    setChecking(true);
    setError(undefined);
    setReview(undefined);
    try {
      const response = await apiRequest(
        `/staff/bookings/${booking.id}/vehicle-release-readiness`,
        { signal: controller.signal },
      );
      const parsed = readinessSchema.safeParse(response.data);
      if (!parsed.success)
        throw Error(
          "Collection readiness could not be verified. Refresh this booking and try again.",
        );
      const result = parsed.data;
      if (result.bookingId !== booking.id || result.bookingVersion !== booking.version)
        throw Error("The booking changed. Refresh it and review again.");
      controller.signal.throwIfAborted();
      setReview(result);
      setUncertain(false);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(
          e instanceof Error ? e.message : "Collection readiness could not be checked.",
        );
    } finally {
      if (pending.current === controller) pending.current = null;
      if (!controller.signal.aborted) setChecking(false);
    }
  }
  function submit(form: FormData) {
    if (disabled || !canRelease || !current || !review || uncertain || confirmed) return;
    const values = formSchema.safeParse({
      recipientName: form.get("recipientName"),
      verificationNote: form.get("verificationNote"),
      identityAndAuthorityVerified: form.get("identityAndAuthorityVerified") === "on",
    });
    if (!values.success) {
      setError(values.error.issues[0].message);
      const field = document.getElementById(
        `collection-${String(values.error.issues[0].path[0])}`,
      );
      field?.focus();
      field?.scrollIntoView({ block: "nearest" });
      return;
    }
    setError(undefined);
    const body = {
      ...values.data,
      identityAndAuthorityVerified: true as const,
      expectedBookingVersion: booking.version,
      financialReviewHash: review.financialReviewHash,
      idempotencyKey: crypto.randomUUID(),
    };
    onReview({
      title: "Record this vehicle collection?",
      description:
        "Confirm at handover after checking the collector's identity and authority. The server rechecks completion and every agreed invoice balance before recording collection. This does not create a charge. If the result is uncertain, check the booking record before handing over or submitting again.",
      facts: [
        { label: "Collector", value: body.recipientName },
        {
          label: "Identity and authority review (internal)",
          value: body.verificationNote,
        },
        {
          label: "Balance review",
          value: `Cleared at ${formatBusinessDate(review.checkedAt)}; checked again on confirmation.`,
        },
      ],
      retryAfterRejection: false,
      onUncertain: () => {
        setUncertain(true);
        setReview(undefined);
      },
      onConfirmed: () => setConfirmed(true),
      submit: async () => {
        const controller = new AbortController();
        pending.current = controller;
        try {
          const response = await apiRequest(
            `/staff/bookings/${booking.id}/vehicle-release`,
            { method: "POST", csrf: true, body, signal: controller.signal },
          );
          const result = receiptSchema.parse(response.data);
          if (
            result.bookingId !== booking.id ||
            result.recipientName !== body.recipientName
          )
            throw Error("Collection result did not match this review");
          controller.signal.throwIfAborted();
        } finally {
          if (pending.current === controller) pending.current = null;
        }
      },
    });
  }
  if (!canRelease && !booking.vehicleRelease) return null;
  if (booking.vehicleRelease)
    return (
      <section className="detail-section" aria-label="Vehicle collection">
        <h2 ref={heading} tabIndex={-1}>
          Vehicle collection recorded
        </h2>
        <p>{formatBusinessDate(booking.vehicleRelease.releasedAt)}</p>
        <p>Work completion, payment and collection remain separate records.</p>
      </section>
    );
  if (booking.status !== "COMPLETED" || booking.workOrder?.status !== "COMPLETED")
    return null;
  return (
    <section className="detail-section" aria-labelledby="vehicle-collection-title">
      <h2 id="vehicle-collection-title" ref={heading}>
        Vehicle collection
      </h2>
      <p>
        Check every agreed invoice before handover. Completion alone does not confirm a
        cleared balance.
      </p>
      <Feedback message={error} scrollToMessage />
      {uncertain && (
        <p role="alert">
          The collection outcome is unconfirmed. Refresh the booking and review its
          collection record before handover. Do not repeat a physical handover.
        </p>
      )}
      <div className="actions">
        <button
          type="button"
          className="button secondary"
          disabled={disabled || checking || confirmed}
          onClick={check}
        >
          {checking ? "Checking collection readiness..." : "Check collection readiness"}
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={disabled || checking}
          onClick={onRefresh}
        >
          Refresh collection record
        </button>
      </div>
      {confirmed && !booking.vehicleRelease && (
        <p role="status">
          Collection was confirmed. Refresh the booking to review its saved record.
        </p>
      )}
      {current && review && !uncertain && !confirmed && (
        <form
          className={styles.form}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit(new FormData(e.currentTarget));
          }}
        >
          <p role="status">
            All agreed invoice balances were verified at{" "}
            {formatBusinessDate(review.checkedAt)}. Confirmation checks them again.
          </p>
          <fieldset disabled={disabled || checking}>
            <legend>Collector review</legend>
            <div className="field">
              <label htmlFor="collection-recipientName">Collector name</label>
              <input
                className="input"
                ref={recipient}
                id="collection-recipientName"
                name="recipientName"
                autoComplete="off"
                maxLength={120}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="collection-verificationNote">
                Identity and collection-authority review (internal)
              </label>
              <textarea
                id="collection-verificationNote"
                name="verificationNote"
                maxLength={1000}
                required
              />
              <p className="field-hint">
                Record the review outcome. Do not enter ID numbers, copies, passwords or
                payment credentials.
              </p>
            </div>
            <div className="field">
              <label className="check-label">
                <input
                  id="collection-identityAndAuthorityVerified"
                  name="identityAndAuthorityVerified"
                  type="checkbox"
                  required
                  onChange={(e) => {
                    if (e.target.checked)
                      reviewButton.current?.scrollIntoView({ block: "nearest" });
                  }}
                />{" "}
                I verified the identity and collection authority of this person.
              </label>
            </div>
            <button ref={reviewButton} className="button" type="submit">
              Review vehicle collection
            </button>
          </fieldset>
        </form>
      )}
    </section>
  );
}
