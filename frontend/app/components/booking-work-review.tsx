"use client";
import "./booking-work-review.css";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { apiRequest, ApiError } from "@/lib/api/client";
import { parseWorkforceAccess, type WorkforceAccess } from "@/lib/api/workforce-schemas";
import { sameWorkforceScope } from "@/lib/admin/workforce-overview";
import { workforceAllows, workforceActionPredicates } from "@/lib/workforce-registry";
import {
  workReviewOptionsSchema,
  workReviewInputSchema,
  parseWorkReviewReceipt,
  type WorkReviewOptions,
  type WorkReviewInput,
  type WorkReviewBooking,
} from "@/lib/api/booking-work-review-schemas";
import {
  readWorkforceBookingPending as read,
  markWorkforceBookingPending as mark,
  clearWorkforceBookingPending as clear,
  type WorkforceBookingPending,
} from "@/lib/admin/workforce-booking-pending";
import { formatBusinessDate } from "@/lib/format/date";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
const action = "work-review" as const;
function noSend() {
  const e = new ApiError(409, { error: { code: "CONFLICT" } });
  e.message =
    "No work review was sent. Refresh the booking and responsibilities before reviewing again.";
  return e;
}
const errorText = (e: unknown) =>
  e instanceof ApiError
    ? e.message
    : "The current work review could not be verified. Refresh the job and check your responsibilities before trying again.";
