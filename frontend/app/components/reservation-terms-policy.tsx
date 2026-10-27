"use client";
import { useEffect, useRef, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api/client";
import { parseOwnStaffProfile } from "@/lib/api/capability-schemas";
import type { RequestBody } from "@/lib/api/contracts";
import type { PolicyVersion } from "@/lib/api/policy-schemas";
import { termsSettingsSchema } from "@/lib/api/reservation-terms";
import "./reservation-terms.css";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import { lagosDateTime } from "@/lib/forms/vehicle-condition";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";

import {
  parseReservationWorkspace,
  validateReservationReceipt,
  type ReservationWorkspace,
} from "@/lib/admin/work-reservation-policy";
import {
  readReservationPolicyPending,
  markReservationPolicyPending,
  clearReservationPolicyPending,
  reservationPolicyFingerprint,
  redactReservationPolicyChanges,
  type ReservationPolicyPending,
} from "@/lib/admin/work-reservation-policy-pending";
import {
  draftIdentity,
  draftKey,
  forgetDraft,
  cancelDraftSubmission,
} from "@/lib/forms/drafts";

type ReservationInput = Extract<
  RequestBody<"/admin/policies", "post">,
  { kind: "VEHICLE_RESERVATION_TERMS" }
>;
function PolicyFacts({
  row,
  current = false,
}: {
  row: PolicyVersion;
  current?: boolean;
}) {
  const parsed = termsSettingsSchema.safeParse(row.settings);
  if (!parsed.success)
    return (
      <p>This revision does not contain a supported agreement or withdrawal record.</p>
    );
  return parsed.data.enabled ? (
    <>
      <h3>{parsed.data.title}</h3>
      <details className="reservation-document">
        <summary>{current ? "Read current agreement" : "Read agreement text"}</summary>
        <div
          className="agreement-text"
          tabIndex={0}
          role="region"
          aria-label="Agreement text"
        >
          {parsed.data.body}
        </div>
      </details>
    </>
  ) : (
    <>
      <h3>Availability withdrawn</h3>
      <p className="reservation-reason">{parsed.data.reason}</p>
    </>
  );
}
function ReservationVersion({ row }: { row: PolicyVersion }) {
  const [open, setOpen] = useState(false);
  const settings = termsSettingsSchema.safeParse(row.settings);
  return (
    <details
      className="reservation-version"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <strong>Revision {row.version}</strong>
        <span>
          {row.approvalStatus === "APPROVED"
            ? settings.success && !settings.data.enabled
              ? "Availability withdrawn"
              : "Approved agreement"
            : "Approval not recorded"}
        </span>
        <span>Effective {formatBusinessDate(row.effectiveAt)}</span>
      </summary>
      {open && (
        <>
          <p>Recorded {formatBusinessDate(row.recordedAt)}</p>
          <PolicyFacts row={row} />
          <p>Approval source: {row.source}</p>
          <p>Approval reference: {row.approvalEvidence ?? "Not recorded"}</p>
        </>
      )}
    </details>
  );
}
function ReservationHistory({ history }: { history: PolicyVersion[] }) {
  return (
    <details className="reservation-history">
      <summary>Agreement history</summary>
      <p>
        Latest 100 recorded revisions, newest revision first. Effective time determines
        which agreement applies.
      </p>
      {history.length === 0 && <p>No agreements have been published.</p>}
      {history.map((row) => (
        <ReservationVersion key={row.id} row={row} />
      ))}
    </details>
  );
}
function CurrentPolicy({ state }: { state: ReservationWorkspace }) {
  const settings = termsSettingsSchema.safeParse(state.current?.settings);
  const revisionStatus = (row: PolicyVersion) => {
    const parsed = termsSettingsSchema.safeParse(row.settings);
    if (row.approvalStatus !== "APPROVED") return "Approval not recorded";
    return parsed.success && !parsed.data.enabled
      ? "Availability withdrawn"
      : "Approved agreement";
  };
  const available =
    state.current?.approvalStatus === "APPROVED" &&
    settings.success &&
    settings.data.enabled;
  return (
    <>
      <section
        className="reservation-current"
        aria-labelledby="reservation-current-title"
      >
        <div className="reservation-section-heading">
          <h2 id="reservation-current-title">Current agreement</h2>
          <span className={available ? "reservation-approved" : "reservation-draft"}>
            {available ? "Available" : "Unavailable"}
          </span>
        </div>
        {state.current ? (
          <>
            <p className="reservation-meta">
              Revision {state.current.version} · Effective{" "}
              {formatBusinessDate(state.current.effectiveAt)}
            </p>
            <PolicyFacts row={state.current} current />
          </>
        ) : (
          <p>
            No agreement is effective at this check. New online reservations require an
            approved agreement.
          </p>
        )}
        <p className="reservation-checked">
          Checked {formatBusinessDate(state.evaluatedAt)}. Refresh to check scheduled
          changes.
        </p>
      </section>
      {state.nextScheduled ? (
        <details className="reservation-next">
          <summary>
            <strong>Next scheduled revision</strong>
            <span className="reservation-schedule-summary">
              Revision {state.nextScheduled.version} ·{" "}
              {revisionStatus(state.nextScheduled)}
            </span>
            <span className="reservation-schedule-summary">
              Effective {formatBusinessDate(state.nextScheduled.effectiveAt)}
            </span>
          </summary>
          <ReservationVersion row={state.nextScheduled} />
        </details>
      ) : (
        <p className="reservation-schedule">
          No future revision is scheduled at this check.
        </p>
      )}
      {state.latest && (
        <details className="reservation-next">
          <summary>
            <strong>Latest recorded revision: {state.latest.version}</strong>
            <span className="reservation-schedule-summary">
              {revisionStatus(state.latest)}
            </span>
            <span className="reservation-schedule-summary">
              Effective {formatBusinessDate(state.latest.effectiveAt)}
            </span>
          </summary>
          <ReservationVersion row={state.latest} />
        </details>
      )}
    </>
  );
}
class PreflightError extends ApiError {
  constructor() {
    super(409, {
      error: {
        code: "CONFLICT",
        message:
          "No approval was sent. Close this review, refresh the policy and review your draft.",
      },
    });
  }
}
function ReservationEditor({
  canApprove,
  refreshPermission,
  owner,
  role,
  onDenied,
}: {
  canApprove: boolean;
  refreshPermission: () => void;
  owner: string;
  role: string;
  onDenied: () => void;
}) {
  const record = useResource(
    "/admin/policies/reservation-terms/current",
    parseReservationWorkspace,
  );
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [validation, setValidation] = useState<string>();
  const [invalidField, setInvalidField] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const reviewButton = useRef<HTMLButtonElement>(null);
  const focusAfterReview = useRef(false);
  const [pending, setPending] = useState<ReservationPolicyPending>();
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState<ReservationWorkspace>();
  const [acknowledged, setAcknowledged] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string>();
  const [formRevision, setFormRevision] = useState(0);
  const [savedPolicy, setSavedPolicy] = useState<PolicyVersion>();
  const active = useRef(true),
    request = useRef<AbortController | null>(null),
    flight = useRef(false);
  const latest = record.data?.latest;
  const disabled =
    !canApprove ||
    !ready ||
    record.loading ||
    record.refreshing ||
    !!record.error ||
    !!record.refreshError ||
    !record.data ||
    !!proposal ||
    !!pending;
  useEffect(() => {
    if (proposal || (!success && record.loading) || !focusAfterReview.current) return;
    const frame = requestAnimationFrame(() => {
      if (success) document.getElementById("reservation-success-title")?.focus();
      else if (pending) document.getElementById("reservation-recovery-title")?.focus();
      else reviewButton.current?.focus();
      focusAfterReview.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [proposal, record.loading, pending, success]);
  useEffect(() => {
    active.current = true;
    queueMicrotask(() => {
      if (active.current) {
        setPending(readReservationPolicyPending(owner, role));
        setReady(true);
      }
    });
    return () => {
      active.current = false;
      request.current?.abort();
    };
  }, [owner, role]);
  useEffect(() => {
    if (record.denied) onDenied();
  }, [record.denied, onDenied]);
  function identity(signal?: AbortSignal) {
    if (!active.current || signal?.aborted || draftIdentity() !== owner + ":" + role)
      throw Error("Reservation policy account changed");
  }
  function denied(error: unknown) {
    if (error instanceof ApiError && [401, 403].includes(error.status)) {
      onDenied();
      return true;
    }
    return false;
  }
  async function fresh(signal: AbortSignal) {
    const profile = parseOwnStaffProfile(
      (await apiRequest("/staff/profile", { signal })).data,
    );
    identity(signal);
    if (
      profile.id !== owner ||
      profile.role !== role ||
      profile.status !== "ACTIVE" ||
      role !== "SUPER_ADMIN"
    )
      throw new ApiError(403, { error: { code: "FORBIDDEN" } });
    const state = parseReservationWorkspace(
      (await apiRequest("/admin/policies/reservation-terms/current", { signal })).data,
    );
    identity(signal);
    return state;
  }
  async function inspectRecovery() {
    setRecovery(undefined);
    setAcknowledged(false);
    setRecoveryError(undefined);
    setRecovering(true);
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      setRecovery(await fresh(controller.signal));
    } catch (error) {
      if (active.current && !denied(error))
        setRecoveryError(
          "Current policy could not be checked. The approval remains locked.",
        );
    } finally {
      if (active.current) setRecovering(false);
    }
  }
  function invalid(message: string, field: string) {
    setValidation(message);
    setInvalidField(field);
    document.getElementById(`reservation-${field}`)?.focus();
  }
  function review(form: FormData, submittedAt: number, expectedVersion: number) {
    if (disabled) return;
    setValidation(undefined);
    setInvalidField(undefined);
    setRecovery(undefined);
    setAcknowledged(false);
    setMessage(undefined);
    setSuccess(undefined);
    if ((latest?.version ?? 0) !== expectedVersion) {
      invalid(
        "The latest policy changed. Reload the action fields before reviewing.",
        "reload",
      );
      return;
    }
    const enabled = form.get("action") === "publish";
    const settings = termsSettingsSchema.safeParse(
      enabled
        ? { enabled, title: form.get("title"), body: form.get("body") }
        : { enabled, reason: form.get("reason") },
    );
    if (!settings.success) {
      const field = String(
        settings.error.issues[0]?.path[0] ?? (enabled ? "title" : "reason"),
      );
      invalid(settings.error.issues[0]?.message ?? "Check the agreement fields.", field);
      return;
    }
    if (form.get("approved") !== "on") {
      invalid("Confirm that this agreement or withdrawal has been approved.", "approved");
      return;
    }
    const source = String(form.get("source") ?? "").trim();
    const approvalEvidence = String(form.get("approvalEvidence") ?? "").trim();
    if (source.length < 10 || source.length > 500) {
      invalid("Describe the approval source in 10–500 characters.", "source");
      return;
    }
    if (approvalEvidence.length < 20 || approvalEvidence.length > 1000) {
      invalid(
        "Record the written approval or its reference in 20–1,000 characters.",
        "approvalEvidence",
      );
      return;
    }
    const start = String(form.get("effectiveAt") ?? "").trim();
    const immediate = start === "";
    if (
      !immediate &&
      (!lagosDateTime.safeParse(start).success ||
        Date.parse(`${start}:00+01:00`) <= submittedAt)
    ) {
      invalid(
        "Choose a future Lagos date and time, or leave it empty to apply on confirmation.",
        "effectiveAt",
      );
      return;
    }
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
          value: immediate ? "On confirmation" : formatBusinessDate(`${start}:00+01:00`),
        },
        { label: "Approval source", value: source },
        { label: "Written approval", value: approvalEvidence },
        { label: "New revision", value: String(expectedVersion + 1) },
      ],
      submit: async () => {
        if (flight.current) throw new PreflightError();
        flight.current = true;
        request.current?.abort();
        const controller = new AbortController();
        request.current = controller;
        let sent = false,
          marker: Exclude<ReservationPolicyPending, "unknown"> | undefined;
        try {
          if (readReservationPolicyPending(owner, role))
            throw Error("Earlier approval needs reconciliation");
          const current = await fresh(controller.signal);
          if ((current.latest?.version ?? 0) !== expectedVersion)
            throw Error("Policy version changed");
          const body: ReservationInput = {
            kind: "VEHICLE_RESERVATION_TERMS",
            expectedVersion,
            settings: settings.data,
            source,
            approvalEvidence,
            effectiveAt: immediate
              ? new Date().toISOString()
              : new Date(start + ":00+01:00").toISOString(),
          };
          if (!immediate && Date.parse(body.effectiveAt) <= Date.now())
            throw Error("Scheduled time has passed");
          const fingerprint = await reservationPolicyFingerprint(body);
          identity(controller.signal);
          marker = markReservationPolicyPending(owner, role, {
            expectedVersion,
            fingerprint,
          });
          setPending(marker);
          cancelDraftSubmission();
          sent = true;
          const saved = validateReservationReceipt(
            (
              await apiRequest("/admin/policies", {
                method: "POST",
                csrf: true,
                body,
                signal: controller.signal,
              })
            ).data,
            body,
            owner,
          );
          identity(controller.signal);
          clearReservationPolicyPending(owner, role, marker.token);
          setSavedPolicy(saved);
          setPending(undefined);
          forgetDraft(
            draftKey(
              owner + ":" + role,
              "/admin/reservation-terms",
              "reservation-terms-policy:v1",
            ),
          );
          setFormRevision((value) => value + 1);
          record.refresh();
        } catch (error) {
          if (!active.current || denied(error)) throw error;
          const rejected =
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500 &&
            ![408, 429].includes(error.status);
          if (!sent || rejected) {
            if (marker) clearReservationPolicyPending(owner, role, marker.token);
            setPending(readReservationPolicyPending(owner, role));
            setMessage(
              sent
                ? "The server rejected this approval. Refresh the policy before reviewing your draft again."
                : "No approval request was sent. Refresh the policy and review your draft.",
            );
            throw sent ? error : new PreflightError();
          }
          setPending(readReservationPolicyPending(owner, role));
          throw Error("Approval outcome uncertain");
        } finally {
          flight.current = false;
        }
      },
      onUncertain: () => setPending(readReservationPolicyPending(owner, role)),
      retryAfterRejection: false,
    });
  }
  return (
    <section className="reservation-workspace" aria-label="Reservation agreement review">
      <div className="reservation-toolbar">
        <div>
          <h1>Vehicle reservation agreements</h1>
          <p>
            Publish approved agreements or withdraw availability for new reservations.
          </p>
        </div>
        <button
          className="button secondary"
          disabled={record.loading || !!proposal || recovering}
          onClick={() => {
            record.refresh();
            refreshPermission();
          }}
        >
          Refresh agreements
        </button>
      </div>
      <p className="reservation-impact">
        Existing accepted documents stay unchanged. Payment policies are managed
        separately.
      </p>
      <Feedback message={record.error ?? record.refreshError} />
      <Feedback message={message} />
      {success && (
        <section className="reservation-success">
          <h2 id="reservation-success-title" tabIndex={-1}>
            Agreement publication recorded
          </h2>
          <Feedback
            message={success}
            tone="success"
            toast="Agreement publication recorded."
          />
        </section>
      )}
      {record.loading && <p role="status">Loading agreements…</p>}
      {pending && (
        <section
          className="reservation-recovery"
          aria-labelledby="reservation-recovery-title"
        >
          <h2 id="reservation-recovery-title" tabIndex={-1}>
            Approval needs reconciliation
          </h2>
          <p>
            The outcome is uncertain. Another approval is blocked, including after reload.
            Current facts alone do not prove that the earlier request succeeded.
          </p>
          <button
            className="button secondary"
            disabled={recovering || !!proposal}
            onClick={() => void inspectRecovery()}
          >
            {recovering ? "Checking current policy…" : "Check current policy"}
          </button>
          <Feedback message={recoveryError} />
          {recovery && (
            <>
              <p>
                Checked {formatBusinessDate(recovery.evaluatedAt)}. Latest recorded
                revision: {recovery.latest?.version ?? 0}.
              </p>
              <label className="reservation-ack">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                />
                I independently reconciled the earlier approval and verified that another
                change is appropriate.
              </label>
              <button
                className="button secondary"
                disabled={!acknowledged || !!proposal}
                onClick={() => {
                  try {
                    const currentMarker = readReservationPolicyPending(owner, role);
                    if (JSON.stringify(currentMarker) !== JSON.stringify(pending))
                      throw Error("Recovery changed");
                    clearReservationPolicyPending(
                      owner,
                      role,
                      pending === "unknown" ? undefined : pending.token,
                    );
                    setPending(undefined);
                    setRecovery(undefined);
                    setAcknowledged(false);
                    record.refresh();
                  } catch {
                    setRecoveryError(
                      "Recovery storage is unavailable. The approval remains locked.",
                    );
                  }
                }}
              >
                Clear reconciled approval lock
              </button>
            </>
          )}
        </section>
      )}
      {record.data && !record.denied && (
        <>
          <div className="reservation-columns">
            <div className="reservation-state">
              <CurrentPolicy state={record.data} />
              <ReservationHistory history={record.data.history} />
            </div>
            <ReservationForm
              key={formRevision}
              initial={savedPolicy ?? latest}
              latestVersion={Math.max(latest?.version ?? 0, savedPolicy?.version ?? 0)}
              disabled={disabled}
              canApprove={canApprove}
              review={review}
              reviewButton={reviewButton}
              validation={validation}
              invalidField={invalidField}
              onReload={() => {
                forgetDraft(
                  draftKey(
                    owner + ":" + role,
                    "/admin/reservation-terms",
                    "reservation-terms-policy:v1",
                  ),
                );
                setSavedPolicy(undefined);
                setFormRevision((v) => v + 1);
                setValidation(undefined);
                setInvalidField(undefined);
              }}
            />
          </div>
        </>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel={
            proposal.facts[0]?.value === "Withdraw availability"
              ? "Withdraw availability"
              : "Publish agreement"
          }
          onClose={() => {
            focusAfterReview.current = true;
            setProposal(null);
            const approval = document.getElementById(
              "reservation-approved",
            ) as HTMLInputElement | null;
            if (approval) approval.checked = false;
          }}
          onSuccess={() =>
            setSuccess(
              "Agreement publication recorded. Review its effective date in agreement history.",
            )
          }
        />
      )}
    </section>
  );
}
function ReservationForm({
  initial,
  latestVersion,
  disabled,
  canApprove,
  review,
  reviewButton,
  validation,
  invalidField,
  onReload,
}: {
  initial?: PolicyVersion | null;
  latestVersion: number;
  disabled: boolean;
  canApprove: boolean;
  review: (form: FormData, now: number, base: number) => void;
  reviewButton: React.RefObject<HTMLButtonElement | null>;
  validation?: string;
  invalidField?: string;
  onReload: () => void;
}) {
  const [base] = useState(() => ({
    version: initial?.version ?? 0,
    settings: termsSettingsSchema.safeParse(initial?.settings),
  }));
  const previous = base.settings.success ? base.settings.data : undefined;
  const [baseVersion, setBaseVersion] = useState(base.version);
  const [action, setAction] = useState(
    previous?.enabled === false ? "withdraw" : "publish",
  );
  const stale = baseVersion !== latestVersion;
  const errorProps = (name: string) => ({
    "aria-invalid": invalidField === name,
    "aria-describedby": invalidField === name ? "reservation-validation" : undefined,
  });
  return (
    <form
      data-draft-key="reservation-terms-policy:v1"
      className="reservation-form"
      onSubmit={(event) => {
        event.preventDefault();
        review(new FormData(event.currentTarget), Date.now(), baseVersion);
      }}
    >
      <h2>Publish or withdraw an agreement</h2>
      <p className="reservation-draft-source">
        Based on recorded revision {baseVersion}. Refreshing retains your unsent draft.
      </p>
      {stale && (
        <div className="reservation-stale">
          <p>
            The latest recorded version changed. Review the current facts, then reload the
            action fields to start from version {latestVersion}. Reloading replaces your
            unsent fields.
          </p>
          <button
            id="reservation-reload"
            className="button secondary"
            type="button"
            disabled={disabled}
            onClick={onReload}
          >
            Reload action fields
          </button>
        </div>
      )}
      {!canApprove && (
        <Feedback message="Your current permission must be verified before approval." />
      )}
      <input
        hidden
        aria-hidden="true"
        tabIndex={-1}
        data-draft-context
        name="policyBaseVersion"
        value={String(baseVersion)}
        onChange={(event) => {
          const value = Number(event.target.value);
          setBaseVersion(Number.isSafeInteger(value) && value >= 0 ? value : -1);
        }}
      />
      <fieldset disabled={disabled} className="reservation-edit-fields">
        <legend className="sr-only">Reservation policy approval settings</legend>
        <fieldset>
          <legend className="sr-only">Agreement action</legend>
          <div className="field">
            <label htmlFor="reservation-action">Publication action</label>
            <select
              id="reservation-action"
              name="action"
              value={action}
              onChange={(event) => setAction(event.target.value)}
            >
              <option value="publish">Publish an approved agreement</option>
              <option value="withdraw">Withdraw availability</option>
            </select>
          </div>
          <div hidden={action !== "publish"}>
            <div className="field">
              <label htmlFor="reservation-title">Agreement title</label>
              <input
                id="reservation-title"
                name="title"
                required={action === "publish"}
                maxLength={200}
                defaultValue={previous?.enabled ? previous.title : ""}
                {...errorProps("title")}
              />
            </div>
            <div className="field">
              <label htmlFor="reservation-body">Approved agreement text</label>
              <textarea
                id="reservation-body"
                className="reservation-body"
                name="body"
                rows={8}
                required={action === "publish"}
                maxLength={50000}
                defaultValue={previous?.enabled ? previous.body : ""}
                {...errorProps("body")}
                aria-describedby="reservation-body-help reservation-validation"
              />
              <span id="reservation-body-help" className="field-hint">
                Paste the exact approved plain text. No sample agreement is provided.
              </span>
            </div>
          </div>
          <div hidden={action !== "withdraw"}>
            <div className="field">
              <label htmlFor="reservation-reason">Withdrawal reason</label>
              <textarea
                id="reservation-reason"
                name="reason"
                required={action === "withdraw"}
                maxLength={1000}
                defaultValue={previous && !previous.enabled ? previous.reason : ""}
                {...errorProps("reason")}
              />
            </div>
            <p className="reservation-impact">
              Scheduled future revisions still take effect on their recorded dates.
              Existing accepted documents stay unchanged.
            </p>
          </div>
        </fieldset>
        <fieldset>
          <legend>Written approval</legend>
          <p>Record the approval for this version.</p>
          <div className="reservation-fields">
            <div className="field">
              <label htmlFor="reservation-effectiveAt">
                Effective date and time (Lagos time, optional)
              </label>
              <input
                id="reservation-effectiveAt"
                type="datetime-local"
                name="effectiveAt"
                {...errorProps("effectiveAt")}
                aria-describedby="reservation-effective-help reservation-validation"
              />
              <span id="reservation-effective-help" className="field-hint">
                Leave empty to apply on confirmation, or choose a future time.
              </span>
            </div>
            <div className="field">
              <label htmlFor="reservation-source">Approval source</label>
              <input
                id="reservation-source"
                name="source"
                required
                minLength={10}
                maxLength={500}
                {...errorProps("source")}
              />
            </div>
            <div className="field reservation-evidence">
              <label htmlFor="reservation-approvalEvidence">
                Written approval reference
              </label>
              <textarea
                id="reservation-approvalEvidence"
                name="approvalEvidence"
                required
                minLength={20}
                maxLength={1000}
                {...errorProps("approvalEvidence")}
              />
            </div>
          </div>
        </fieldset>
        <div id="reservation-validation">
          <Feedback message={validation} />
        </div>
        <label className="check-label" htmlFor="reservation-approved">
          <input
            id="reservation-approved"
            data-no-draft
            type="checkbox"
            name="approved"
            required
            {...errorProps("approved")}
          />
          I confirm this agreement or withdrawal has been approved.
        </label>
        <button ref={reviewButton} className="button" disabled={stale}>
          Review publication
        </button>
      </fieldset>
    </form>
  );
}
export function ReservationTermsPolicy() {
  const session = useAccountSession();
  const [denied, setDenied] = useState(false);
  const profile = useResource(
    session && session.user.role === "SUPER_ADMIN" ? "/staff/profile" : null,
    parseOwnStaffProfile,
  );
  const identityMatches =
    profile.data?.id === session?.user.id && profile.data?.role === session?.user.role;
  const canApprove =
    identityMatches &&
    !profile.error &&
    !profile.refreshError &&
    !profile.refreshing &&
    !profile.loading &&
    profile.data?.status === "ACTIVE" &&
    session?.user.role === "SUPER_ADMIN";
  const canRead =
    identityMatches &&
    !profile.denied &&
    !denied &&
    profile.data?.status === "ACTIVE" &&
    session?.user.role === "SUPER_ADMIN";
  return (
    <div className="work-reservation-policy">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <ol className="reservation-breadcrumb-list">
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">Reservation agreements</span>
          </li>
        </ol>
      </nav>
      <Feedback message={profile.error ?? profile.refreshError} />
      {profile.loading && (
        <p role="status">Checking your reservation-policy permission…</p>
      )}
      {canRead ? (
        <ReservationEditor
          canApprove={canApprove}
          key={session!.user.id + ":" + session!.user.role}
          owner={session!.user.id}
          role={session!.user.role}
          refreshPermission={profile.refresh}
          onDenied={() => {
            redactReservationPolicyChanges();
            setDenied(true);
          }}
        />
      ) : (
        !profile.loading && (
          <>
            <Feedback message="Reservation policy requires an active, verified Super Admin account with MFA." />
            <button
              className="button secondary"
              onClick={() => {
                setDenied(false);
                profile.refresh();
              }}
            >
              Refresh permission
            </button>
          </>
        )
      )}
    </div>
  );
}
