"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api/client";
import { parseWorkforceAccess, type WorkforceAccess } from "@/lib/api/workforce-schemas";
import { workforceAllows, workforceActionPredicates } from "@/lib/workforce-registry";
import { sameWorkforceScope } from "@/lib/admin/workforce-overview";
import {
  parseWorkforceBookingDetail,
  parseBookingConfirmationReceipt,
  bookingStatusLabels,
  type WorkforceBooking,
  type BookingConfirmationReceipt,
} from "@/lib/admin/workforce-bookings";
import {
  readWorkforceBookingPending,
  markWorkforceBookingPending,
  clearWorkforceBookingPending,
  type WorkforceBookingPending,
} from "@/lib/admin/workforce-booking-pending";
import { formatBusinessDate } from "@/lib/format/date";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";

const notSent = () => {
  const error = new ApiError(409, { error: { code: "CONFLICT" } });
  error.message =
    "No confirmation was sent. Refresh the booking and permissions, then review the current appointment.";
  return error;
};
export function WorkforceBookingConfirmation({
  row,
  access,
  onSaved,
  onRefresh,
  note,
  onNoteChange,
}: {
  row: WorkforceBooking;
  access: WorkforceAccess;
  onSaved: (receipt: BookingConfirmationReceipt) => void;
  onRefresh: () => void;
  note: string;
  onNoteChange: (note: string) => void;
}) {
  const [pending, setPending] = useState<WorkforceBookingPending>();
  const [ready, setReady] = useState(false),
    [recovering, setRecovering] = useState(false);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [error, setError] = useState<string>(),
    [inspection, setInspection] = useState<WorkforceBooking>();
  const [reviewedHistory, setReviewedHistory] = useState(false);
  const alive = useRef(true),
    noteInput = useRef<HTMLInputElement>(null),
    request = useRef<AbortController | null>(null),
    saved = useRef<BookingConfirmationReceipt | undefined>(undefined);
  useEffect(() => {
    alive.current = true;
    queueMicrotask(() => {
      if (alive.current) {
        setPending(readWorkforceBookingPending(access.userId));
        setReady(true);
      }
    });
    return () => {
      alive.current = false;
      request.current?.abort();
    };
  }, [access.userId]);
  const eligible = workforceAllows(access, workforceActionPredicates.bookingConfirm, {
    branchId: row.branchId,
  });
  async function current() {
    const controller = new AbortController();
    request.current = controller;
    const [ownResponse, recordResponse] = await Promise.all([
      apiRequest("/staff/workforce/access", { signal: controller.signal }),
      apiRequest(`/staff/workforce/bookings/${row.id}`, { signal: controller.signal }),
    ]);
    if (!alive.current) throw notSent();
    const own = parseWorkforceAccess(ownResponse.data),
      record = parseWorkforceBookingDetail(recordResponse.data, row.id);
    if (!sameWorkforceScope(access, own) || !sameWorkforceScope(own, record.access))
      throw notSent();
    return { own, row: record.row, signal: controller.signal };
  }
  function review() {
    if (
      !ready ||
      pending ||
      proposal ||
      !eligible ||
      row.status !== "REQUESTED" ||
      !row.assignedStaff ||
      !row.service?.durationMinutes
    )
      return;
    const clean = note.trim();
    if (
      clean.length < 10 ||
      clean.length > 2000 ||
      [...clean].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)
    ) {
      setError(
        "Record the people and equipment checks in 10–2,000 characters on one line.",
      );
      noteInput.current?.focus();
      return;
    }
    setError(undefined);
    const before = row,
      body = { expectedVersion: row.version, resourceReviewNote: clean };
    setProposal({
      title: "Confirm this appointment?",
      description:
        "The server checks your current scope, confirmation grant, approved branch calendar, daily capacity and staff schedule. This confirms the appointment; it does not collect payment.",
      facts: [
        {
          label: "Customer",
          value: `${row.customer.firstName} ${row.customer.lastName}`,
        },
        {
          label: "Vehicle",
          value: row.vehicle
            ? [row.vehicle.make, row.vehicle.model, row.vehicle.year]
                .filter((value) => value !== null)
                .join(" ")
            : "Not recorded",
        },
        { label: "Service", value: row.service?.name ?? "Vehicle concern" },
        { label: "Branch", value: row.branch?.name ?? "Unavailable" },
        { label: "Appointment", value: formatBusinessDate(row.scheduledAt) },
        {
          label: "Assigned staff",
          value: `${row.assignedStaff.firstName} ${row.assignedStaff.lastName}`,
        },
        { label: "People and equipment review", value: clean },
      ],
      retryAfterRejection: false,
      submit: async () => {
        let sent = false,
          marker: ReturnType<typeof markWorkforceBookingPending> | undefined;
        try {
          const latest = await current();
          if (
            !workforceAllows(latest.own, workforceActionPredicates.bookingConfirm, {
              branchId: latest.row.branchId,
            }) ||
            latest.row.status !== "REQUESTED" ||
            latest.row.version !== before.version ||
            latest.row.branchId !== before.branchId ||
            latest.row.scheduledAt !== before.scheduledAt ||
            latest.row.assignedStaff?.id !== before.assignedStaff?.id ||
            latest.row.service?.durationMinutes !== before.service?.durationMinutes
          )
            throw notSent();
          marker = markWorkforceBookingPending(access.userId, row.id, before.version);
          setPending(marker);
          if (!alive.current || latest.signal.aborted) throw notSent();
          sent = true;
          const result = await apiRequest(
            `/staff/workforce/bookings/${row.id}/confirmation`,
            { method: "POST", csrf: true, body, signal: latest.signal },
          );
          const receipt = parseBookingConfirmationReceipt(
            result.data,
            before,
            access.userId,
            clean,
          );
          if (!alive.current) return;
          clearWorkforceBookingPending(access.userId, marker.token);
          setPending(undefined);
          saved.current = receipt;
        } catch (caught) {
          if (!alive.current) throw caught;
          const rejected =
            caught instanceof ApiError &&
            caught.status >= 400 &&
            caught.status < 500 &&
            ![408, 429].includes(caught.status);
          if (!sent || rejected) {
            if (marker) {
              clearWorkforceBookingPending(access.userId, marker.token);
              setPending(undefined);
            }
            if (!sent) throw notSent();
          } else setPending(readWorkforceBookingPending(access.userId) ?? "unknown");
          throw caught;
        }
      },
      onUncertain: () =>
        setPending(readWorkforceBookingPending(access.userId) ?? "unknown"),
    });
  }
  async function inspect() {
    if (recovering || !pending || (pending !== "unknown" && pending.id !== row.id))
      return;
    setRecovering(true);
    setError(undefined);
    setInspection(undefined);
    try {
      const latest = await current();
      if (alive.current) setInspection(latest.row);
    } catch {
      if (alive.current)
        setError(
          "Current booking access could not be checked. Keep this confirmation blocked and try refreshing your permissions.",
        );
    } finally {
      if (alive.current) setRecovering(false);
    }
  }
  function acknowledge() {
    if (!pending || !inspection || !reviewedHistory || recovering) return;
    try {
      clearWorkforceBookingPending(
        access.userId,
        pending === "unknown" ? undefined : pending.token,
      );
      setPending(undefined);
      setInspection(undefined);
      setReviewedHistory(false);
      onNoteChange("");
      onRefresh();
    } catch {
      setError(
        "The local recovery state changed or could not be cleared. Refresh before continuing.",
      );
    }
  }
  return (
    <section className="card" aria-labelledby="booking-confirmation-heading">
      <h2 id="booking-confirmation-heading">Appointment confirmation</h2>
      <Feedback message={error} />
      {pending ? (
        <>
          <p role="status">
            An earlier confirmation needs checking. No automatic retry will be sent.
          </p>
          {pending !== "unknown" && pending.id !== row.id ? (
            <Link className="text-link" href={`/admin/workforce/bookings/${pending.id}`}>
              Inspect the earlier booking
            </Link>
          ) : (
            <>
              {pending === "unknown" && (
                <p>
                  The earlier booking reference is unavailable. Ask an authorised manager
                  to check the booking history; inspecting this page alone cannot identify
                  that earlier request.
                </p>
              )}
              <button
                className="button secondary"
                disabled={recovering}
                onClick={() => void inspect()}
              >
                Check current booking
              </button>
              {inspection && (
                <>
                  <p>
                    Current booking status: {bookingStatusLabels[inspection.status]}{" "}
                    (version {inspection.version}). This shows the current record and does
                    not attribute an earlier uncertain request.
                  </p>
                  <div className="check-field">
                    <label>
                      <input
                        type="checkbox"
                        checked={reviewedHistory}
                        onChange={(event) => setReviewedHistory(event.target.checked)}
                      />{" "}
                      I have reviewed the current booking and the earlier confirmation
                      history.
                    </label>
                  </div>
                  <button
                    className="button secondary"
                    onClick={acknowledge}
                    disabled={!reviewedHistory}
                  >
                    Acknowledge inspected state
                  </button>
                </>
              )}
            </>
          )}
        </>
      ) : row.status !== "REQUESTED" ? (
        <p>
          {row.status === "CONFIRMED"
            ? "This appointment is confirmed."
            : "Confirmation is unavailable for this booking status."}
        </p>
      ) : !eligible ? (
        <p>
          Confirmation requires a separately granted permission as well as access to this
          booking.
        </p>
      ) : !row.assignedStaff || !row.service?.durationMinutes ? (
        <p>
          An authorised workshop manager must record the assigned staff member and service
          duration before confirmation.
        </p>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            review();
          }}
        >
          <p>
            The server checks the approved calendar, branch capacity and staff schedule
            when you confirm.
          </p>
          <div className="field">
            <label htmlFor="workforce-booking-resource-review">
              People and equipment review
            </label>
            <input
              id="workforce-booking-resource-review"
              value={note}
              ref={noteInput}
              onChange={(event) => onNoteChange(event.target.value)}
              minLength={10}
              maxLength={2000}
              required
              disabled={!ready || !!proposal}
              aria-describedby="workforce-booking-resource-hint"
            />
            <small id="workforce-booking-resource-hint">
              Record your availability checks for the assigned staff and required
              equipment. Use one line.
            </small>
          </div>
          <button className="button" disabled={!ready || !!proposal}>
            Review appointment confirmation
          </button>
        </form>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => setProposal(null)}
          confirmLabel="Confirm appointment"
          onSuccess={() => {
            if (saved.current) onSaved(saved.current);
          }}
        />
      )}
    </section>
  );
}
