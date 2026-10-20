"use client";
import { useEffect, useRef, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api/client";
import { parseOwnStaffProfile } from "@/lib/api/capability-schemas";
import type { RequestBody } from "@/lib/api/contracts";
import type { PolicyVersion } from "@/lib/api/policy-schemas";
import { retentionSettingsSchema } from "@/lib/api/operational-policy-schemas";
import { RetentionRuleFields } from "./retention-rule-fields";
import {
  retentionRecordTypes,
  retentionDispositions,
} from "@/lib/api/operational-policy-schemas";
import { operationalFormSettings, operationalFacts } from "./operational-policy-fields";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import { lagosDateTime } from "@/lib/forms/vehicle-condition";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";

import {
  parseRetentionWorkspace,
  validateRetentionReceipt,
  type RetentionWorkspace,
} from "@/lib/admin/work-retention-policy";
import {
  readRetentionPolicyPending,
  markRetentionPolicyPending,
  clearRetentionPolicyPending,
  retentionPolicyFingerprint,
  redactRetentionPolicyChanges,
  type RetentionPolicyPending,
} from "@/lib/admin/work-retention-policy-pending";
import {
  draftIdentity,
  draftKey,
  forgetDraft,
  cancelDraftSubmission,
} from "@/lib/forms/drafts";

type RetentionInput = Extract<
  RequestBody<"/admin/policies", "post">,
  { kind: "RETENTION" }
>;
function PolicyFacts({
  row,
  expandFirst = false,
}: {
  row: PolicyVersion;
  expandFirst?: boolean;
}) {
  const parsed = retentionSettingsSchema.safeParse(row.settings);
  if (!parsed.success)
    return (
      <p>
        This draft or older version does not contain all settings required by the current
        approval form.
      </p>
    );
  return (
    <div className="retention-recorded-rules">
      <p>Deletion and anonymization remain disabled.</p>
      {parsed.data.records.map((rule, index) => (
        <details
          key={index}
          className="retention-recorded-rule"
          open={expandFirst && index === 0}
        >
          <summary>
            <strong>
              Rule {index + 1}: {retentionRecordTypes[rule.recordType]}
            </strong>
            <span>
              {rule.retentionMonths} months &middot;{" "}
              {retentionDispositions[rule.disposition]}
            </span>
          </summary>
          <dl className="retention-facts">
            <div>
              <dt>Period starts from</dt>
              <dd>{rule.startEvent}</dd>
            </div>
            <div>
              <dt>Disposition after the period</dt>
              <dd>{retentionDispositions[rule.disposition]}</dd>
            </div>
            <div>
              <dt>Approved legal basis</dt>
              <dd>{rule.legalBasis}</dd>
            </div>
          </dl>
        </details>
      ))}
    </div>
  );
}
function RetentionVersion({ row }: { row: PolicyVersion }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="retention-version"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <strong>Version {row.version}</strong>
        <span>
          {row.approvalStatus === "APPROVED"
            ? "Approved"
            : row.approvalStatus.replaceAll("_", " ").toLowerCase()}
        </span>
        <span>Effective {formatBusinessDate(row.effectiveAt)}</span>
      </summary>
      {open && (
        <>
          <p>Recorded {formatBusinessDate(row.recordedAt)}</p>
          <PolicyFacts row={row} />
          <p>Approval source: {row.source}</p>
          <p>Approval record: {row.approvalEvidence ?? "Not recorded"}</p>
        </>
      )}
    </details>
  );
}
function RetentionHistory({ history }: { history: PolicyVersion[] }) {
  return (
    <details className="retention-history">
      <summary>Retention policy history</summary>
      <p>
        Latest 100 recorded versions, newest version first. Effective time determines
        which policy applies.
      </p>
      {history.length === 0 && <p>No retention policy has been recorded.</p>}
      {history.map((row) => (
        <RetentionVersion row={row} key={row.id} />
      ))}
    </details>
  );
}
function CurrentPolicy({ state }: { state: RetentionWorkspace }) {
  return (
    <>
      <section className="retention-current" aria-labelledby="retention-current-title">
        <div className="retention-section-heading">
          <h2 id="retention-current-title">Current policy</h2>
          {state.current && (
            <span
              className={
                state.current.approvalStatus === "APPROVED"
                  ? "retention-approved"
                  : "retention-draft"
              }
            >
              {state.current.approvalStatus === "APPROVED"
                ? "Approved"
                : "Approval not recorded"}
            </span>
          )}
        </div>
        {state.current ? (
          <>
            <p className="retention-meta">
              Version {state.current.version} · Effective{" "}
              {formatBusinessDate(state.current.effectiveAt)}
            </p>
            <PolicyFacts row={state.current} expandFirst />
          </>
        ) : (
          <p>No retention policy is effective at this check.</p>
        )}
        <p className="retention-checked">
          Checked {formatBusinessDate(state.evaluatedAt)}. Refresh to check for scheduled
          changes.
        </p>
      </section>
      {state.nextScheduled && (
        <details className="retention-next">
          <summary>Next scheduled policy settings</summary>
          <PolicyFacts row={state.nextScheduled} />
        </details>
      )}
      <dl className="retention-schedule">
        <div>
          <dt>Next scheduled</dt>
          <dd>
            {state.nextScheduled
              ? "Version " +
                state.nextScheduled.version +
                " · " +
                formatBusinessDate(state.nextScheduled.effectiveAt)
              : "No scheduled version"}
          </dd>
        </div>
        <div>
          <dt>Latest recorded</dt>
          <dd>
            {state.latest
              ? "Latest recorded version: " + state.latest.version + "."
              : "No versions recorded"}
          </dd>
        </div>
      </dl>
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
function RetentionEditor({
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
    "/admin/policies/retention/current",
    parseRetentionWorkspace,
  );
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [validation, setValidation] = useState<string>();
  const [invalidField, setInvalidField] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const reviewButton = useRef<HTMLButtonElement>(null);
  const focusAfterReview = useRef(false);
  const [pending, setPending] = useState<RetentionPolicyPending>();
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState<RetentionWorkspace>();
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
      if (success) document.getElementById("retention-success-title")?.focus();
      else if (pending) document.getElementById("retention-recovery-title")?.focus();
      else reviewButton.current?.focus();
      focusAfterReview.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [proposal, record.loading, pending, success]);
  useEffect(() => {
    active.current = true;
    queueMicrotask(() => {
      if (active.current) {
        setPending(readRetentionPolicyPending(owner, role));
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
      throw Error("Retention policy account changed");
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
    const state = parseRetentionWorkspace(
      (await apiRequest("/admin/policies/retention/current", { signal })).data,
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
    document.getElementById(`retention-${field}`)?.focus();
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
    const settings = retentionSettingsSchema.safeParse(
      operationalFormSettings("RETENTION", form),
    );
    if (!settings.success) {
      const issue = settings.error.issues[0],
        keys = form.getAll("recordKey");
      const field =
        String(keys[Number(issue?.path[1] ?? 0)] ?? "retention.0") +
        "-" +
        String(issue?.path[2] ?? "recordType");
      setValidation(
        "Complete each retention rule: a category, 1-1,200 whole months, a 5-200-character start event, disposition and 20-1,000-character legal basis.",
      );
      setInvalidField(field);
      document.getElementById(field)?.focus();
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
      title: "Approve this retention policy?",
      description:
        "Deletion and anonymization remain disabled. Publishing records approved retention rules; it does not remove records, release holds or approve a privacy request.",
      facts: [
        ...operationalFacts("RETENTION", settings.data, form),
        {
          label: "Effective",
          value: immediate ? "On confirmation" : formatBusinessDate(`${start}:00+01:00`),
        },
        { label: "Approval source", value: source },
        { label: "Written approval", value: approvalEvidence },
        { label: "New version", value: String(expectedVersion + 1) },
      ],
      submit: async () => {
        if (flight.current) throw new PreflightError();
        flight.current = true;
        request.current?.abort();
        const controller = new AbortController();
        request.current = controller;
        let sent = false,
          marker: Exclude<RetentionPolicyPending, "unknown"> | undefined;
        try {
          if (readRetentionPolicyPending(owner, role))
            throw Error("Earlier approval needs reconciliation");
          const current = await fresh(controller.signal);
          if ((current.latest?.version ?? 0) !== expectedVersion)
            throw Error("Policy version changed");
          const body: RetentionInput = {
            kind: "RETENTION",
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
          const fingerprint = await retentionPolicyFingerprint(body);
          identity(controller.signal);
          marker = markRetentionPolicyPending(owner, role, {
            expectedVersion,
            fingerprint,
          });
          setPending(marker);
          cancelDraftSubmission();
          sent = true;
          const saved = validateRetentionReceipt(
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
          clearRetentionPolicyPending(owner, role, marker.token);
          setSavedPolicy(saved);
          setPending(undefined);
          forgetDraft(
            draftKey(owner + ":" + role, "/admin/retention-policy", "retention-policy:1"),
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
            if (marker) clearRetentionPolicyPending(owner, role, marker.token);
            setPending(readRetentionPolicyPending(owner, role));
            setMessage(
              sent
                ? "The server rejected this approval. Refresh the policy before reviewing your draft again."
                : "No approval request was sent. Refresh the policy and review your draft.",
            );
            throw sent ? error : new PreflightError();
          }
          setPending(readRetentionPolicyPending(owner, role));
          throw Error("Approval outcome uncertain");
        } finally {
          flight.current = false;
        }
      },
      onUncertain: () => setPending(readRetentionPolicyPending(owner, role)),
      retryAfterRejection: false,
    });
  }
  return (
    <section className="retention-workspace" aria-label="Retention policy review">
      <div className="retention-toolbar">
        <div>
          <h1>Retention policy</h1>
          <p>Manage approved retention rules and written approval.</p>
        </div>
        <button
          className="button secondary"
          disabled={record.loading || !!proposal || recovering}
          onClick={() => {
            record.refresh();
            refreshPermission();
          }}
        >
          Refresh
        </button>
      </div>
      <p className="retention-impact">
        Deletion and anonymization remain disabled. Publishing does not remove records,
        release holds or approve a privacy request.
      </p>
      <Feedback message={record.error ?? record.refreshError} />
      <Feedback message={message} />
      {success && (
        <section className="retention-success">
          <h2 id="retention-success-title" tabIndex={-1}>
            Retention policy recorded
          </h2>
          <Feedback message={success} tone="success" toast="Retention policy approved." />
        </section>
      )}
      {record.loading && <p role="status">Loading retention policy…</p>}
      {pending && (
        <section
          className="retention-recovery"
          aria-labelledby="retention-recovery-title"
        >
          <h2 id="retention-recovery-title" tabIndex={-1}>
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
                version: {recovery.latest?.version ?? 0}.
              </p>
              <label className="retention-ack">
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
                    const currentMarker = readRetentionPolicyPending(owner, role);
                    if (JSON.stringify(currentMarker) !== JSON.stringify(pending))
                      throw Error("Recovery changed");
                    clearRetentionPolicyPending(
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
          <div className="retention-columns">
            <div className="retention-state">
              <CurrentPolicy state={record.data} />
              <RetentionHistory history={record.data.history} />
            </div>
            <RetentionForm
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
                    "/admin/retention-policy",
                    "retention-policy:1",
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
          confirmLabel="Approve retention policy"
          onClose={() => {
            focusAfterReview.current = true;
            setProposal(null);
          }}
          onSuccess={() =>
            setSuccess(
              "Retention policy approved. Review its effective date in policy history.",
            )
          }
        />
      )}
    </section>
  );
}
function RetentionForm({
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
    settings: retentionSettingsSchema.safeParse(initial?.settings),
  }));
  const previous = base.settings.success ? base.settings.data : undefined;
  const [baseVersion, setBaseVersion] = useState(base.version);
  const stale = baseVersion !== latestVersion;
  const errorProps = (name: string) => ({
    "aria-invalid": invalidField === name,
    "aria-describedby": invalidField === name ? "retention-validation" : undefined,
  });
  return (
    <form
      data-draft-key="retention-policy:1"
      className="retention-form"
      onSubmit={(event) => {
        event.preventDefault();
        review(new FormData(event.currentTarget), Date.now(), baseVersion);
      }}
    >
      <h2>Approve a new version</h2>
      <p className="retention-draft-source">
        Based on recorded version {baseVersion}. Refreshing retains your unsent draft.
      </p>
      {stale && (
        <div className="retention-stale">
          <p>
            The latest recorded version changed. Review the current facts, then reload the
            action fields to start from version {latestVersion}. Reloading replaces your
            unsent fields.
          </p>
          <button
            id="retention-reload"
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
      <fieldset disabled={disabled} className="retention-edit-fields">
        <legend className="sr-only">Retention policy approval settings</legend>
        <RetentionRuleFields initial={previous} invalidField={invalidField} />
        <fieldset>
          <legend>Written approval</legend>
          <p>Record the approval for this version.</p>
          <div className="retention-fields">
            <div className="field">
              <label htmlFor="retention-effectiveAt">
                Effective date and time (Lagos, optional)
              </label>
              <input
                id="retention-effectiveAt"
                type="datetime-local"
                name="effectiveAt"
                {...errorProps("effectiveAt")}
                aria-describedby="retention-effective-help retention-validation"
              />
              <span id="retention-effective-help" className="field-hint">
                Leave empty to apply on confirmation, or choose a future time.
              </span>
            </div>
            <div className="field">
              <label htmlFor="retention-source">Approval source</label>
              <input
                id="retention-source"
                name="source"
                required
                minLength={10}
                maxLength={500}
                {...errorProps("source")}
              />
            </div>
            <div className="field retention-evidence">
              <label htmlFor="retention-approvalEvidence">
                Written approval or reference
              </label>
              <textarea
                id="retention-approvalEvidence"
                name="approvalEvidence"
                required
                minLength={20}
                maxLength={1000}
                {...errorProps("approvalEvidence")}
              />
            </div>
          </div>
        </fieldset>
        <div id="retention-validation">
          <Feedback message={validation} />
        </div>
        <button ref={reviewButton} className="button" disabled={stale}>
          Review policy
        </button>
      </fieldset>
    </form>
  );
}
export function RetentionPolicy() {
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
    <div className="work-retention-policy">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <ol className="retention-breadcrumb-list">
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">Retention policy</span>
          </li>
        </ol>
      </nav>
      <Feedback message={profile.error ?? profile.refreshError} />
      {profile.loading && <p role="status">Checking your retention-policy permission…</p>}
      {canRead ? (
        <RetentionEditor
          canApprove={canApprove}
          key={session!.user.id + ":" + session!.user.role}
          owner={session!.user.id}
          role={session!.user.role}
          refreshPermission={profile.refresh}
          onDenied={() => {
            redactRetentionPolicyChanges();
            setDenied(true);
          }}
        />
      ) : (
        !profile.loading && (
          <>
            <Feedback message="Retention policy requires an active, verified Super Admin account with MFA." />
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
