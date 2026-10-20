"use client";
import { useEffect, useRef, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api/client";
import { parseOwnStaffProfile } from "@/lib/api/capability-schemas";
import type { RequestBody } from "@/lib/api/contracts";
import type { PolicyVersion } from "@/lib/api/policy-schemas";
import {
  complaintSettingsSchema,
  parsePolicyContact,
} from "@/lib/api/operational-policy-schemas";
import { PolicyContacts } from "./policy-contacts";
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
  parseComplaintWorkspace,
  validateComplaintReceipt,
  type ComplaintWorkspace,
} from "@/lib/admin/work-complaint-policy";
import {
  readComplaintPolicyPending,
  markComplaintPolicyPending,
  clearComplaintPolicyPending,
  complaintPolicyFingerprint,
  redactComplaintPolicyChanges,
  type ComplaintPolicyPending,
} from "@/lib/admin/work-complaint-policy-pending";
import {
  draftIdentity,
  draftKey,
  forgetDraft,
  cancelDraftSubmission,
} from "@/lib/forms/drafts";

type ComplaintInput = Extract<
  RequestBody<"/admin/policies", "post">,
  { kind: "COMPLAINTS" }
>;
function CurrentContact({ id }: { id: string }) {
  const person = useResource("/admin/staff/" + id, parsePolicyContact);
  return (
    <>
      <span>
        {person.data?.id === id
          ? [person.data.staffProfile?.firstName, person.data.staffProfile?.lastName]
              .filter(Boolean)
              .join(" ") || person.data.email
          : person.loading
            ? "Checking account..."
            : "Account details unavailable"}
      </span>
      {person.data?.id === id && (
        <span className="complaint-contact-email">{person.data.email}</span>
      )}
      <small>Current account details</small>
    </>
  );
}
function PolicyFacts({
  row,
  resolveContact = false,
}: {
  row: PolicyVersion;
  resolveContact?: boolean;
}) {
  const parsed = complaintSettingsSchema.safeParse(row.settings);
  if (!parsed.success)
    return (
      <p>
        This draft or older version does not contain all settings required by the current
        approval form.
      </p>
    );
  return (
    <dl className="complaint-facts">
      {operationalFacts("COMPLAINTS", parsed.data).map((fact, i) => (
        <div key={fact.label}>
          <dt>{fact.label}</dt>
          <dd>
            {i === 0 && resolveContact ? (
              <CurrentContact id={parsed.data.escalationUserId} />
            ) : (
              fact.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
function ComplaintHistory({ history }: { history: PolicyVersion[] }) {
  return (
    <details className="complaint-history">
      <summary>Complaint policy history</summary>
      <p>
        Latest 100 recorded versions, newest version first. Effective time determines
        which policy applies.
      </p>
      {history.length === 0 && <p>No complaint policy has been recorded.</p>}
      {history.map((row) => (
        <details key={row.id} className="complaint-version">
          <summary>
            <strong>Version {row.version}</strong>
            <span>
              {row.approvalStatus === "APPROVED"
                ? "Approved"
                : row.approvalStatus.replaceAll("_", " ").toLowerCase()}
            </span>
            <span>Effective {formatBusinessDate(row.effectiveAt)}</span>
          </summary>
          <p>Recorded {formatBusinessDate(row.recordedAt)}</p>
          <PolicyFacts row={row} />
          <p>Approval source: {row.source}</p>
          <p>Approval record: {row.approvalEvidence ?? "Not recorded"}</p>
        </details>
      ))}
    </details>
  );
}
function CurrentPolicy({ state }: { state: ComplaintWorkspace }) {
  return (
    <>
      <section className="complaint-current" aria-labelledby="complaint-current-title">
        <div className="complaint-section-heading">
          <h2 id="complaint-current-title">Current policy</h2>
          {state.current && (
            <span
              className={
                state.current.approvalStatus === "APPROVED"
                  ? "complaint-approved"
                  : "complaint-draft"
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
            <p className="complaint-meta">
              Version {state.current.version} · Effective{" "}
              {formatBusinessDate(state.current.effectiveAt)}
            </p>
            <PolicyFacts row={state.current} resolveContact />
          </>
        ) : (
          <p>No complaint policy is effective at this check.</p>
        )}
        <p className="complaint-checked">
          Checked {formatBusinessDate(state.evaluatedAt)}. Refresh to check for scheduled
          changes.
        </p>
      </section>
      {state.nextScheduled && (
        <details className="complaint-next">
          <summary>Next scheduled policy settings</summary>
          <PolicyFacts row={state.nextScheduled} />
        </details>
      )}
      <dl className="complaint-schedule">
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
function ComplaintEditor({
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
    "/admin/policies/complaints/current",
    parseComplaintWorkspace,
  );
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [validation, setValidation] = useState<string>();
  const [invalidField, setInvalidField] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const reviewButton = useRef<HTMLButtonElement>(null);
  const focusAfterReview = useRef(false);
  const [pending, setPending] = useState<ComplaintPolicyPending>();
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState<ComplaintWorkspace>();
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
      if (success) document.getElementById("complaint-success-title")?.focus();
      else if (pending) document.getElementById("complaint-recovery-title")?.focus();
      else reviewButton.current?.focus();
      focusAfterReview.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [proposal, record.loading, pending, success]);
  useEffect(() => {
    active.current = true;
    queueMicrotask(() => {
      if (active.current) {
        setPending(readComplaintPolicyPending(owner, role));
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
      throw Error("Complaint policy account changed");
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
    const state = parseComplaintWorkspace(
      (await apiRequest("/admin/policies/complaints/current", { signal })).data,
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
    document.getElementById(`complaint-${field}`)?.focus();
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
    const settings = complaintSettingsSchema.safeParse(
      operationalFormSettings("COMPLAINTS", form),
    );
    if (!settings.success) {
      const issue = String(settings.error.issues[0]?.path[0] ?? "escalationUserId");
      const field = issue === "holidayCalendarApproved" ? "calendarApproved" : issue;
      setValidation(
        "Review the escalation contact, classifications and approved calendar. " +
          settings.error.issues[0]?.message,
      );
      setInvalidField(field);
      document.getElementById("policy-" + field)?.focus();
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
      title: "Approve this complaint policy?",
      description:
        "This records the approved escalation contact, urgent classifications and holiday calendar. Changes apply from their effective time. Existing complaint deadlines are retained.",
      facts: [
        ...operationalFacts("COMPLAINTS", settings.data, form),
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
          marker: Exclude<ComplaintPolicyPending, "unknown"> | undefined;
        try {
          if (readComplaintPolicyPending(owner, role))
            throw Error("Earlier approval needs reconciliation");
          const current = await fresh(controller.signal);
          if ((current.latest?.version ?? 0) !== expectedVersion)
            throw Error("Policy version changed");
          const contact = parsePolicyContact(
            (
              await apiRequest("/admin/staff/" + settings.data.escalationUserId, {
                signal: controller.signal,
              })
            ).data,
          );
          identity(controller.signal);
          if (
            contact.id !== settings.data.escalationUserId ||
            contact.status !== "ACTIVE" ||
            !contact.emailVerifiedAt ||
            !["ADMIN", "SUPER_ADMIN"].includes(contact.role)
          )
            throw Error("Contact eligibility changed");
          const body: ComplaintInput = {
            kind: "COMPLAINTS",
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
          const fingerprint = await complaintPolicyFingerprint(body);
          identity(controller.signal);
          marker = markComplaintPolicyPending(owner, role, {
            expectedVersion,
            fingerprint,
          });
          setPending(marker);
          cancelDraftSubmission();
          sent = true;
          const saved = validateComplaintReceipt(
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
          clearComplaintPolicyPending(owner, role, marker.token);
          setSavedPolicy(saved);
          setPending(undefined);
          forgetDraft(
            draftKey(owner + ":" + role, "/admin/complaint-policy", "complaint-policy:1"),
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
            if (marker) clearComplaintPolicyPending(owner, role, marker.token);
            setPending(readComplaintPolicyPending(owner, role));
            setMessage(
              sent
                ? "The server rejected this approval. Refresh the policy before reviewing your draft again."
                : "No approval request was sent. Refresh the policy and review your draft.",
            );
            throw sent ? error : new PreflightError();
          }
          setPending(readComplaintPolicyPending(owner, role));
          throw Error("Approval outcome uncertain");
        } finally {
          flight.current = false;
        }
      },
      onUncertain: () => setPending(readComplaintPolicyPending(owner, role)),
      retryAfterRejection: false,
    });
  }
  return (
    <section className="complaint-workspace" aria-label="Complaint policy review">
      <div className="complaint-toolbar">
        <div>
          <h1>Complaint policy</h1>
          <p>Manage approved escalation and acknowledgement settings.</p>
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
      <p className="complaint-impact">
        Changes apply from their effective time. Existing complaint deadlines are
        retained.
      </p>
      <Feedback message={record.error ?? record.refreshError} />
      <Feedback message={message} />
      {success && (
        <section className="complaint-success">
          <h2 id="complaint-success-title" tabIndex={-1}>
            Complaint policy recorded
          </h2>
          <Feedback message={success} tone="success" toast="Complaint policy approved." />
        </section>
      )}
      {record.loading && <p role="status">Loading complaint policy…</p>}
      {pending && (
        <section
          className="complaint-recovery"
          aria-labelledby="complaint-recovery-title"
        >
          <h2 id="complaint-recovery-title" tabIndex={-1}>
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
              <label className="complaint-ack">
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
                    const currentMarker = readComplaintPolicyPending(owner, role);
                    if (JSON.stringify(currentMarker) !== JSON.stringify(pending))
                      throw Error("Recovery changed");
                    clearComplaintPolicyPending(
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
          <div className="complaint-columns">
            <div className="complaint-state">
              <CurrentPolicy state={record.data} />
              <ComplaintHistory history={record.data.history} />
            </div>
            <ComplaintForm
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
                    "/admin/complaint-policy",
                    "complaint-policy:1",
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
          confirmLabel="Approve complaint policy"
          onClose={() => {
            focusAfterReview.current = true;
            setProposal(null);
          }}
          onSuccess={() =>
            setSuccess(
              "Complaint policy approved. Review its effective date in policy history.",
            )
          }
        />
      )}
    </section>
  );
}
function ComplaintForm({
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
    settings: complaintSettingsSchema.safeParse(initial?.settings),
  }));
  const previous = base.settings.success ? base.settings.data : undefined;
  const [baseVersion, setBaseVersion] = useState(base.version);
  const stale = baseVersion !== latestVersion;
  const errorProps = (name: string) => ({
    "aria-invalid": invalidField === name,
    "aria-describedby": invalidField === name ? "complaint-validation" : undefined,
  });
  return (
    <form
      data-draft-key="complaint-policy:1"
      className="complaint-form"
      onSubmit={(event) => {
        event.preventDefault();
        review(new FormData(event.currentTarget), Date.now(), baseVersion);
      }}
    >
      <h2>Approve a new version</h2>
      <p className="complaint-draft-source">
        Based on recorded version {baseVersion}. Refreshing retains your unsent draft.
      </p>
      {stale && (
        <div className="complaint-stale">
          <p>
            The latest recorded version changed. Review the current facts, then reload the
            action fields to start from version {latestVersion}. Reloading replaces your
            unsent fields.
          </p>
          <button
            id="complaint-reload"
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
      <fieldset disabled={disabled} className="complaint-edit-fields">
        <legend className="sr-only">Complaint policy approval settings</legend>
        <PolicyContacts dispute={false} initial={previous} searchable />
        <fieldset className="complaint-handling">
          <legend>Complaint handling</legend>
          <p>
            Ordinary acknowledgements: 10 accumulated working hours (600 minutes). Urgent
            acknowledgements: 60 working minutes. Monday–Saturday, 08:00–18:00 Lagos time;
            excluded holidays do not count.
          </p>
          <div className="complaint-fields">
            <div className="field">
              <label htmlFor="policy-urgentClassifications">
                Approved urgent classifications
              </label>
              <textarea
                id="policy-urgentClassifications"
                name="urgentClassifications"
                required
                defaultValue={previous?.urgentClassifications.join("\n") ?? ""}
                aria-invalid={invalidField === "urgentClassifications"}
                aria-describedby="complaint-classifications-help complaint-validation"
              />
              <span className="field-hint" id="complaint-classifications-help">
                One per line; 1–30 classifications of 2–100 characters. Staff assign
                priority; this list does not classify complaints automatically.
              </span>
            </div>
            <div className="field">
              <label htmlFor="policy-holidays">Excluded holiday dates (optional)</label>
              <textarea
                id="policy-holidays"
                name="holidays"
                defaultValue={previous?.holidays.join("\n") ?? ""}
                aria-invalid={invalidField === "holidays"}
                aria-describedby="complaint-holidays-help complaint-validation"
              />
              <span className="field-hint" id="complaint-holidays-help">
                YYYY-MM-DD, one per line or separated by commas. Up to 100 dates. Leave
                empty only if the approved calendar excludes no holidays.
              </span>
            </div>
          </div>
          <label className="check-label" htmlFor="policy-calendarApproved">
            <input
              type="checkbox"
              id="policy-calendarApproved"
              name="calendarApproved"
              required
              aria-invalid={invalidField === "calendarApproved"}
            />
            I confirm that this schedule and holiday list are approved.
          </label>
        </fieldset>
        <fieldset>
          <legend>Written approval</legend>
          <p>Record the approval for this version.</p>
          <div className="complaint-fields">
            <div className="field">
              <label htmlFor="complaint-effectiveAt">
                Effective date and time (Lagos, optional)
              </label>
              <input
                id="complaint-effectiveAt"
                type="datetime-local"
                name="effectiveAt"
                {...errorProps("effectiveAt")}
                aria-describedby="complaint-effective-help complaint-validation"
              />
              <span id="complaint-effective-help" className="field-hint">
                Leave empty to apply on confirmation, or choose a future time.
              </span>
            </div>
            <div className="field">
              <label htmlFor="complaint-source">Approval source</label>
              <input
                id="complaint-source"
                name="source"
                required
                minLength={10}
                maxLength={500}
                {...errorProps("source")}
              />
            </div>
            <div className="field complaint-evidence">
              <label htmlFor="complaint-approvalEvidence">
                Written approval or reference
              </label>
              <textarea
                id="complaint-approvalEvidence"
                name="approvalEvidence"
                required
                minLength={20}
                maxLength={1000}
                {...errorProps("approvalEvidence")}
              />
            </div>
          </div>
        </fieldset>
        <div id="complaint-validation">
          <Feedback message={validation} />
        </div>
        <button ref={reviewButton} className="button" disabled={stale}>
          Review policy
        </button>
      </fieldset>
    </form>
  );
}
export function ComplaintPolicy() {
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
    <div className="work-complaint-policy">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <ol className="complaint-breadcrumb-list">
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">Complaint policy</span>
          </li>
        </ol>
      </nav>
      <Feedback message={profile.error ?? profile.refreshError} />
      {profile.loading && <p role="status">Checking your complaint-policy permission…</p>}
      {canRead ? (
        <ComplaintEditor
          canApprove={canApprove}
          key={session!.user.id + ":" + session!.user.role}
          owner={session!.user.id}
          role={session!.user.role}
          refreshPermission={profile.refresh}
          onDenied={() => {
            redactComplaintPolicyChanges();
            setDenied(true);
          }}
        />
      ) : (
        !profile.loading && (
          <>
            <Feedback message="Complaint policy requires an active, verified Super Admin account with MFA." />
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
