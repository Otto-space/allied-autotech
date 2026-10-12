"use client";
import { useEffect, useRef, useState } from "react";
import {
  apiRequest,
  ApiError,
  invalidateSession,
  SESSION_CHANGED,
} from "@/lib/api/client";
import { z } from "zod";
import type { RequestBody } from "@/lib/api/contracts";
import { useResource } from "@/lib/api/use-resource";
import {
  parseReservationPolicy,
  parseReservationPolicyHistory,
  reservationTermsKey,
  termsSettingsSchema,
} from "@/lib/api/reservation-terms";
import { lagosDateTime } from "@/lib/forms/vehicle-condition";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import "./reservation-terms.css";

const path = `/admin/policies?key=${reservationTermsKey}&limit=100`;
function Editor({ owner }: { owner: string }) {
  const history = useResource(path, parseReservationPolicyHistory);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const approval = useRef<HTMLInputElement>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => {
    const discard = () => {
      pending.current?.abort();
      setProposal(null);
      setUncertain(true);
    };
    window.addEventListener(SESSION_CHANGED, discard);
    return () => {
      pending.current?.abort();
      window.removeEventListener(SESSION_CHANGED, discard);
    };
  }, []);
  const latest = history.data?.reduce(
    (a, b) => (a.version > b.version ? a : b),
    history.data[0],
  );
  const disabled =
    history.loading ||
    history.refreshing ||
    !!history.error ||
    !!history.refreshError ||
    !history.data ||
    !!proposal ||
    uncertain;
  function review(form: FormData) {
    if (disabled) return;
    setError(undefined);
    setMessage(undefined);
    const enabled = form.get("action") !== "withdraw";
    const settings = termsSettingsSchema.safeParse(
      enabled
        ? { enabled, title: form.get("title"), body: form.get("body") }
        : { enabled, reason: form.get("reason") },
    );
    const source = String(form.get("source") ?? "").trim(),
      approvalEvidence = String(form.get("approvalEvidence") ?? "").trim();
    const effective = String(form.get("effectiveAt") ?? "");
    if (!settings.success) {
      setError(settings.error.issues[0]?.message ?? "Check the agreement fields.");
      return;
    }
    if (
      source.length < 10 ||
      source.length > 500 ||
      approvalEvidence.length < 20 ||
      approvalEvidence.length > 1000
    ) {
      setError(
        "Provide an approval source (10–500 characters) and written approval reference (20–1,000 characters).",
      );
      return;
    }
    if (form.get("approved") !== "on") {
      setError("Confirm that the agreement or withdrawal has been approved.");
      return;
    }
    if (
      effective &&
      (!lagosDateTime.safeParse(effective).success ||
        Date.parse(`${effective}:00+01:00`) <= Date.now())
    ) {
      setError(
        "Choose a future Lagos date and time, or leave it empty for immediate publication.",
      );
      return;
    }
    const expectedVersion = latest?.version ?? 0;
    setProposal({
      presentation: "agreement",
      title: enabled
        ? "Publish this reservation agreement?"
        : "Withdraw reservation agreement availability?",
      description:
        "This records a new approved revision. Historical acceptance stays unchanged. Scheduled future revisions still take effect on their recorded dates. Payment policies are managed separately.",
      facts: [
        {
          label: "Action",
          value: enabled ? "Publish agreement" : "Withdraw availability",
        },
        ...(settings.data.enabled
          ? [
              { label: "Title", value: settings.data.title },
              { label: "Agreement text", value: settings.data.body },
            ]
          : [{ label: "Reason", value: settings.data.reason }]),
        {
          label: "Effective",
          value: effective ? `${effective.replace("T", " ")} (Lagos)` : "On confirmation",
        },
        { label: "Approval source", value: source },
        { label: "Written approval", value: approvalEvidence },
      ],
      retryAfterRejection: false,
      onUncertain: () => setUncertain(true),
      submit: async () => {
        const controller = new AbortController();
        pending.current = controller;
        const signal = controller.signal;
        const session = z
          .object({ user: z.object({ id: z.uuid(), role: z.string() }) })
          .parse((await apiRequest("/auth/session", { signal })).data);
        if (session.user.id !== owner || session.user.role !== "SUPER_ADMIN") {
          invalidateSession();
          throw new ApiError(409, { error: { code: "PRECONDITION_UNAVAILABLE" } });
        }
        const rows = parseReservationPolicyHistory(
          (await apiRequest(path, { signal })).data,
        );
        if (Math.max(0, ...rows.map((row) => row.version)) !== expectedVersion) {
          history.refresh();
          throw new ApiError(409, { error: { code: "STALE_VERSION" } });
        }
        const body: Extract<
          RequestBody<"/admin/policies", "post">,
          { kind: "VEHICLE_RESERVATION_TERMS" }
        > = {
          kind: "VEHICLE_RESERVATION_TERMS",
          expectedVersion,
          source,
          approvalEvidence,
          settings: settings.data,
          effectiveAt: effective
            ? new Date(`${effective}:00+01:00`).toISOString()
            : new Date().toISOString(),
        };
        signal.throwIfAborted();
        const saved = parseReservationPolicy(
          (
            await apiRequest("/admin/policies", {
              method: "POST",
              csrf: true,
              body,
              signal,
            })
          ).data,
        );
        if (
          saved.version !== expectedVersion + 1 ||
          saved.approvalStatus !== "APPROVED" ||
          JSON.stringify(saved.settings) !== JSON.stringify(body.settings) ||
          saved.source !== source ||
          saved.approvalEvidence !== approvalEvidence ||
          saved.effectiveAt !== body.effectiveAt
        )
          throw new Error("Publication outcome unconfirmed");
      },
    });
  }
  return (
    <>
      <Feedback message={history.error ?? history.refreshError ?? error} />
      <Feedback message={message} tone="success" />
      <button
        className="button secondary"
        disabled={history.loading || history.refreshing || !!proposal}
        onClick={history.refresh}
      >
        Refresh agreement history
      </button>
      {history.loading && <p role="status">Loading agreement history…</p>}
      {uncertain && (
        <p className="notice" role="status">
          Publication could not be confirmed. Review agreement history before making
          another change. This screen will not resend it.
        </p>
      )}
      <form
        data-draft-key="reservation-terms-policy:v1"
        className="reservation-agreement"
        onSubmit={(event) => {
          event.preventDefault();
          review(new FormData(event.currentTarget));
        }}
      >
        <fieldset disabled={disabled}>
          <div className="field">
            <label htmlFor="terms-action">Publication action</label>
            <select id="terms-action" name="action">
              <option value="publish">Publish an approved agreement</option>
              <option value="withdraw">Withdraw availability</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="terms-title">Agreement title</label>
            <input id="terms-title" name="title" maxLength={200} />
          </div>
          <div className="field">
            <label htmlFor="terms-body">Approved agreement text</label>
            <textarea id="terms-body" name="body" rows={12} maxLength={50000} />
            <p>Paste the exact approved plain text. No sample agreement is provided.</p>
          </div>
          <div className="field">
            <label htmlFor="terms-reason">Withdrawal reason (when withdrawing)</label>
            <textarea id="terms-reason" name="reason" maxLength={1000} rows={2} />
          </div>
          <div className="field">
            <label htmlFor="terms-source">Approval source</label>
            <input
              id="terms-source"
              name="source"
              required
              minLength={10}
              maxLength={500}
            />
          </div>
          <div className="field">
            <label htmlFor="terms-evidence">Written approval reference</label>
            <textarea
              id="terms-evidence"
              name="approvalEvidence"
              required
              minLength={20}
              maxLength={1000}
              rows={3}
            />
          </div>
          <div className="field">
            <label htmlFor="terms-effective">Effective from (Lagos time, optional)</label>
            <input id="terms-effective" name="effectiveAt" type="datetime-local" />
            <p>Leave empty to apply when you confirm.</p>
          </div>
          <label className="check-row">
            <input
              ref={approval}
              data-no-draft
              type="checkbox"
              name="approved"
              required
            />{" "}
            I confirm this agreement or withdrawal has been approved.
          </label>
          <button className="button">Review publication</button>
        </fieldset>
      </form>
      <section className="reservation-agreement" aria-labelledby="agreement-history">
        <h2 id="agreement-history">Agreement history</h2>
        {history.data?.length === 0 && (
          <p>
            No agreements have been published. Online reservations require an approved
            agreement.
          </p>
        )}
        {history.data?.map((row) => (
          <details key={row.id}>
            <summary>
              Revision {row.version} ·{" "}
              {row.settings.enabled ? row.settings.title : "Availability withdrawn"} ·{" "}
              {formatBusinessDate(row.effectiveAt)}
            </summary>
            <p>
              Approval status: {row.approvalStatus}. Effective{" "}
              {formatBusinessDate(row.effectiveAt)}.
            </p>
            <div className="agreement-text">
              {row.settings.enabled ? row.settings.body : row.settings.reason}
            </div>
            <p>Approval source: {row.source}</p>
            <p>Approval reference: {row.approvalEvidence ?? "Not recorded"}</p>
          </details>
        ))}
      </section>
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => {
            setProposal(null);
            if (approval.current) approval.current.checked = false;
            history.refresh();
          }}
          onSuccess={() =>
            setMessage(
              "Agreement publication recorded. Check its effective date in history.",
            )
          }
        />
      )}
    </>
  );
}
export function ReservationTermsPolicy() {
  const session = useAccountSession();
  return (
    <>
      <h1>Vehicle reservation agreements</h1>
      <p>
        Publish approved customer agreements or withdraw availability. Existing accepted
        documents remain available.
      </p>
      {session?.user.role === "SUPER_ADMIN" ? (
        <Editor key={session.user.id} owner={session.user.id} />
      ) : (
        <Feedback message="Super Admin access is required to publish reservation agreements." />
      )}
    </>
  );
}
