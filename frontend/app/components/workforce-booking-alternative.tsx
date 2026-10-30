"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { apiRequest, ApiError } from "@/lib/api/client";
import { parseWorkforceAccess, type WorkforceAccess } from "@/lib/api/workforce-schemas";
import { workforceAllows, workforceActionPredicates } from "@/lib/workforce-registry";
import { sameWorkforceScope } from "@/lib/admin/workforce-overview";
import {
  parseWorkforceBookingDetail,
  type WorkforceBooking,
} from "@/lib/admin/workforce-bookings";
import {
  readWorkforceBookingPending as read,
  markWorkforceBookingPending as mark,
  clearWorkforceBookingPending as clear,
  type WorkforceBookingPending,
} from "@/lib/admin/workforce-booking-pending";
import { formatBusinessDate as dateLabel } from "@/lib/format/date";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
const receiptSchema = z.object({
  id: z.uuid(),
  branchId: z.uuid(),
  status: z.string(),
  version: z.number().int(),
  scheduledAt: z.iso.datetime(),
  alternativeStartsAt: z.iso.datetime(),
  alternativeReason: z.string(),
  alternativeVersion: z.number().int(),
  performedByUserId: z.uuid(),
});
const denied = () => new ApiError(409, { error: { code: "CONFLICT" } });
export function WorkforceBookingAlternative({
  row,
  access,
  onRefresh,
  onSaved,
}: {
  row: WorkforceBooking;
  access: WorkforceAccess;
  onRefresh: () => void;
  onSaved: (version: number) => void;
}) {
  const [pending, setPending] = useState<WorkforceBookingPending>();
  const [ready, setReady] = useState(false),
    [checking, setChecking] = useState(false),
    [ack, setAck] = useState(false);
  const [proposal, setProposal] = useState<MutationProposal | null>(null),
    [error, setError] = useState<string>(),
    [inspection, setInspection] = useState<WorkforceBooking>();
  const alive = useRef(true),
    request = useRef<AbortController | null>(null),
    saved = useRef<number | undefined>(undefined),
    form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    alive.current = true;
    queueMicrotask(() => {
      if (alive.current) {
        setPending(read(access.userId, "alternative"));
        setReady(true);
      }
    });
    return () => {
      alive.current = false;
      request.current?.abort();
    };
  }, [access.userId]);
  const eligible = (own: WorkforceAccess, b: WorkforceBooking) =>
    workforceAllows(own, workforceActionPredicates.bookingConfirm, {
      branchId: b.branchId,
    });
  async function current() {
    const c = new AbortController();
    request.current = c;
    const [a, b] = await Promise.all([
      apiRequest("/staff/workforce/access", { signal: c.signal }),
      apiRequest(`/staff/workforce/bookings/${row.id}`, { signal: c.signal }),
    ]);
    const own = parseWorkforceAccess(a.data),
      detail = parseWorkforceBookingDetail(b.data, row.id);
    if (
      !alive.current ||
      !sameWorkforceScope(access, own) ||
      !sameWorkforceScope(own, detail.access)
    )
      throw denied();
    return { own, row: detail.row, signal: c.signal };
  }
  function review(data: FormData) {
    if (
      !ready ||
      pending ||
      proposal ||
      !eligible(access, row) ||
      !["REQUESTED", "CONFIRMED"].includes(row.status)
    )
      return;
    const time = new Date(`${String(data.get("preferredAt") ?? "")}:00+01:00`),
      reason = String(data.get("reason") ?? "").trim();
    if (!Number.isFinite(time.getTime()) || time.getTime() <= Date.now()) {
      setError("Choose a future time in Lagos.");
      form.current?.querySelector<HTMLInputElement>("input")?.focus();
      return;
    }
    if (
      reason.length < 10 ||
      reason.length > 1000 ||
      /[\u0000-\u001f\u007f]/.test(reason)
    ) {
      setError("Explain the change in 10–1,000 characters on one line.");
      form.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
      return;
    }
    setError(undefined);
    const body = {
      preferredAt: time.toISOString(),
      reason,
      expectedVersion: row.version,
    };
    setProposal({
      title: "Propose this appointment time?",
      description:
        "The customer must accept or decline. Their current appointment stays unchanged. This does not reserve capacity or charge a fee; an accepted time still needs staff confirmation.",
      facts: [
        { label: "Current appointment", value: dateLabel(row.scheduledAt) },
        { label: "Proposed time (Lagos)", value: dateLabel(body.preferredAt) },
        { label: "Reason shown to customer", value: reason },
      ],
      retryAfterRejection: false,
      submit: async () => {
        let sent = false,
          marker: ReturnType<typeof mark> | undefined;
        try {
          const latest = await current();
          if (
            !eligible(latest.own, latest.row) ||
            latest.row.version !== row.version ||
            latest.row.status !== row.status ||
            latest.row.scheduledAt !== row.scheduledAt ||
            latest.row.branchId !== row.branchId
          )
            throw denied();
          marker = mark(access.userId, row.id, row.version, "alternative");
          setPending(marker);
          if (!alive.current || latest.signal.aborted) throw denied();
          sent = true;
          const response = await apiRequest(
            `/staff/workforce/bookings/${row.id}/alternative`,
            { method: "POST", csrf: true, body, signal: latest.signal },
          );
          const r = receiptSchema.parse(response.data);
          if (
            r.id !== row.id ||
            r.branchId !== row.branchId ||
            r.status !== row.status ||
            r.scheduledAt !== row.scheduledAt ||
            r.version !== row.version + 1 ||
            r.alternativeVersion !== r.version ||
            r.alternativeStartsAt !== body.preferredAt ||
            r.alternativeReason !== reason ||
            r.performedByUserId !== access.userId
          )
            throw Error("Proposal receipt could not be verified");
          if (!alive.current) return;
          clear(access.userId, marker.token, "alternative");
          setPending(undefined);
          saved.current = r.version;
        } catch (caught) {
          if (alive.current) {
            const rejected =
              caught instanceof ApiError &&
              caught.status >= 400 &&
              caught.status < 500 &&
              ![408, 429].includes(caught.status);
            if ((!sent || rejected) && marker) {
              clear(access.userId, marker.token, "alternative");
              setPending(undefined);
            }
          }
          throw caught;
        }
      },
    });
  }
  async function inspect() {
    if (checking) return;
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
          "Current access could not be checked. Refresh your permissions before continuing.",
        );
    } finally {
      if (alive.current) setChecking(false);
    }
  }
  function finish() {
    if (!pending || !inspection || !ack || checking) return;
    try {
      clear(
        access.userId,
        pending === "unknown" ? undefined : pending.token,
        "alternative",
      );
      setPending(undefined);
      setInspection(undefined);
      onRefresh();
    } catch {
      setError("Recovery details changed. Refresh before continuing.");
    }
  }
  if (
    !pending &&
    (!eligible(access, row) || !["REQUESTED", "CONFIRMED"].includes(row.status))
  )
    return null;
  return (
    <section className="card" aria-labelledby="workforce-alternative-heading">
      <h2 id="workforce-alternative-heading">Propose another time</h2>
      <Feedback message={error} />
      {pending ? (
        <>
          <p role="status">
            An earlier proposal needs checking. No automatic retry will be sent.
          </p>
          {pending !== "unknown" && pending.id !== row.id ? (
            <Link href={`/admin/workforce/bookings/${pending.id}`}>
              Inspect the earlier booking
            </Link>
          ) : (
            <>
              {pending === "unknown" && (
                <p>
                  The earlier reference is unavailable. Ask an authorised manager to
                  review the booking history.
                </p>
              )}
              <button
                className="button secondary"
                disabled={checking}
                onClick={() => void inspect()}
              >
                Check proposal outcome
              </button>
              {inspection && (
                <>
                  <p>
                    Current appointment: {dateLabel(inspection.scheduledAt)}.{" "}
                    {inspection.alternativeStartsAt
                      ? `Proposed time: ${dateLabel(inspection.alternativeStartsAt)}.`
                      : "No proposed time is recorded."}{" "}
                    This shows the current record, not who made an earlier change.
                  </p>
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={ack}
                      onChange={(e) => setAck(e.target.checked)}
                    />{" "}
                    I have checked the current booking and the earlier proposal history.
                  </label>
                  <button
                    className="button secondary"
                    disabled={!ack || checking}
                    onClick={finish}
                  >
                    Finish checking proposal
                  </button>
                </>
              )}
            </>
          )}
        </>
      ) : (
        <form
          ref={form}
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            review(new FormData(e.currentTarget));
          }}
        >
          <p>
            The customer reviews your suggestion before their appointment changes. Choose
            a time within the published booking window.
          </p>
          <div className="field">
            <label htmlFor="workforce-alternative-time">Proposed time (Lagos)</label>
            <input
              id="workforce-alternative-time"
              name="preferredAt"
              type="datetime-local"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="workforce-alternative-reason">Reason shown to customer</label>
            <textarea
              id="workforce-alternative-reason"
              name="reason"
              minLength={10}
              maxLength={1000}
              required
            />
          </div>
          <button className="button" disabled={!ready}>
            Review proposed time
          </button>
        </form>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel="Send proposed time"
          onClose={() => setProposal(null)}
          onSuccess={() => {
            if (saved.current !== undefined) onSaved(saved.current);
          }}
        />
      )}
    </section>
  );
}
