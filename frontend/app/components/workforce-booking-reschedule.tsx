"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiRequest, ApiError } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { parseWorkforceAccess, type WorkforceAccess } from "@/lib/api/workforce-schemas";
import {
  parseWorkforceBookingDetail,
  type WorkforceBooking,
} from "@/lib/admin/workforce-bookings";
import {
  parseRescheduleCandidates,
  parseWorkforceRescheduleReceipt,
} from "@/lib/admin/workforce-booking-reschedule";
import { sameWorkforceScope } from "@/lib/admin/workforce-overview";
import { workforceAllows, workforceActionPredicates } from "@/lib/workforce-registry";
import {
  readWorkforceBookingPending as read,
  markWorkforceBookingPending as mark,
  clearWorkforceBookingPending as clear,
  type WorkforceBookingPending,
} from "@/lib/admin/workforce-booking-pending";
import type { RescheduleDecision } from "@/lib/api/booking-schemas";
import {
  BookingRescheduleReview,
  type RescheduleStaffControl,
} from "./booking-reschedule-review";
import { BookingRescheduleHistory } from "./booking-reschedule-history";
import { Feedback } from "./feedback";
import { formatBusinessDate } from "@/lib/format/date";
const notSent = () => {
  const error = new ApiError(409, { error: { code: "CONFLICT" } });
  error.message =
    "No decision was sent. Refresh the booking and current responsibilities, then review again.";
  return error;
};
const eligible = (access: WorkforceAccess, branchId: string | null) =>
  workforceAllows(access, workforceActionPredicates.bookingConfirm, { branchId });
const assignable = (access: WorkforceAccess, from: string | null, to: string) =>
  workforceAllows(access, workforceActionPredicates.jobAssign, { branchId: from }) &&
  workforceAllows(access, workforceActionPredicates.jobAssign, { branchId: to });
