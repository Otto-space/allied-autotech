"use client";
import { useEffect, useRef, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api/client";
import { parseOwnStaffProfile } from "@/lib/api/capability-schemas";
import type { RequestBody } from "@/lib/api/contracts";
import type { PolicyVersion } from "@/lib/api/policy-schemas";
import {
  bankRefundClockSettingsSchema,
  refundStartEvents,
  weekDays,
} from "@/lib/api/policy-schemas";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import { lagosDateTime } from "@/lib/forms/vehicle-condition";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";

import {
  parseRefundTimingWorkspace,
  validateRefundTimingReceipt,
  type RefundTimingWorkspace,
} from "@/lib/admin/work-refund-timing";
import {
  readRefundTimingPolicyPending,
  markRefundTimingPolicyPending,
  clearRefundTimingPolicyPending,
  refundTimingPolicyFingerprint,
  redactRefundTimingPolicyChanges,
  type RefundTimingPolicyPending,
} from "@/lib/admin/work-refund-timing-pending";
import {
  draftIdentity,
  draftKey,
  forgetDraft,
  cancelDraftSubmission,
} from "@/lib/forms/drafts";

type RefundTimingInput = Extract<
  RequestBody<"/admin/policies", "post">,
  { kind: "BANK_REFUND_CLOCK" }
>;
const counting =
  "10 banking days, excluding the start date, due at the same Lagos time. Selected weekdays count; listed holidays do not.";
function timingFacts(settings: RefundTimingInput["settings"]) {
  return [
    { label: "Clock starts when", value: refundStartEvents[settings.startEvent] },
    { label: "Counting rule", value: counting },
    {
      label: "Banking days",
      value: settings.bankingDays.map((day) => weekDays[day]).join(", "),
    },
    { label: "Excluded dates", value: settings.holidays.join(", ") || "None recorded" },
  ];
}
function PolicyFacts({ row }: { row: PolicyVersion }) {
  const parsed = bankRefundClockSettingsSchema.safeParse(row.settings);
  if (!parsed.success)
    return <p>This revision does not contain a complete supported banking calendar.</p>;
  return (
    <dl className="refund-timing-facts">
      {timingFacts(parsed.data)
        .slice(0, 3)
        .map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      <div>
        <dt>Excluded dates</dt>
        <dd>
          {parsed.data.holidays.length ? (
            <details>
              <summary>
                {parsed.data.holidays.length} excluded{" "}
                {parsed.data.holidays.length === 1 ? "date" : "dates"}
              </summary>
              <p className="refund-timing-holiday-list">
                {parsed.data.holidays.join(", ")}
              </p>
            </details>
          ) : (
            "None recorded"
          )}
        </dd>
      </div>
    </dl>
  );
}
function RefundTimingVersion({ row }: { row: PolicyVersion }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="refund-timing-version"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <strong>Revision {row.version}</strong>
        <span>
          {row.approvalStatus === "APPROVED"
            ? "Approved calendar"
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
function RefundTimingHistory({ history }: { history: PolicyVersion[] }) {
  return (
    <details className="refund-timing-history">
      <summary>Refund timing history</summary>
      <p>
        Latest 100 recorded revisions, newest first. The highest approved version
        effective when a bank refund was requested supplies its calendar. A lower version
        does not supersede a higher version when its scheduled date arrives. Saved
        deadlines keep their original policy.
      </p>
      {history.length === 0 && <p>No bank refund timing policy has been recorded.</p>}
      {history.map((row) => (
        <RefundTimingVersion key={row.id} row={row} />
      ))}
    </details>
  );
}
function CurrentPolicy({ state }: { state: RefundTimingWorkspace }) {
  const supported = bankRefundClockSettingsSchema.safeParse(
    state.current?.settings,
  ).success;
  return (
    <>
      <section
        className="refund-timing-current"
        aria-labelledby="refund-timing-current-title"
      >
        <div className="refund-timing-section-heading">
          <h2 id="refund-timing-current-title">Current banking calendar</h2>
          <span className="refund-timing-draft">
            {supported && state.current?.approvalStatus === "APPROVED"
              ? "Approved"
              : "Unavailable"}
          </span>
        </div>
        {state.current ? (
          <>
            <p className="refund-timing-meta">
              Revision {state.current.version} · Effective{" "}
              {formatBusinessDate(state.current.effectiveAt)}
            </p>
            <PolicyFacts row={state.current} />
          </>
        ) : (
          <p>
            No approved banking calendar is effective at this check. No approved deadline
            can be assigned to a new manual bank refund without a supported calendar.
          </p>
        )}
        <p className="refund-timing-checked">
          Checked {formatBusinessDate(state.evaluatedAt)}. Refresh to check scheduled
          changes.
        </p>
      </section>
      {state.nextScheduled ? (
        <details className="refund-timing-next">
          <summary>
            <strong>Next scheduled revision</strong>
            <span className="refund-timing-schedule-summary">
              Revision {state.nextScheduled.version} · Approved calendar
            </span>
            <span className="refund-timing-schedule-summary">
              Effective {formatBusinessDate(state.nextScheduled.effectiveAt)}
            </span>
          </summary>
          <RefundTimingVersion row={state.nextScheduled} />
        </details>
      ) : (
        <p className="refund-timing-schedule">
          No future revision will supersede the current calendar at this check.
        </p>
      )}
      {state.latest && (
        <details className="refund-timing-next">
          <summary>
            <strong>Latest recorded revision: {state.latest.version}</strong>
            <span className="refund-timing-schedule-summary">
              {state.latest.approvalStatus === "APPROVED"
                ? "Approved calendar"
                : "Approval not recorded"}
            </span>
            <span className="refund-timing-schedule-summary">
              Effective {formatBusinessDate(state.latest.effectiveAt)}
            </span>
          </summary>
          <RefundTimingVersion row={state.latest} />
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
function RefundTimingEditor({
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
    "/admin/policies/refund-timing/current",
    parseRefundTimingWorkspace,
  );
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [validation, setValidation] = useState<string>();
  const [invalidField, setInvalidField] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const reviewButton = useRef<HTMLButtonElement>(null);
  const focusAfterReview = useRef(false);
  const [pending, setPending] = useState<RefundTimingPolicyPending>();
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState<RefundTimingWorkspace>();
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
      if (success) document.getElementById("refund-timing-success-title")?.focus();
      else if (pending) document.getElementById("refund-timing-recovery-title")?.focus();
      else reviewButton.current?.focus();
      focusAfterReview.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [proposal, record.loading, pending, success]);
  useEffect(() => {
    active.current = true;
    queueMicrotask(() => {
      if (active.current) {
        setPending(readRefundTimingPolicyPending(owner, role));
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
      throw Error("RefundTiming policy account changed");
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
    const state = parseRefundTimingWorkspace(
      (await apiRequest("/admin/policies/refund-timing/current", { signal })).data,
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
    document.getElementById(`refund-timing-${field}`)?.focus();
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
    const settings = bankRefundClockSettingsSchema.safeParse({
      startEvent: form.get("startEvent"),
      businessDays: 10,
      countingConvention: "EXCLUDE_START_SAME_LOCAL_TIME",
      bankingDays: form.getAll("bankingDays").map(Number),
      holidays: [
        ...new Set(
          String(form.get("holidays") ?? "")
            .split(/[\s,]+/)
            .filter(Boolean),
        ),
      ].sort(),
      timezone: "Africa/Lagos",
    });
    if (!settings.success) {
      const field = String(settings.error.issues[0]?.path[0] ?? "holidays");
      invalid(
        field === "startEvent"
          ? "Choose the approved event that starts the refund clock."
          : field === "bankingDays"
            ? "Choose at least one approved banking day."
            : "Enter valid holiday dates in YYYY-MM-DD format, up to 366 dates.",
        field === "bankingDays" ? "day-0" : field,
      );
      return;
    }
    if (form.get("calendarApproved") !== "on") {
      invalid(
        "Confirm that the banking days and holiday list have been approved.",
        "approved",
      );
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
      title: "Approve bank refund timing?",
      description:
        "This records the approved timing for manual bank refunds requested once effective. The backend records a deadline after the chosen event occurs. Publishing does not move money, confirm receipt or recalculate existing saved deadlines.",
      facts: [
        ...timingFacts(settings.data),
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
          marker: Exclude<RefundTimingPolicyPending, "unknown"> | undefined;
        try {
          if (readRefundTimingPolicyPending(owner, role))
            throw Error("Earlier approval needs reconciliation");
          const current = await fresh(controller.signal);
          if ((current.latest?.version ?? 0) !== expectedVersion)
            throw Error("Policy version changed");
          const body: RefundTimingInput = {
            kind: "BANK_REFUND_CLOCK",
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
          const fingerprint = await refundTimingPolicyFingerprint(body);
          identity(controller.signal);
          marker = markRefundTimingPolicyPending(owner, role, {
            expectedVersion,
            fingerprint,
          });
          setPending(marker);
          cancelDraftSubmission();
          sent = true;
          const saved = validateRefundTimingReceipt(
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
          clearRefundTimingPolicyPending(owner, role, marker.token);
          setSavedPolicy(saved);
          setPending(undefined);
          forgetDraft(
            draftKey(
              owner + ":" + role,
              "/admin/refund-timing",
              "refund-timing-policy:1",
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
            if (marker) clearRefundTimingPolicyPending(owner, role, marker.token);
            setPending(readRefundTimingPolicyPending(owner, role));
            setMessage(
              sent
                ? "The server rejected this approval. Refresh the policy before reviewing your draft again."
                : "No approval request was sent. Refresh the policy and review your draft.",
            );
            throw sent ? error : new PreflightError();
          }
          setPending(readRefundTimingPolicyPending(owner, role));
          throw Error("Approval outcome uncertain");
        } finally {
          flight.current = false;
        }
      },
      onUncertain: () => setPending(readRefundTimingPolicyPending(owner, role)),
      retryAfterRejection: false,
    });
  }
  return (
    <section className="refund-timing-workspace" aria-label="Bank refund timing review">
      <div className="refund-timing-toolbar">
        <div>
          <h1>Bank refund timing</h1>
          <p>
            Record the approved start event and banking calendar for manual bank refund
            deadlines.
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
          Refresh refund timing
        </button>
      </div>
      <p className="refund-timing-impact">
        Policies apply to new manual bank refunds. Saved deadlines keep their original
        policy.
      </p>
      <Feedback message={record.error ?? record.refreshError} />
      <Feedback message={message} />
      {success && (
        <section className="refund-timing-success">
          <h2 id="refund-timing-success-title" tabIndex={-1}>
            Bank refund timing approved
          </h2>
          <Feedback
            message={success}
            tone="success"
            toast="Bank refund timing approved."
          />
        </section>
      )}
      {record.loading && <p role="status">Loading refund timing…</p>}
      {pending && (
        <section
          className="refund-timing-recovery"
          aria-labelledby="refund-timing-recovery-title"
        >
          <h2 id="refund-timing-recovery-title" tabIndex={-1}>
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
              <label className="refund-timing-ack">
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
                    const currentMarker = readRefundTimingPolicyPending(owner, role);
                    if (JSON.stringify(currentMarker) !== JSON.stringify(pending))
                      throw Error("Recovery changed");
                    clearRefundTimingPolicyPending(
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
          <div className="refund-timing-columns">
            <div className="refund-timing-state">
              <CurrentPolicy state={record.data} />
            </div>
            <RefundTimingForm
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
                    "/admin/refund-timing",
                    "refund-timing-policy:1",
                  ),
                );
                setSavedPolicy(undefined);
                setFormRevision((v) => v + 1);
                setValidation(undefined);
                setInvalidField(undefined);
              }}
            />
          </div>
          <RefundTimingHistory history={record.data.history} />
        </>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel="Approve refund timing"
          onClose={() => {
            focusAfterReview.current = true;
            setProposal(null);
            const approval = document.getElementById(
              "refund-timing-approved",
            ) as HTMLInputElement | null;
            if (approval) approval.checked = false;
          }}
          onSuccess={() =>
            setSuccess(
              "Bank refund timing approved. Review its effective date in refund timing history.",
            )
          }
        />
      )}
    </section>
  );
}
function RefundTimingForm({
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
    settings: bankRefundClockSettingsSchema.safeParse(initial?.settings),
  }));
  const previous = base.settings.success ? base.settings.data : undefined;
  const [baseVersion, setBaseVersion] = useState(base.version);
  const stale = baseVersion !== latestVersion;
  const errorProps = (name: string) => ({
    "aria-invalid": invalidField === name,
    "aria-describedby": invalidField === name ? "refund-timing-validation" : undefined,
  });
  return (
    <form
      data-draft-key="refund-timing-policy:1"
      className="refund-timing-form"
      onSubmit={(event) => {
        event.preventDefault();
        review(new FormData(event.currentTarget), Date.now(), baseVersion);
      }}
    >
      <h2>Approve a calendar</h2>
      <p className="refund-timing-draft-source">
        Based on recorded revision {baseVersion}. Refreshing retains your unsent draft.
      </p>
      {stale && (
        <div className="refund-timing-stale">
          <p>
            The latest recorded version changed. Review the current facts, then reload the
            action fields to start from version {latestVersion}. Reloading replaces your
            unsent fields.
          </p>
          <button
            id="refund-timing-reload"
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
      <fieldset disabled={disabled} className="refund-timing-edit-fields">
        <legend className="sr-only">Bank refund timing approval settings</legend>
        <fieldset>
          <legend>
            <span className="refund-timing-step">01</span> Banking calendar
          </legend>
          <p>{counting}</p>
          <div className="field">
            <label htmlFor="refund-timing-startEvent">Clock starts when</label>
            <select
              id="refund-timing-startEvent"
              name="startEvent"
              required
              defaultValue={previous?.startEvent ?? ""}
              {...errorProps("startEvent")}
            >
              <option value="">Choose the approved start event</option>
              {Object.entries(refundStartEvents).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <fieldset className="refund-timing-weekdays">
            <legend>Banking days</legend>
            <div className="refund-timing-day-grid">
              {weekDays.map((day, index) => (
                <label
                  className="check-label"
                  key={day}
                  htmlFor={`refund-timing-day-${index}`}
                >
                  <input
                    id={`refund-timing-day-${index}`}
                    type="checkbox"
                    name="bankingDays"
                    value={index}
                    defaultChecked={previous?.bankingDays.includes(index) ?? false}
                    {...errorProps("day-0")}
                  />
                  {day}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="field">
            <label htmlFor="refund-timing-holidays">
              Excluded holiday dates (optional)
            </label>
            <textarea
              id="refund-timing-holidays"
              name="holidays"
              rows={3}
              defaultValue={previous?.holidays.join("\n") ?? ""}
              {...errorProps("holidays")}
              aria-describedby="refund-timing-holidays-help refund-timing-validation"
            />
            <span className="field-hint" id="refund-timing-holidays-help">
              Use YYYY-MM-DD, one date per line or separated by commas. Up to 366 dates.
              Leave empty only if no holidays are excluded by the approved calendar.
            </span>
          </div>
          <label className="check-label" htmlFor="refund-timing-approved">
            <input
              id="refund-timing-approved"
              data-no-draft
              type="checkbox"
              name="calendarApproved"
              required
              {...errorProps("approved")}
            />
            I confirm that these banking days and holiday dates are approved.
          </label>
        </fieldset>
        <fieldset>
          <legend>
            <span className="refund-timing-step">02</span> Effective date
          </legend>
          <div className="field">
            <label htmlFor="refund-timing-effectiveAt">
              Effective date and time (Lagos time, optional)
            </label>
            <input
              id="refund-timing-effectiveAt"
              name="effectiveAt"
              type="datetime-local"
              {...errorProps("effectiveAt")}
              aria-describedby="refund-timing-effective-help refund-timing-validation"
            />
            <span id="refund-timing-effective-help" className="field-hint">
              Leave empty to apply on confirmation, or schedule a future change.
            </span>
          </div>
        </fieldset>
        <fieldset>
          <legend>
            <span className="refund-timing-step">03</span> Approval record
          </legend>
          <div className="field">
            <label htmlFor="refund-timing-source">Approval source</label>
            <input
              id="refund-timing-source"
              name="source"
              required
              minLength={10}
              maxLength={500}
              {...errorProps("source")}
              aria-describedby="refund-timing-source-help refund-timing-validation"
            />
            <span id="refund-timing-source-help" className="field-hint">
              Describe the approval source in 10–500 characters.
            </span>
          </div>
          <div className="field">
            <label htmlFor="refund-timing-approvalEvidence">
              Written approval or reference
            </label>
            <textarea
              id="refund-timing-approvalEvidence"
              name="approvalEvidence"
              required
              minLength={20}
              maxLength={1000}
              {...errorProps("approvalEvidence")}
              aria-describedby="refund-timing-evidence-help refund-timing-validation"
            />
            <span id="refund-timing-evidence-help" className="field-hint">
              Record the written approval or its reference in 20–1,000 characters.
            </span>
          </div>
        </fieldset>
        <div id="refund-timing-validation">
          <Feedback message={validation} />
        </div>
        <button ref={reviewButton} className="button" disabled={stale}>
          Review refund timing
        </button>
      </fieldset>
    </form>
  );
}
export function RefundTimingPolicy() {
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
    <div className="work-refund-timing">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <ol className="refund-timing-breadcrumb-list">
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">Bank refund timing</span>
          </li>
        </ol>
      </nav>
      <Feedback message={profile.error ?? profile.refreshError} />
      {profile.loading && (
        <p role="status">Checking your refund-timing-policy permission…</p>
      )}
      {canRead ? (
        <RefundTimingEditor
          canApprove={canApprove}
          key={session!.user.id + ":" + session!.user.role}
          owner={session!.user.id}
          role={session!.user.role}
          refreshPermission={profile.refresh}
          onDenied={() => {
            redactRefundTimingPolicyChanges();
            setDenied(true);
          }}
        />
      ) : (
        !profile.loading && (
          <>
            <Feedback message="Bank refund timing requires an active, verified Super Admin account with MFA." />
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
