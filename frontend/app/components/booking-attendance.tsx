"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiRequest, ApiError } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import {
  attendanceLabels,
  attendanceReceiptSchema,
  parseAttendance,
  type AttendanceEvent,
} from "@/lib/api/booking-attendance";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession } from "./dashboard-shell";
import { Feedback } from "./feedback";
import "./booking-attendance.css";

export function BookingAttendanceHistory({ events }: { events?: AttendanceEvent[] }) {
  if (!events?.length) return null;
  return (
    <section
      className="booking-attendance card"
      aria-label="Recorded appointment attendance"
    >
      <h2>Recent arrival and attendance history</h2>
      <ol>
        {events.map((e) => (
          <li key={e.id}>
            <strong>{attendanceLabels[e.kind]}</strong>
            <p>
              {formatBusinessDate(e.createdAt)} · Appointment version{" "}
              {e.scheduleVersion + 1}
            </p>
            <p>{e.reason}</p>
          </li>
        ))}
      </ol>
      {events.length === 30 && (
        <p>The latest 30 updates are shown. Earlier audit history is retained.</p>
      )}
    </section>
  );
}
export function BookingAttendance({
  bookingId,
  managed = false,
  blocked = false,
  showInlineNotice = true,
  onUpdated,
}: {
  bookingId: string;
  managed?: boolean;
  blocked?: boolean;
  showInlineNotice?: boolean;
  onUpdated: (message: string) => void;
}) {
  const session = useAccountSession();
  if (!session || !["ADMIN", "SUPER_ADMIN", "STAFF"].includes(session.user.role))
    return null;
  return (
    <AttendanceEditor
      key={`${session.user.id}:${session.user.role}:${bookingId}:${managed}`}
      actorId={session.user.id}
      bookingId={bookingId}
      managed={managed}
      blocked={blocked}
      showInlineNotice={showInlineNotice}
      onUpdated={onUpdated}
    />
  );
}
function AttendanceEditor({
  actorId,
  bookingId,
  managed,
  blocked,
  showInlineNotice,
  onUpdated,
}: {
  actorId: string;
  bookingId: string;
  managed: boolean;
  blocked: boolean;
  showInlineNotice: boolean;
  onUpdated: (message: string) => void;
}) {
  const key = `aat-attendance:${actorId}:${bookingId}`;
  const [pending, setPending] = useState<string | null>(() => {
    try {
      return typeof window === "undefined"
        ? null
        : (() => {
            const v = sessionStorage.getItem(key);
            return v &&
              /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)
              ? v
              : null;
          })();
    } catch {
      return null;
    }
  });
  const [saving, setSaving] = useState(false),
    [kind, setKind] = useState<AttendanceEvent["kind"]>("ARRIVED"),
    [reason, setReason] = useState(""),
    [verified, setVerified] = useState(false),
    [error, setError] = useState<string>(),
    [message, setMessage] = useState<string>();
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const base = `/staff/${managed ? "workforce/" : ""}bookings/${bookingId}/attendance`;
  const record = useResource(
    base + (pending && !saving ? `?receiptId=${encodeURIComponent(pending)}` : ""),
    parseAttendance,
  );
  const row =
    record.data?.bookingId === bookingId &&
    !record.error &&
    !record.refreshError &&
    !record.loading &&
    !record.refreshing
      ? record.data
      : undefined;
  const { refresh } = record;
  useEffect(() => {
    if (!row || row.checkAttendance || row.status !== "CONFIRMED") return;
    const delay = Date.parse(row.checkAt) - Date.parse(row.serverTime);
    if (delay <= 0 || delay > 2147483647) return;
    const timer = setTimeout(refresh, delay + 100);
    return () => clearTimeout(timer);
  }, [row, refresh]);
  function clearPending() {
    try {
      sessionStorage.removeItem(key);
    } catch {}
    setPending(null);
    setError(undefined);
  }
  const receiptResolved = !!pending && row?.receipt?.id === pending;
  const active = !!row && row.status === "CONFIRMED" && row.startedAt === null;
  const current = row?.current?.kind;
  const choices: AttendanceEvent["kind"][] = active
    ? current === "ARRIVED" || current === "WAITING"
      ? ["WAITING", "LEFT"]
      : current === "LEFT"
        ? ["ARRIVED"]
        : ["ARRIVED", ...(row.checkAttendance ? ["ABSENCE_CONFIRMED" as const] : [])]
    : [];
  const action = choices.includes(kind) ? kind : choices[0];
  const disabled = blocked || saving || !row || !!pending;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || !row || !action) return;
    setError(undefined);
    setMessage(undefined);
    if (action !== "ARRIVED" && !reason.trim()) {
      setError("Add a brief, factual reason.");
      return;
    }
    if (action === "ABSENCE_CONFIRMED" && !verified) {
      setError(
        "Check that the customer has not arrived before marking the appointment missed.",
      );
      return;
    }
    const operationId = crypto.randomUUID();
    try {
      sessionStorage.setItem(key, operationId);
    } catch {}
    setPending(operationId);
    setSaving(true);
    try {
      const response = await apiRequest(base, {
        method: "POST",
        csrf: true,
        body: {
          operationId,
          expectedVersion: row.bookingVersion,
          kind: action,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        },
      });
      const receipt = attendanceReceiptSchema.parse(response.data);
      if (!live.current) return;
      if (
        receipt.event.id !== operationId ||
        receipt.performedByUserId !== actorId ||
        receipt.attendance.bookingId !== bookingId ||
        receipt.event.bookingVersion !== row.bookingVersion + 1
      )
        throw Error("Unverified attendance receipt");
      clearPending();
      setReason("");
      setVerified(false);
      setMessage("Attendance update saved.");
      refresh();
      onUpdated("Attendance update saved.");
    } catch (cause) {
      if (!live.current) return;
      setError(
        "The update could not be verified. Refresh attendance to check whether it saved.",
      );
      if (
        cause instanceof ApiError &&
        [400, 401, 403, 404, 409, 422, 429].includes(cause.status)
      ) {
        clearPending();
        setError(cause.message);
      }
      refresh();
    } finally {
      if (live.current) setSaving(false);
    }
  }
  return (
    <section
      className="booking-attendance card"
      id="booking-attendance"
      aria-label="Appointment attendance"
    >
      <h2>Arrival and attendance</h2>
      <p>A customer’s planned-attendance reply does not record physical arrival.</p>
      <Feedback message={error || record.error || record.refreshError} />
      {showInlineNotice && <Feedback message={message} tone="success" />}
      <button
        type="button"
        className="button secondary"
        disabled={saving || record.loading || record.refreshing}
        onClick={refresh}
      >
        Refresh attendance
      </button>
      {(record.loading || record.refreshing) && <p role="status">Checking attendance…</p>}
      {row && (
        <>
          <p>
            <strong>
              {row.current
                ? attendanceLabels[row.current.kind]
                : "No workshop arrival recorded for this appointment"}
            </strong>
          </p>
          {pending && !saving && (
            <div role="status">
              <p>
                {receiptResolved
                  ? "The saved update has been found in this appointment's history."
                  : "An earlier update has not been verified. Check the latest appointment history before continuing."}
              </p>
              <button
                type="button"
                className="button secondary"
                disabled={saving}
                onClick={() => {
                  clearPending();
                  const notice = receiptResolved
                    ? "Saved update verified."
                    : "Latest attendance reviewed. Any older request must still pass the server's version check.";
                  setMessage(notice);
                  onUpdated(notice);
                }}
              >
                {" "}
                {receiptResolved
                  ? "Continue with saved update"
                  : "I have checked the latest record"}
              </button>
            </div>
          )}
          {row.workReviewRequired && (
            <p>Review the existing work order before marking this appointment missed.</p>
          )}
          {active && !row.current && !row.workReviewRequired && (
            <p>
              {row.policy.graceMinutes}-minute attendance-check grace
              {row.policy.source === "DELEGATED_DEFAULT"
                ? " (delegated default)"
                : " (approved branch setting)"}
              .{" "}
              {row.checkAttendance
                ? "Check attendance is available; staff must verify absence."
                : `Attendance check from ${formatBusinessDate(row.checkAt)}.`}
            </p>
          )}
          {!!choices.length && (
            <form onSubmit={submit}>
              <div className="attendance-fields">
                <div>
                  <label htmlFor={`attendance-kind-${bookingId}`}>Update</label>
                  <select
                    className="input"
                    id={`attendance-kind-${bookingId}`}
                    value={action}
                    disabled={disabled}
                    onChange={(e) => {
                      setKind(e.target.value as AttendanceEvent["kind"]);
                      setVerified(false);
                    }}
                  >
                    {choices.map((k) => (
                      <option key={k} value={k}>
                        {k === "ARRIVED"
                          ? "Record arrival"
                          : k === "WAITING"
                            ? "Waiting for an available turn"
                            : k === "LEFT"
                              ? "Record that the customer left"
                              : "Check attendance and mark missed"}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor={`attendance-reason-${bookingId}`}>
                    Factual note{action === "ARRIVED" ? " (optional)" : ""}
                  </label>
                  <textarea
                    className="input"
                    id={`attendance-reason-${bookingId}`}
                    value={reason}
                    maxLength={1000}
                    required={action !== "ARRIVED"}
                    disabled={disabled}
                    onChange={(e) => setReason(e.target.value)}
                    aria-describedby={`attendance-note-${bookingId}`}
                  />
                  <p id={`attendance-note-${bookingId}`} className="field-hint">
                    This note appears in appointment history. Keep it brief and factual.
                  </p>
                </div>
              </div>
              {action === "ABSENCE_CONFIRMED" && (
                <>
                  <label className="attendance-check">
                    <input
                      type="checkbox"
                      checked={verified}
                      disabled={disabled}
                      onChange={(e) => setVerified(e.target.checked)}
                    />
                    I checked that the customer has not arrived.
                  </label>
                  <p>
                    Marking missed frees eligible remaining capacity. It does not apply a
                    fee, forfeiture or automatic refund decision.
                  </p>
                </>
              )}
              {action === "WAITING" && (
                <p>
                  Waiting does not move the confirmed appointment or displace another
                  customer. A booking operator can review a permitted available-time
                  alternative when appropriate.
                </p>
              )}
              {action === "LEFT" && (
                <p>
                  This records that the customer left. Rescheduling or cancelling the
                  appointment is a separate action.
                </p>
              )}
              <button
                className="button"
                type="submit"
                disabled={disabled || (action === "ABSENCE_CONFIRMED" && !verified)}
              >
                {saving
                  ? "Saving attendance…"
                  : action === "ABSENCE_CONFIRMED"
                    ? "Confirm missed appointment"
                    : "Save attendance update"}
              </button>
            </form>
          )}
          <BookingAttendanceHistory events={row.events} />
        </>
      )}
    </section>
  );
}