export function WorkforceBookingReschedule({
  row,
  access,
  onSaved,
  onRefresh,
}: {
  row: WorkforceBooking;
  access: WorkforceAccess;
  onSaved: (version: number) => void;
  onRefresh: () => void;
}) {
  const [marker, setMarker] = useState<WorkforceBookingPending>();
  const [ready, setReady] = useState(false),
    [inFlight, setInFlight] = useState(false);
  const [checking, setChecking] = useState(false),
    [acknowledged, setAcknowledged] = useState(false);
  const [inspection, setInspection] = useState<WorkforceBooking>();
  const [error, setError] = useState<string>();
  const alive = useRef(true),
    controller = useRef<AbortController | null>(null),
    savedVersion = useRef<number | undefined>(undefined);
  useEffect(() => {
    alive.current = true;
    queueMicrotask(() => {
      if (alive.current) {
        setMarker(read(access.userId, "reschedule"));
        setReady(true);
      }
    });
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, [access.userId]);
  async function current() {
    const request = new AbortController();
    controller.current = request;
    const [own, booking] = await Promise.all([
      apiRequest("/staff/workforce/access", { signal: request.signal }),
      apiRequest(`/staff/workforce/bookings/${row.id}`, { signal: request.signal }),
    ]);
    const nextAccess = parseWorkforceAccess(own.data),
      next = parseWorkforceBookingDetail(booking.data, row.id);
    if (
      !alive.current ||
      !sameWorkforceScope(access, nextAccess) ||
      !sameWorkforceScope(nextAccess, next.access)
    )
      throw notSent();
    return { access: nextAccess, row: next.row, signal: request.signal };
  }
  async function perform(input: RescheduleDecision) {
    if (!ready || marker || inFlight) throw notSent();
    setInFlight(true);
    setError(undefined);
    savedVersion.current = undefined;
    let sent = false,
      pending: ReturnType<typeof mark> | undefined;
    try {
      const latest = await current();
      const change = latest.row.rescheduleRequests?.find(
        (request) => request.id === input.requestId && request.status === "PENDING",
      );
      if (
        !eligible(latest.access, latest.row.branchId) ||
        !change ||
        latest.row.version !== row.version ||
        latest.row.status !== row.status ||
        latest.row.scheduledAt !== row.scheduledAt ||
        latest.row.branchId !== row.branchId
      )
        throw notSent();
      if (input.decision === "APPROVE") {
        if (!input.assignedStaffId || !eligible(latest.access, change.branchId))
          throw notSent();
        const changed =
          input.assignedStaffId !== latest.row.assignedStaff?.id ||
          change.branchId !== latest.row.branchId;
        if (changed && !assignable(latest.access, latest.row.branchId, change.branchId))
          throw notSent();
        if (assignable(latest.access, latest.row.branchId, change.branchId)) {
          const options = await apiRequest(
            `/staff/workforce/bookings/${row.id}/reschedule-assignees?requestId=${change.id}&staffId=${input.assignedStaffId}&limit=25`,
            { signal: latest.signal },
          );
          if (
            !parseRescheduleCandidates(
              options.data,
              latest.row,
              latest.access,
              change.id,
            ).items.some((person) => person.id === input.assignedStaffId)
          )
            throw notSent();
        }
      }
      pending = mark(access.userId, row.id, row.version, "reschedule");
      setMarker(pending);
      if (!alive.current || latest.signal.aborted) throw notSent();
      sent = true;
      const response = await apiRequest(
        `/staff/workforce/bookings/${row.id}/reschedule-decision`,
        { method: "POST", csrf: true, body: input, signal: latest.signal },
      );
      const receipt = parseWorkforceRescheduleReceipt(
        response.data,
        latest.row,
        access.userId,
        input,
      );
      if (!alive.current) return;
      clear(access.userId, pending.token, "reschedule");
      setMarker(undefined);
      savedVersion.current = receipt.version;
    } catch (caught) {
      const rejected =
        caught instanceof ApiError &&
        caught.status >= 400 &&
        caught.status < 500 &&
        ![408, 429].includes(caught.status);
      if (alive.current && pending && (!sent || rejected)) {
        clear(access.userId, pending.token, "reschedule");
        setMarker(undefined);
      }
      throw caught;
    } finally {
      if (alive.current) setInFlight(false);
    }
  }
  async function inspect() {
    if (checking || (marker && marker !== "unknown" && marker.id !== row.id)) return;
    setChecking(true);
    setInspection(undefined);
    setAcknowledged(false);
    setError(undefined);
    try {
      const latest = await current();
      if (alive.current) setInspection(latest.row);
    } catch {
      if (alive.current)
        setError(
          "Current booking and access could not be verified. Refresh before continuing.",
        );
    } finally {
      if (alive.current) setChecking(false);
    }
  }
  function finish() {
    if (!marker || !inspection || !acknowledged || checking) return;
    try {
      clear(access.userId, marker === "unknown" ? undefined : marker.token, "reschedule");
      setMarker(undefined);
      setInspection(undefined);
      onRefresh();
    } catch {
      setError("The recovery reference changed. Refresh before continuing.");
    }
  }
  if (!ready) return <p role="status">Checking earlier booking changes…</p>;
  if (marker && !inFlight)
    return (
      <section className="card" aria-label="Check earlier reschedule decision">
        <h2>Check the earlier reschedule decision</h2>
        <p role="alert">
          The previous outcome needs checking. Nothing will be sent again automatically.
        </p>
        <Feedback message={error} />
        {marker !== "unknown" && marker.id !== row.id && (
          <Link href={`/admin/workforce/bookings/${marker.id}`}>
            Open the affected booking
          </Link>
        )}
        <button
          className="button secondary"
          disabled={checking || (marker !== "unknown" && marker.id !== row.id)}
          onClick={() => void inspect()}
        >
          Check current booking
        </button>
        {inspection && (
          <>
            <p>
              Recorded appointment: {formatBusinessDate(inspection.scheduledAt)}. Status:{" "}
              {inspection.status.replaceAll("_", " ").toLowerCase()}.
            </p>
            <BookingRescheduleHistory requests={inspection.rescheduleRequests} />
            {inspection.rescheduleRequests?.some(
              (request) => request.status === "PENDING",
            ) && <p>A requested change still awaits a decision.</p>}
            <label>
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
              />{" "}
              I have reviewed the affected booking and its reschedule history.
            </label>
            <button
              className="button secondary"
              disabled={!acknowledged || checking}
              onClick={finish}
            >
              Clear checked recovery reference
            </button>
          </>
        )}
      </section>
    );
  if (!row.rescheduleRequests?.some((request) => request.status === "PENDING"))
    return null;
  return (
    <div className="card workforce-reschedule">
      <BookingRescheduleReview
        booking={row}
        canReview={eligible(access, row.branchId)}
        disabled={inFlight}
        performDecision={perform}
        renderStaff={(control) => (
          <WorkforceRescheduleStaffPicker row={row} access={access} control={control} />
        )}
        onSaved={() => {
          if (savedVersion.current !== undefined) onSaved(savedVersion.current);
          else onRefresh();
        }}
      />
    </div>
  );
}
function WorkforceRescheduleStaffPicker({
  row,
  access,
  control,
}: {
  row: WorkforceBooking;
  access: WorkforceAccess;
  control: RescheduleStaffControl;
}) {
  const pending = row.rescheduleRequests!.find(
    (request) => request.status === "PENDING",
  )!;
  const [query, setQuery] = useState("");
  const [trail, setTrail] = useState<string[]>([]);
  const canAssign = assignable(access, row.branchId, pending.branchId),
    targetEligible = eligible(access, pending.branchId);
  const cursor = trail.at(-1);
  const parse = useCallback(
    (value: unknown) => parseRescheduleCandidates(value, row, access, pending.id),
    [row, access, pending.id],
  );
  const params = new URLSearchParams({
    requestId: pending.id,
    limit: "25",
    ...(query.trim() ? { q: query.trim() } : {}),
    ...(cursor ? { cursor } : {}),
  });
  const resource = useResource(
    canAssign
      ? `/staff/workforce/bookings/${row.id}/reschedule-assignees?${params}`
      : null,
    parse,
  );
  const changed =
    control.value !== row.assignedStaff?.id || pending.branchId !== row.branchId;
  const blocked =
    !targetEligible ||
    !control.value ||
    (!canAssign && changed) ||
    (canAssign &&
      (resource.loading ||
        resource.refreshing ||
        !!resource.error ||
        !!resource.refreshError ||
        !resource.data));
  const { onAvailabilityChange } = control;
  useEffect(() => {
    onAvailabilityChange(blocked);
  }, [blocked, onAvailabilityChange]);
  const initial = pending.proposedStaff ?? row.assignedStaff;
  const choices = resource.data?.items ?? [];
  return (
    <>
      {canAssign && (
        <>
          <label htmlFor="reschedule-staff-search">Find a permitted technician</label>
          <input
            id="reschedule-staff-search"
            type="search"
            maxLength={120}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setTrail([]);
            }}
          />
        </>
      )}
      <select
        id="reschedule-staff"
        value={control.value ?? ""}
        disabled={
          !canAssign ||
          resource.loading ||
          resource.refreshing ||
          !!resource.error ||
          !!resource.refreshError
        }
        onChange={(event) =>
          control.onSelect(
            event.target.value,
            event.target.selectedOptions[0]?.textContent ?? "Selected technician",
          )
        }
      >
        <option value="">Choose a technician</option>
        {initial &&
          control.value === initial.id &&
          !choices.some((person) => person.id === initial.id) && (
            <option value={initial.id}>
              {initial.firstName} {initial.lastName}
            </option>
          )}
        {choices.map((person) => (
          <option key={person.id} value={person.id}>
            {person.firstName} {person.lastName}
          </option>
        ))}
      </select>
      {!canAssign && (
        <p>
          {changed
            ? "Changing technician or branch also needs the existing assignment responsibility. You can still review a decline."
            : "The existing technician is retained. Assignment changes require a separate responsibility."}
        </p>
      )}
      {!targetEligible && (
        <p>Approval also needs confirmation scope at the requested branch.</p>
      )}
      <Feedback message={resource.error ?? resource.refreshError} />
      {(resource.error || resource.refreshError) && (
        <button type="button" className="button secondary" onClick={resource.refresh}>
          Retry technician choices
        </button>
      )}
      {canAssign && (
        <div className="actions">
          {!!trail.length && (
            <button
              type="button"
              className="button secondary"
              onClick={() => setTrail((before) => before.slice(0, -1))}
            >
              Previous technicians
            </button>
          )}
          {resource.data?.nextCursor && (
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                setTrail((before) => [...before, resource.data!.nextCursor!])
              }
            >
              More technicians
            </button>
          )}
        </div>
      )}
    </>
  );
}
