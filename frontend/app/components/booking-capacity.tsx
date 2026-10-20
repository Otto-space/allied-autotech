"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api/client";
import { parseOwnStaffProfile } from "@/lib/api/capability-schemas";
import type { RequestBody } from "@/lib/api/contracts";
import type { PolicyVersion } from "@/lib/api/policy-schemas";
import { capacitySettingsSchema, weekDays } from "@/lib/api/policy-schemas";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { AdminBranchPicker } from "./admin-branch-picker";
import { ChevronRight } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import { lagosDateTime } from "@/lib/forms/vehicle-condition";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";

import {
  parseCapacityWorkspace,
  validateCapacityReceipt,
  type CapacityWorkspace,
} from "@/lib/admin/work-capacity-policy";
import {
  readCapacityPolicyPending,
  markCapacityPolicyPending,
  clearCapacityPolicyPending,
  capacityPolicyFingerprint,
  redactCapacityPolicyChanges,
  type CapacityPolicyPending,
} from "@/lib/admin/work-capacity-policy-pending";
import {
  draftIdentity,
  draftKey,
  forgetDraft,
  cancelDraftSubmission,
} from "@/lib/forms/drafts";

type CapacityInput = Extract<
  RequestBody<"/admin/policies", "post">,
  { kind: "BRANCH_CAPACITY" }