export function BookingWorkReview({
  booking,
  owner,
  canReview,
  disabled,
  access,
  onSaved,
}: {
  booking: WorkReviewBooking;
  owner: string;
  canReview?: boolean;
  disabled?: boolean;
  access?: WorkforceAccess;
  onSaved: (version?: number) => void;
}) {
  const title = useId(),
    prefix = useId(),
    alive = useRef(true),
    controller = useRef<AbortController | null>(null),
    savedVersion = useRef<number | undefined>(undefined);
  const [ready, setReady] = useState(false),
    [pending, setPending] = useState<WorkforceBookingPending>(),
    [checking, setChecking] = useState(false),
    [saving, setSaving] = useState(false),
    [options, setOptions] = useState<WorkReviewOptions>(),
    [inspection, setInspection] = useState<WorkReviewOptions>(),
    [ack, setAck] = useState(false),
    [error, setError] = useState<string>(),
    [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [remaining, setRemaining] = useState(""),
    [cleanup, setCleanup] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [reason, setReason] = useState("");
  useEffect(() => {
    alive.current = true;
    queueMicrotask(() => {
      if (alive.current) {
        setPending(read(owner, action));
        setReady(true);
      }
    });
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, [owner]);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!options?.canReview) return;
    const frame = requestAnimationFrame(() => {
      const input = form.current?.querySelector<HTMLInputElement>("input");
      input?.focus({ preventScroll: true });
      input?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [options]);
  const path = access
    ? "/staff/workforce/bookings/" + booking.id
    : "/staff/bookings/" + booking.id;
  const permitted = access
    ? workforceAllows(access, workforceActionPredicates.bookingConfirm, {
        branchId: booking.branchId,
      })
    : canReview;
  async function current() {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const [record, own] = await Promise.all([
      apiRequest(path + "/work-review", { signal: abort.signal }),
      access
        ? apiRequest("/staff/workforce/access", { signal: abort.signal })
        : Promise.resolve(null),
    ]);
    const row = workReviewOptionsSchema.parse(record.data);
    if (!alive.current || abort.signal.aborted || row.bookingId !== booking.id)
      throw noSend();
    if (access) {
      const latest = parseWorkforceAccess(own!.data);
      if (
        !sameWorkforceScope(access, latest) ||
        !workforceAllows(latest, workforceActionPredicates.bookingConfirm, {
          branchId: row.branchId,
        })
      )
        throw noSend();
    }
    return { row, signal: abort.signal };
  }
  function matches(row: WorkReviewOptions) {
    return (
      row.version === booking.version &&
      row.scheduleVersion === booking.scheduleVersion &&
      row.branchId === booking.branchId &&
      row.status === booking.status &&
      row.startedAt === booking.startedAt &&
      (!booking.assignedStaff || row.staffId === booking.assignedStaff.id)
    );
  }
  async function load(inspect = false) {
    if (checking || (pending && pending !== "unknown" && pending.id !== booking.id))
      return;
    setChecking(true);
    setError(undefined);
    setAck(false);
    try {
      const { row } = await current();
      if (inspect) {
        setInspection(row);
      } else {
        if (!matches(row)) throw noSend();
        setOptions(row);
        if (!options) {
          setRemaining("");
          setCleanup(row.cleanupMinutes === null ? "" : String(row.cleanupMinutes));
          setSelected(
            row.current?.resourceIds.filter((id) =>
              row.resources.some((r) => r.id === id && r.status === "AVAILABLE"),
            ) ?? [],
          );
        } else
          setSelected((ids) =>
            ids.filter((id) =>
              row.resources.some((r) => r.id === id && r.status === "AVAILABLE"),
            ),
          );
      }
    } catch (e) {
      if (alive.current) setError(errorText(e));
    } finally {
      if (alive.current) setChecking(false);
    }
  }
  async function save(input: WorkReviewInput, before: WorkReviewOptions) {
    if (!ready || pending || saving || disabled) throw noSend();
    setSaving(true);
    savedVersion.current = undefined;
    let marker: ReturnType<typeof mark> | undefined,
      sent = false;
    try {
      const latest = await current();
      if (
        !matches(latest.row) ||
        !latest.row.canReview ||
        latest.row.resourcePolicyVersionId !== input.resourcePolicyVersionId ||
        latest.row.version !== input.expectedVersion ||
        input.resourceIds.some(
          (id) =>
            !latest.row.resources.some((r) => r.id === id && r.status === "AVAILABLE"),
        )
      )
        throw noSend();
      marker = mark(owner, booking.id, booking.version, action);
      setPending(marker);
      if (!alive.current || latest.signal.aborted) throw noSend();
      sent = true;
      const response = await apiRequest(path + "/work-review", {
        method: "POST",
        csrf: true,
        body: input,
        signal: latest.signal,
      });
      const receipt = parseWorkReviewReceipt(
        response.data,
        before,
        booking,
        owner,
        input,
      );
      savedVersion.current = receipt.version;
      if (alive.current) {
        clear(owner, marker.token, action);
        setPending(undefined);
      }
    } catch (e) {
      const rejected =
        e instanceof ApiError &&
        e.status >= 400 &&
        e.status < 500 &&
        ![408, 429].includes(e.status);
      if (alive.current && marker && (!sent || rejected)) {
        clear(owner, marker.token, action);
        setPending(undefined);
      }
      throw e instanceof ApiError
        ? e
        : Error(
            "The outcome is uncertain. Check the saved work review before sending another change.",
          );
    } finally {
      if (alive.current) setSaving(false);
    }
  }
  function review() {
    setError(undefined);
    if (!options?.canReview || !options.resourcePolicyVersionId) return;
    const parsed = workReviewInputSchema.safeParse({
      expectedVersion: options.version,
      resourcePolicyVersionId: options.resourcePolicyVersionId,
      remainingMinutes: remaining.trim() === "" ? null : Number(remaining),
      cleanupMinutes: cleanup.trim() === "" ? null : Number(cleanup),
      resourceIds: selected,
      reason,
    });
    if (!parsed.success) {
      setError(
        "Enter the remaining work time, an explicit cleanup allowance and a reason of at least 10 characters.",
      );
      return;
    }
    const needed = options.requirements.reduce((sum, r) => sum + r.quantity, 0);
    if (selected.length < needed) {
      setError(
        "Choose at least " + needed + " distinct required equipment or space units.",
      );
      return;
    }
    const input = parsed.data;
    setProposal({
      title: "Review remaining work",
      description:
        "This records a new estimate and the actual selected units after full capacity checks. It does not start or complete work, move the visit, charge money or promise collection.",
      facts: [
        { label: "Visit", value: formatBusinessDate(booking.scheduledAt) },
        { label: "Recorded work start", value: formatBusinessDate(options.startedAt) },
        { label: "Remaining work", value: input.remainingMinutes + " min" },
        { label: "Cleanup allowance", value: input.cleanupMinutes + " min" },
        {
          label: "Equipment and space",
          value: selected.length
            ? options.resources
                .filter((r) => selected.includes(r.id))
                .map((r) => r.name)
                .join(", ")
            : "None required by the approved plan",
        },
        { label: "Internal reason", value: input.reason },
      ],
      retryAfterRejection: false,
      onUncertain: () => setPending(read(owner, action)),
      submit: () => save(input, options),
    });
  }
  function finish() {
    try {
      if (!inspection || !ack) return;
      clear(owner, pending && pending !== "unknown" ? pending.token : undefined, action);
      setPending(undefined);
      setInspection(undefined);
      onSaved();
    } catch (e) {
      setError(errorText(e));
    }
  }
  if (!ready) return null;
  if (pending)
    return (
      <section className="card" aria-labelledby={title}>
        <h2 id={title}>Check the earlier work review</h2>
        <p>
          A previous review needs inspection. Do not send it again until the current saved
          record has been checked. The latest record may include another operator’s
          change.
        </p>
        <Feedback message={error} scrollToMessage />
        {pending !== "unknown" && pending.id !== booking.id ? (
          <Link
            href={
              (access ? "/admin/workforce/bookings/" : "/admin/bookings/") + pending.id
            }
          >
            Open the booking that needs checking
          </Link>
        ) : (
          <>
            <button
              className="button secondary"
              type="button"
              disabled={checking}
              onClick={() => load(true)}
            >
              {checking ? "Checking saved review..." : "Check current work review"}
            </button>
            {inspection && (
              <div>
                <p>
                  Current visit status: {inspection.status}. Booking revision:{" "}
                  {inspection.version}.
                </p>
                {inspection.current ? (
                  <>
                    <p>
                      Reviewed {formatBusinessDate(inspection.current.reviewedAt)}:{" "}
                      {inspection.current.remainingMinutes} min remaining, with{" "}
                      {inspection.current.cleanupMinutes} min cleanup.
                    </p>
                    <p>Saved reason: {inspection.current.reason}</p>
                    <p>
                      Recorded equipment or space:{" "}
                      {inspection.current.resourceIds.length === 0
                        ? "None required"
                        : inspection.current.resourceNames?.length ===
                            inspection.current.resourceIds.length
                          ? inspection.current.resourceNames.join(", ")
                          : "Check the saved physical-unit record with the responsible operator"}
                      . This view does not attribute an uncertain earlier request.
                    </p>
                  </>
                ) : (
                  <p>
                    No current work review is recorded for this job’s present service,
                    technician and start. Check the job history with the responsible
                    operator.
                  </p>
                )}
                <label className="work-review-resource">
                  <input
                    type="checkbox"
                    checked={ack}
                    onChange={(e) => setAck(e.target.checked)}
                  />{" "}
                  I have inspected the current job and any earlier changes before clearing
                  this local recovery reference.
                </label>
                <button
                  type="button"
                  className="button secondary"
                  disabled={!ack}
                  onClick={finish}
                >
                  Clear checked work-review reference
                </button>
              </div>
            )}
          </>
        )}
      </section>
    );
  if (
    !permitted ||
    !booking.startedAt ||
    !["CONFIRMED", "IN_PROGRESS"].includes(booking.status)
  )
    return null;
  return (
    <section className="card" aria-labelledby={title}>
      <h2 id={title}>Review remaining work</h2>
      <p>
        Use the actual work still required. The original visit and recorded start stay
        unchanged. This is not a promised vehicle-collection time.
      </p>
      <Feedback message={error} scrollToMessage />
      {!options ? (
        <button
          type="button"
          className="button secondary"
          disabled={disabled || checking}
          onClick={() => load()}
        >
          {checking ? "Checking the job..." : "Check current resources"}
        </button>
      ) : !options.canReview ? (
        <p>
          This job needs a current service, technician and approved resource assessment
          before its remaining work can be reviewed.
        </p>
      ) : (
        <form
          ref={form}
          onSubmit={(e) => {
            e.preventDefault();
            review();
          }}
        >
          <fieldset disabled={disabled || saving || !!proposal || checking}>
            <legend>Remaining work and actual resources</legend>
            <div className="field">
              <label htmlFor={prefix + "-remaining"}>
                Estimated remaining work (minutes)
              </label>
              <input
                id={prefix + "-remaining"}
                type="number"
                min={1}
                max={1440}
                step={1}
                required
                value={remaining}
                onChange={(e) => setRemaining(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor={prefix + "-cleanup"}>Cleanup after work (minutes)</label>
              <input
                id={prefix + "-cleanup"}
                type="number"
                min={0}
                max={1440}
                step={1}
                required
                value={cleanup}
                onChange={(e) => setCleanup(e.target.value)}
                aria-describedby={prefix + "-cleanup-help"}
              />
              <p id={prefix + "-cleanup-help"}>
                Enter zero only when no cleanup is needed. Blank means unassessed.
              </p>
            </div>
            <fieldset>
              <legend>Equipment and shared space</legend>
              <p id={prefix + "-resources-help"}>
                Choose the actual units for the remaining work. Their condition does not
                guarantee availability; the full occupied period is checked at
                confirmation.
              </p>
              <p>
                Minimum approved requirements:{" "}
                {options.requirements.length
                  ? options.requirements
                      .map((r) => r.pool + " × " + r.quantity)
                      .join(", ")
                  : "No mandatory equipment or shared space"}
                . You may include additional approved units genuinely needed for this job;
                explain the need in your reason.
              </p>
              {options.resources.map((resource) => (
                <label key={resource.id} className="work-review-resource">
                  <input
                    type="checkbox"
                    disabled={resource.status !== "AVAILABLE"}
                    checked={selected.includes(resource.id)}
                    aria-describedby={prefix + "-resources-help"}
                    onChange={(e) =>
                      setSelected((ids) =>
                        e.target.checked
                          ? [...ids, resource.id]
                          : ids.filter((id) => id !== resource.id),
                      )
                    }
                  />
                  <span>
                    {resource.name}
                    <small>
                      {resource.pools.join(", ")} ·{" "}
                      {resource.status === "AVAILABLE"
                        ? "In service"
                        : "Not currently in service"}
                    </small>
                  </span>
                </label>
              ))}
              <p role="status" aria-live="polite">
                {selected.length} units selected.
              </p>
            </fieldset>
            <div className="field">
              <label htmlFor={prefix + "-reason"}>
                Reason for this work review (internal)
              </label>
              <textarea
                id={prefix + "-reason"}
                required
                minLength={10}
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <button type="submit" className="button">
              Review remaining work
            </button>
            <button type="button" className="button secondary" onClick={() => load()}>
              Refresh resource choices
            </button>
          </fieldset>
        </form>
      )}
      {proposal && (
        <MutationReview
          confirmLabel="Confirm work review"
          proposal={proposal}
          onClose={() => setProposal(null)}
          onSuccess={() => onSaved(savedVersion.current)}
        />
      )}
    </section>
  );
}
