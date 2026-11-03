"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiRequest, ApiError } from "@/lib/api/client";
import { parseStaffBooking } from "@/lib/api/staff-booking-schemas";
import { parseWorkforceBookingDetail } from "@/lib/admin/workforce-bookings";
import { parseWorkforceAccess, type WorkforceAccess } from "@/lib/api/workforce-schemas";
import { sameWorkforceScope } from "@/lib/admin/workforce-overview";
import { workforceAllows, workforceActionPredicates } from "@/lib/workforce-registry";
import {
  timingOverrideSchema,
  parseTimingReceipt,
  type TimingBooking,
  type TimingOverride,
} from "@/lib/api/booking-timing-schemas";
import {
  readWorkforceBookingPending as read,
  markWorkforceBookingPending as mark,
  clearWorkforceBookingPending as clear,
  type WorkforceBookingPending,
} from "@/lib/admin/workforce-booking-pending";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { Feedback } from "./feedback";
import { formatBusinessDate } from "@/lib/format/date";
const noSend = () => {
  const error = new ApiError(409, { error: { code: "CONFLICT" } });
  error.message =
    "No estimate was sent. Refresh the booking and responsibilities before reviewing again.";
  return error;
};
export function BookingTimingReview({
  booking,
  owner,
  canReview,
  disabled,
  access,
  onSaved,
}: {
  booking: TimingBooking;
  owner: string;
  canReview?: boolean;
  disabled?: boolean;
  access?: WorkforceAccess;
  onSaved: (version?: number) => void;
}) {
  const [clock, setClock] = useState<number | null>(null);
  const [ready, setReady] = useState(false),
    [pending, setPending] = useState<WorkforceBookingPending>(),
    [saving, setSaving] = useState(false),
    [proposal, setProposal] = useState<MutationProposal | null>(null),
    [error, setError] = useState<string>(),
    [inspection, setInspection] = useState<TimingBooking>(),
    [checking, setChecking] = useState(false),
    [ack, setAck] = useState(false);
  const savedVersion = useRef<number | undefined>(undefined);
  const alive = useRef(true),
    controller = useRef<AbortController | null>(null);
  useEffect(() => {
    alive.current = true;
    queueMicrotask(() => {
      if (alive.current) {
        setPending(read(owner, "timing"));
        setReady(true);
      }
    });
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, [owner]);
  useEffect(() => {
    let active = true;
    const update = () => {
      if (active && document.visibilityState === "visible") setClock(Date.now());
    };
    queueMicrotask(update);
    const timer = window.setInterval(update, 30_000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [booking.scheduledAt]);
  const path = access
    ? `/staff/workforce/bookings/${booking.id}`
    : `/staff/bookings/${booking.id}`;
  async function current() {
    const abort = new AbortController();
    controller.current = abort;
    const [record, own] = await Promise.all([
      apiRequest(path, { signal: abort.signal }),
      access
        ? apiRequest("/staff/workforce/access", { signal: abort.signal })
        : Promise.resolve(null),
    ]);
    let row: TimingBooking;
    if (access) {
      const next = parseWorkforceBookingDetail(record.data, booking.id),
        latest = parseWorkforceAccess(own!.data);
      if (
        !sameWorkforceScope(access, latest) ||
        !sameWorkforceScope(latest, next.access) ||
        !workforceAllows(latest, workforceActionPredicates.bookingConfirm, {
          branchId: next.row.branchId,
        })
      )
        throw noSend();
      row = next.row;
    } else {
      const parsed = parseStaffBooking(record.data);
      row = { ...parsed, branchId: parsed.branch?.id ?? null };
    }
    if (!alive.current || row.id !== booking.id) throw noSend();
    return { row, signal: abort.signal };
  }
  async function save(input: TimingOverride) {
    if (!ready || pending || saving || disabled) throw noSend();
    setSaving(true);
    savedVersion.current = undefined;
    let marker: ReturnType<typeof mark> | undefined,
      sent = false;
    try {
      const latest = await current();
      if (
        latest.row.version !== booking.version ||
        latest.row.scheduleVersion !== booking.scheduleVersion ||
        latest.row.scheduledAt !== booking.scheduledAt ||
        latest.row.status !== booking.status ||
        latest.row.branchId !== booking.branchId
      )
        throw noSend();
      marker = mark(owner, booking.id, booking.version, "timing");
      setPending(marker);
      if (!alive.current || latest.signal.aborted) throw noSend();
      sent = true;
      const response = await apiRequest(`${path}/timing`, {
        method: "POST",
        csrf: true,
        body: input,
        signal: latest.signal,
      });
      const receipt = parseTimingReceipt(response.data, latest.row, owner, input);
      savedVersion.current = receipt.version;
      if (alive.current) {
        clear(owner, marker.token, "timing");
        setPending(undefined);
      }
    } catch (caught) {
      const rejected =
        caught instanceof ApiError &&
        caught.status >= 400 &&
        caught.status < 500 &&
        ![408, 429].includes(caught.status);
      if (alive.current && marker && (!sent || rejected)) {
        clear(owner, marker.token, "timing");
        setPending(undefined);
      }
      throw caught;
    } finally {
      if (alive.current) setSaving(false);
    }
  }
  async function inspect() {
    if (checking || (pending && pending !== "unknown" && pending.id !== booking.id))
      return;
    setChecking(true);
    setInspection(undefined);
    setAck(false);
    setError(undefined);
    try {
      const latest = await current();
      if (alive.current) setInspection(latest.row);
    } catch {
      if (alive.current)
        setError(
          "Current booking and access could not be checked. Refresh before continuing.",
        );
    } finally {
      if (alive.current) setChecking(false);
    }
  }
  function finish() {
    if (!inspection || !ack || !pending) return;
    try {
      clear(owner, pending === "unknown" ? undefined : pending.token, "timing");
      setPending(undefined);
      setInspection(undefined);
      onSaved();
    } catch {
      setError("The recovery reference changed. Refresh before continuing.");
    }
  }
  if (!ready) return <p role="status">Checking earlier estimate changes…</p>;
  if (pending && !saving)
    return (
      <section className="card" aria-label="Check earlier estimate change">
        <h2>Check the earlier estimate change</h2>
        <p role="alert">
          The previous outcome needs checking. Nothing will be sent again automatically.
        </p>
        <Feedback message={error} />
        {pending !== "unknown" && pending.id !== booking.id && (
          <Link
            href={
              access
                ? `/admin/workforce/bookings/${pending.id}`
                : `/admin/bookings/${pending.id}`
            }
          >
            Open the affected booking
          </Link>
        )}
        <button
          className="button secondary"
          disabled={checking || (pending !== "unknown" && pending.id !== booking.id)}
          onClick={() => void inspect()}
        >
          Check current estimate
        </button>
        {inspection && (
          <>
            <p>
              Recorded appointment: {formatBusinessDate(inspection.scheduledAt)}. Current
              schedule revision: {inspection.scheduleVersion}.
            </p>
            {inspection.timingSnapshots
              ?.filter((row) => row.scheduleVersion === inspection.scheduleVersion)
              .map((row) => (
                <p key={row.scheduleVersion}>
                  Job time:{" "}
                  {row.durationMinutes === null
                    ? "Not assessed"
                    : `${row.durationMinutes} min`}
                  ; preparation:{" "}
                  {row.preparationMinutes === null
                    ? "Not assessed"
                    : `${row.preparationMinutes} min`}
                  ; cleanup:{" "}
                  {row.cleanupMinutes === null
                    ? "Not assessed"
                    : `${row.cleanupMinutes} min`}
                  . Reason: {row.reason}
                </p>
              ))}
            <label>
              <input
                type="checkbox"
                checked={ack}
                onChange={(event) => setAck(event.target.checked)}
              />{" "}
              I have checked the current estimate and timing history.
            </label>
            <button className="button secondary" disabled={!ack} onClick={finish}>
              Clear checked estimate reference
            </button>
          </>
        )}
      </section>
    );
  const permitted = access
    ? workforceAllows(access, workforceActionPredicates.bookingConfirm, {
        branchId: booking.branchId,
      })
    : canReview;
  if (
    !permitted ||
    booking.scheduleVersion === undefined ||
    !booking.assignedStaff ||
    !booking.service ||
    !booking.scheduledAt ||
    clock === null ||
    Date.parse(booking.scheduledAt) <= clock ||
    !["REQUESTED", "AWAITING_DEPOSIT", "CONFIRMED"].includes(booking.status)
  )
    return null;
  const timing = booking.timingSnapshots?.find(
    (row) => row.scheduleVersion === booking.scheduleVersion,
  );
  function review(form: HTMLFormElement) {
    setError(undefined);
    const values = new FormData(form);
    const minutes = (key: string) => {
      const raw = values.get(key);
      return typeof raw === "string" && raw.trim() !== "" ? Number(raw) : null;
    };
    const parsed = timingOverrideSchema.safeParse({
      expectedVersion: booking.version,
      durationMinutes: minutes("durationMinutes"),
      preparationMinutes: minutes("preparationMinutes"),
      cleanupMinutes: minutes("cleanupMinutes"),
      reason: values.get("reason"),
      resourceReviewNote: values.get("resourceReviewNote"),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Review all timing fields.");
      return;
    }
    const input = parsed.data;
    setProposal({
      title: "Save this appointment estimate?",
      description:
        "The appointment start and status stay unchanged. The server rechecks the full occupied time, capacity and current permission. Existing timing history is preserved; pending reschedule requests need a fresh review.",
      facts: [
        { label: "Appointment", value: formatBusinessDate(booking.scheduledAt) },
        { label: "Estimated job time", value: `${input.durationMinutes} minutes` },
        {
          label: "Preparation before arrival",
          value: `${input.preparationMinutes} minutes`,
        },
        { label: "Cleanup after work", value: `${input.cleanupMinutes} minutes` },
        { label: "Internal decision reason", value: input.reason },
        { label: "People and equipment review", value: input.resourceReviewNote },
      ],
      retryAfterRejection: false,
      onUncertain: () => setPending(read(owner, "timing")),
      submit: () => save(input),
    });
  }
  return (
    <section className="card" aria-labelledby="booking-timing-title">
      <h2 id="booking-timing-title">Review appointment timing</h2>
      <p>
        Use an assessed job estimate and the actual preparation and cleanup time. Zero
        means none is needed; blank means unassessed. This is not a promised
        vehicle-collection time.
      </p>
      <Feedback message={error} />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          review(event.currentTarget);
        }}
      >
        <fieldset disabled={disabled || saving || !!proposal}>
          <legend>Estimate and occupied time</legend>
          {(["durationMinutes", "preparationMinutes", "cleanupMinutes"] as const).map(
            (field) => (
              <div className="field" key={field}>
                <label htmlFor={`timing-${field}`}>
                  {field === "durationMinutes"
                    ? "Estimated job time (minutes)"
                    : field === "preparationMinutes"
                      ? "Preparation before arrival (minutes)"
                      : "Cleanup after work (minutes)"}
                </label>
                <input
                  id={`timing-${field}`}
                  name={field}
                  type="number"
                  required
                  min={field === "durationMinutes" ? 15 : 0}
                  max={1440}
                  step={1}
                  defaultValue={
                    timing
                      ? (timing[field] ?? "")
                      : field === "durationMinutes"
                        ? (booking.service?.durationMinutes ?? "")
                        : ""
                  }
                />
              </div>
            ),
          )}
          <div className="field">
            <label htmlFor="timing-reason">
              Reason for this appointment override (internal)
            </label>
            <textarea
              id="timing-reason"
              name="reason"
              required
              minLength={10}
              maxLength={1000}
            />
          </div>
          <div className="field">
            <label htmlFor="timing-resources">
              People and equipment review for this estimate
            </label>
            <textarea
              id="timing-resources"
              name="resourceReviewNote"
              required
              minLength={10}
              maxLength={2000}
            />
          </div>
          <button className="button" type="submit">
            Review estimate change
          </button>
        </fieldset>
      </form>
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel="Confirm estimate change"
          onClose={() => setProposal(null)}
          onSuccess={() => {
            setProposal(null);
            onSaved(savedVersion.current);
          }}
        />
      )}
    </section>
  );
}