>;
function PolicyFacts({ row }: { row: PolicyVersion; expandFirst?: boolean }) {
  const parsed = capacitySettingsSchema.safeParse(row.settings);
  if (!parsed.success)
    return (
      <p>
        This draft or older version does not contain all settings required by the current
        approval form.
      </p>
    );
  return (
    <dl className="capacity-facts">
      <div>
        <dt>Daily booking limit</dt>
        <dd>{parsed.data.dailyLimit}</dd>
      </div>
      <div>
        <dt>Opening days</dt>
        <dd>{parsed.data.openingDays.map((d) => weekDays[d]).join(", ")}</dd>
      </div>
      <div>
        <dt>Appointment hours</dt>
        <dd>08:00–18:00, Lagos time</dd>
      </div>
      <div>
        <dt>Closed dates</dt>
        <dd>{parsed.data.holidays.join(", ") || "None recorded"}</dd>
      </div>
    </dl>
  );
}
function CapacityVersion({ row }: { row: PolicyVersion }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="capacity-version"
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
function CapacityHistory({ history }: { history: PolicyVersion[] }) {
  return (
    <details className="capacity-history">
      <summary>Capacity policy history</summary>
      <p>
        Latest 100 recorded versions, newest version first. Effective time determines
        which policy applies.
      </p>
      {history.length === 0 && <p>No capacity policy has been recorded.</p>}
      {history.map((row) => (
        <CapacityVersion row={row} key={row.id} />
      ))}
    </details>
  );
}
function CurrentPolicy({ state }: { state: CapacityWorkspace }) {
  return (
    <>
      <section className="capacity-current" aria-labelledby="capacity-current-title">
        <div className="capacity-section-heading">
          <h2 id="capacity-current-title">Current capacity</h2>
          {state.current && (
            <span
              className={
                state.current.approvalStatus === "APPROVED"
                  ? "capacity-approved"
                  : "capacity-draft"
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
            <p className="capacity-meta">
              Version {state.current.version} · Effective{" "}
              {formatBusinessDate(state.current.effectiveAt)}
            </p>
            <PolicyFacts row={state.current} expandFirst />
          </>
        ) : (
          <p>No capacity policy is effective at this check.</p>
        )}
        <p className="capacity-checked">
          Checked {formatBusinessDate(state.evaluatedAt)}. Refresh to check for scheduled
          changes.
        </p>
      </section>
      {state.nextScheduled && (
        <details className="capacity-next">
          <summary>Next scheduled policy settings</summary>
          <PolicyFacts row={state.nextScheduled} />
        </details>
      )}
      <dl className="capacity-schedule">
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
function CapacityEditor({
  branchId,
  canApprove,
  refreshPermission,
  owner,
  role,
  onDenied,
}: {
  branchId: string;
  canApprove: boolean;
  refreshPermission: () => void;
  owner: string;
  role: string;
  onDenied: () => void;
}) {
  const endpoint = `/admin/policies/booking-capacity/${branchId}/current`;
  const parse = useCallback(
    (value: unknown) => parseCapacityWorkspace(value, branchId),
    [branchId],
  );
  const record = useResource(endpoint, parse);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [validation, setValidation] = useState<string>();
  const [invalidField, setInvalidField] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const reviewButton = useRef<HTMLButtonElement>(null);
  const focusAfterReview = useRef(false);
  const [pending, setPending] = useState<CapacityPolicyPending>();
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState<CapacityWorkspace>();
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
    !record.data.branch.isActive ||
    !!proposal ||
    !!pending;
  useEffect(() => {
    if (proposal || (!success && record.loading) || !focusAfterReview.current) return;
    const frame = requestAnimationFrame(() => {
      if (success) document.getElementById("capacity-success-title")?.focus();
      else if (pending) document.getElementById("capacity-recovery-title")?.focus();
      else reviewButton.current?.focus();
      focusAfterReview.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [proposal, record.loading, pending, success]);
  useEffect(() => {
    active.current = true;
    queueMicrotask(() => {
      if (active.current) {
        setPending(readCapacityPolicyPending(owner, role, branchId));
        setReady(true);
      }
    });
    return () => {
      active.current = false;
      request.current?.abort();
    };
  }, [owner, role, branchId]);
  useEffect(() => {
    if (record.denied) onDenied();
  }, [record.denied, onDenied]);
  function identity(signal?: AbortSignal) {
    if (!active.current || signal?.aborted || draftIdentity() !== owner + ":" + role)
      throw Error("Capacity policy account changed");
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
    const state = parse((await apiRequest(endpoint, { signal })).data);
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
    document.getElementById(`capacity-${field}`)?.focus();
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
    const settings = capacitySettingsSchema.safeParse({
      dailyLimit: Number(form.get("dailyLimit")),
      openingDays: form.getAll("openingDays").map(Number),
      holidays: [
        ...new Set(
          String(form.get("holidays") ?? "")
            .split(/[\s,]+/)
            .filter(Boolean),
        ),
      ].sort(),
      opensAt: "08:00",
      closesAt: "18:00",
      timezone: "Africa/Lagos",
    });
    if (!settings.success) {
      const field = String(settings.error.issues[0]?.path[0] ?? "dailyLimit");
      invalid(
        field === "dailyLimit"
          ? "Enter a daily limit from 1 to 1,000 bookings."
          : field === "openingDays"
            ? "Choose at least one opening day."
            : "Use valid closed dates in YYYY-MM-DD format, up to 366 dates.",
        field,
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
      title: "Approve this booking capacity?",
      description:
        "This publishes a new branch policy. Staff confirmation checks its calendar and daily limit together with people and equipment availability. It does not confirm or reschedule bookings automatically.",
      facts: [
        { label: "Branch", value: record.data!.branch.name },
        { label: "Daily limit", value: String(settings.data.dailyLimit) },
        {
          label: "Opening days",
          value: settings.data.openingDays.map((d) => weekDays[d]).join(", "),
        },
        { label: "Appointment hours", value: "08:00–18:00, Lagos time" },
        { label: "Closed dates", value: settings.data.holidays.join(", ") || "None" },
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
          marker: Exclude<CapacityPolicyPending, "unknown"> | undefined;
        try {
          if (readCapacityPolicyPending(owner, role, branchId))
            throw Error("Earlier approval needs reconciliation");
          const current = await fresh(controller.signal);
          if (
            (current.latest?.version ?? 0) !== expectedVersion ||
            !current.branch.isActive ||
            current.branch.updatedAt !== record.data!.branch.updatedAt
          )
            throw Error("Policy version changed");
          const body: CapacityInput = {
            kind: "BRANCH_CAPACITY",
            branchId,
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
          const fingerprint = await capacityPolicyFingerprint(body);
          identity(controller.signal);
          marker = markCapacityPolicyPending(owner, role, branchId, {
            expectedVersion,
            fingerprint,
          });
          setPending(marker);
          cancelDraftSubmission();
          sent = true;
          const saved = validateCapacityReceipt(
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
          clearCapacityPolicyPending(owner, role, branchId, marker.token);
          setSavedPolicy(saved);
          setPending(undefined);
          forgetDraft(
            draftKey(
              owner + ":" + role,
              "/admin/booking-capacity",
              JSON.stringify(["booking-capacity:1", branchId]),
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
            if (marker) clearCapacityPolicyPending(owner, role, branchId, marker.token);
            setPending(readCapacityPolicyPending(owner, role, branchId));
            setMessage(
              sent
                ? "The server rejected this approval. Refresh the policy before reviewing your draft again."
                : "No approval request was sent. Refresh the policy and review your draft.",
            );
            throw sent ? error : new PreflightError();
          }
          setPending(readCapacityPolicyPending(owner, role, branchId));
          throw Error("Approval outcome uncertain");
        } finally {
          flight.current = false;
        }
      },
      onUncertain: () => setPending(readCapacityPolicyPending(owner, role, branchId)),
      retryAfterRejection: false,
    });
  }
  return (
    <section className="capacity-workspace" aria-label="Capacity policy review">
      <div className="capacity-toolbar">
        <div>
          <h2>{record.data?.branch.name ?? "Branch capacity"}</h2>
          <p>
            {record.data?.branch.isActive === false
              ? "Inactive branch — approval is unavailable."
              : "Review the current policy before approving a new version."}
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
          Refresh capacity policy
        </button>
      </div>
      <p className="capacity-impact">
        Existing confirmed bookings are not rescheduled. Staff still review people and
        equipment before confirmation.
      </p>
      <Feedback message={record.error ?? record.refreshError} />
      <Feedback message={message} />
      {success && (
        <section className="capacity-success">
          <h2 id="capacity-success-title" tabIndex={-1}>
            Booking capacity recorded
          </h2>
          <Feedback message={success} tone="success" toast="Capacity policy approved." />
        </section>
      )}
      {record.loading && <p role="status">Loading capacity policy…</p>}
      {pending && (
        <section className="capacity-recovery" aria-labelledby="capacity-recovery-title">
          <h2 id="capacity-recovery-title" tabIndex={-1}>
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
              <label className="capacity-ack">
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
                    const currentMarker = readCapacityPolicyPending(
                      owner,
                      role,
                      branchId,
                    );
                    if (JSON.stringify(currentMarker) !== JSON.stringify(pending))
                      throw Error("Recovery changed");
                    clearCapacityPolicyPending(
                      owner,
                      role,
                      branchId,
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
          <div className="capacity-columns">
            <div className="capacity-state">
              <CurrentPolicy state={record.data} />
              <CapacityHistory history={record.data.history} />
            </div>
            <CapacityForm
              key={formRevision}
              branchId={branchId}
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
                    "/admin/booking-capacity",
                    JSON.stringify(["booking-capacity:1", branchId]),
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
          confirmLabel="Approve capacity"
          onClose={() => {
            focusAfterReview.current = true;
            setProposal(null);
          }}
          onSuccess={() =>
            setSuccess(
              "Capacity policy approved. Review its effective date in policy history.",
            )
          }
        />
      )}
    </section>
  );
}
function CapacityForm({
  branchId,
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
  branchId: string;
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
    settings: capacitySettingsSchema.safeParse(initial?.settings),
  }));
  const previous = base.settings.success ? base.settings.data : undefined;
  const [baseVersion, setBaseVersion] = useState(base.version);
  const stale = baseVersion !== latestVersion;
  const errorProps = (name: string) => ({
    "aria-invalid": invalidField === name,
    "aria-describedby": invalidField === name ? "capacity-validation" : undefined,
  });
  return (
    <form
      data-draft-key={JSON.stringify(["booking-capacity:1", branchId])}
      className="capacity-form"
      onSubmit={(event) => {
        event.preventDefault();
        review(new FormData(event.currentTarget), Date.now(), baseVersion);
      }}
    >
      <h2>Approve branch capacity</h2>
      <p className="capacity-draft-source">
        Based on recorded version {baseVersion}. Refreshing retains your unsent draft.
      </p>
      {stale && (
        <div className="capacity-stale">
          <p>
            The latest recorded version changed. Review the current facts, then reload the
            action fields to start from version {latestVersion}. Reloading replaces your
            unsent fields.
          </p>
          <button
            id="capacity-reload"
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
      <fieldset disabled={disabled} className="capacity-edit-fields">
        <legend className="sr-only">Capacity policy approval settings</legend>
        <fieldset>
          <legend>Capacity and calendar</legend>
          <div className="capacity-fields">
            <div className="field">
              <label htmlFor="capacity-dailyLimit">
                Maximum confirmed bookings per day
              </label>
              <input
                id="capacity-dailyLimit"
                name="dailyLimit"
                type="number"
                min={1}
                max={1000}
                step={1}
                required
                defaultValue={previous?.dailyLimit ?? ""}
                {...errorProps("dailyLimit")}
              />
              <span className="field-hint">1–1,000 bookings.</span>
            </div>
            <div className="capacity-fixed-hours">
              <strong>Appointment hours</strong>
              <p>08:00–18:00, Lagos time</p>
            </div>
          </div>
          <fieldset className="capacity-days">
            <legend>Opening days</legend>
            <div>
              {weekDays.map((day, index) => (
                <label className="check-label" key={day}>
                  <input
                    id={index === 0 ? "capacity-openingDays" : undefined}
                    type="checkbox"
                    name="openingDays"
                    value={index}
                    defaultChecked={previous?.openingDays.includes(index) ?? false}
                    {...errorProps("openingDays")}
                  />
                  {day}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="field">
            <label htmlFor="capacity-holidays">Closed dates (optional)</label>
            <textarea
              id="capacity-holidays"
              name="holidays"
              maxLength={5000}
              defaultValue={previous?.holidays.join("\n") ?? ""}
              {...errorProps("holidays")}
              aria-describedby="capacity-holidays-help capacity-validation"
            />
            <span id="capacity-holidays-help" className="field-hint">
              Enter one date per line in YYYY-MM-DD format, up to 366 dates.
            </span>
          </div>
        </fieldset>
        <fieldset>
          <legend>Written approval</legend>
          <p>Record the approval for this version.</p>
          <div className="capacity-fields">
            <div className="field">
              <label htmlFor="capacity-effectiveAt">
                Effective date and time (Lagos time, optional)
              </label>
              <input
                id="capacity-effectiveAt"
                type="datetime-local"
                name="effectiveAt"
                {...errorProps("effectiveAt")}
                aria-describedby="capacity-effective-help capacity-validation"
              />
              <span id="capacity-effective-help" className="field-hint">
                Leave empty to apply on confirmation, or choose a future time.
              </span>
            </div>
            <div className="field">
              <label htmlFor="capacity-source">Approval source</label>
              <input
                id="capacity-source"
                name="source"
                required
                minLength={10}
                maxLength={500}
                {...errorProps("source")}
              />
            </div>
            <div className="field capacity-evidence">
              <label htmlFor="capacity-approvalEvidence">
                Written approval or reference
              </label>
              <textarea
                id="capacity-approvalEvidence"
                name="approvalEvidence"
                required
                minLength={20}
                maxLength={1000}
                {...errorProps("approvalEvidence")}
              />
            </div>
          </div>
        </fieldset>
        <div id="capacity-validation">
          <Feedback message={validation} />
        </div>
        <button ref={reviewButton} className="button" disabled={stale}>
          Review capacity approval
        </button>
      </fieldset>
    </form>
  );
}
export function BookingCapacity() {
  const session = useAccountSession();
  const router = useRouter(),
    params = useSearchParams();
  const branchId = z.uuid().safeParse(params.get("branch")).success
    ? params.get("branch")!
    : "";
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
    <div className="work-capacity-policy">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <ol className="capacity-breadcrumb-list">
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">Booking capacity</span>
          </li>
        </ol>
      </nav>
      <header className="capacity-page-heading">
        <h1>Booking capacity</h1>
        <p>Manage each workshop’s approved calendar and daily booking limit.</p>
      </header>
      {canRead && (
        <div className="field capacity-branch-picker">
          <label htmlFor="capacity-branch">Workshop branch</label>
          <AdminBranchPicker
            id="capacity-branch"
            value={branchId}
            onChange={(id) =>
              router.replace(
                id ? `/admin/booking-capacity?branch=${id}` : "/admin/booking-capacity",
                { scroll: false },
              )
            }
            onDenied={() => setDenied(true)}
          />
        </div>
      )}
      <Feedback message={profile.error ?? profile.refreshError} />
      {profile.loading && <p role="status">Checking your capacity-policy permission…</p>}
      {canRead ? (
        branchId ? (
          <CapacityEditor
            branchId={branchId}
            canApprove={canApprove}
            key={session!.user.id + ":" + session!.user.role + ":" + branchId}
            owner={session!.user.id}
            role={session!.user.role}
            refreshPermission={profile.refresh}
            onDenied={() => {
              redactCapacityPolicyChanges();
              setDenied(true);
            }}
          />
        ) : (
          <p className="capacity-impact">
            Choose an active workshop branch to inspect its capacity policy.
          </p>
        )
      ) : (
        !profile.loading && (
          <>
            <Feedback message="Capacity policy requires an active, verified Super Admin account with MFA." />
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
