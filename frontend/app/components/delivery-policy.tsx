"use client";
import { useEffect, useRef, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api/client";
import { parseOwnStaffProfile } from "@/lib/api/capability-schemas";
import type { RequestBody } from "@/lib/api/contracts";
import type { PolicyVersion } from "@/lib/api/policy-schemas";
import { deliverySettingsSchema } from "@/lib/api/fulfillment-schemas";
import { business } from "@/lib/business";
import { nairaToKobo } from "@/lib/format/currency-input";
import { formatKobo } from "@/lib/format/money";
import { DeliveryAreaFields } from "./delivery-area-fields";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import { lagosDateTime } from "@/lib/forms/vehicle-condition";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";

import {
  parseDeliveryWorkspace,
  validateDeliveryReceipt,
  type DeliveryWorkspace,
} from "@/lib/admin/work-delivery-policy";
import {
  readDeliveryPolicyPending,
  markDeliveryPolicyPending,
  clearDeliveryPolicyPending,
  deliveryPolicyFingerprint,
  redactDeliveryPolicyChanges,
  type DeliveryPolicyPending,
} from "@/lib/admin/work-delivery-policy-pending";
import {
  draftIdentity,
  draftKey,
  forgetDraft,
  cancelDraftSubmission,
} from "@/lib/forms/drafts";

type DeliveryInput = Extract<
  RequestBody<"/admin/policies", "post">,
  { kind: "DELIVERY" }
>;
function PolicyFacts({ row }: { row: PolicyVersion; expandFirst?: boolean }) {
  const parsed = deliverySettingsSchema.safeParse(row.settings);
  if (!parsed.success)
    return (
      <p>This draft or older version does not contain an approved delivery-area list.</p>
    );
  return (
    <div className="delivery-recorded-areas">
      <p>
        {parsed.data.zones.length} approved delivery{" "}
        {parsed.data.zones.length === 1 ? "area" : "areas"}
      </p>
      <ul>
        {parsed.data.zones.map((zone) => (
          <li key={zone.id}>
            <strong>{zone.label}</strong>
            <span>
              {zone.city}, {zone.state}
            </span>
            <span>{formatKobo(zone.feeKobo)} before applicable tax</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
function DeliveryVersion({ row }: { row: PolicyVersion }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="delivery-version"
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
function DeliveryHistory({ history }: { history: PolicyVersion[] }) {
  return (
    <details className="delivery-history">
      <summary>Delivery policy history</summary>
      <p>
        Latest 100 recorded versions, newest version first. Effective time determines
        which policy applies.
      </p>
      {history.length === 0 && <p>No delivery policy has been recorded.</p>}
      {history.map((row) => (
        <DeliveryVersion row={row} key={row.id} />
      ))}
    </details>
  );
}
function CurrentPolicy({ state }: { state: DeliveryWorkspace }) {
  return (
    <>
      <section className="delivery-current" aria-labelledby="delivery-current-title">
        <div className="delivery-section-heading">
          <h2 id="delivery-current-title">Current delivery policy</h2>
          {state.current && (
            <span
              className={
                state.current.approvalStatus === "APPROVED"
                  ? "delivery-approved"
                  : "delivery-draft"
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
            <p className="delivery-meta">
              Version {state.current.version} · Effective{" "}
              {formatBusinessDate(state.current.effectiveAt)}
            </p>
            <PolicyFacts row={state.current} expandFirst />
          </>
        ) : (
          <p>No delivery policy is effective at this check.</p>
        )}
        <div className="delivery-availability">
          <strong>
            {state.availability.deliveryEnabled
              ? "Delivery available at checkout"
              : "Delivery unavailable at checkout"}
          </strong>
          <p>
            {state.availability.checkoutEnabled
              ? "Checkout is available. Delivery also requires an approved effective area list and financial delivery tax settings."
              : "Checkout is unavailable under the current financial policy."}
          </p>
        </div>
        <div className="delivery-collection">
          <h3>Collection address</h3>
          <p>{business.address}</p>
        </div>
        <p className="delivery-checked">
          Checked {formatBusinessDate(state.evaluatedAt)}. Refresh to check for scheduled
          changes.
        </p>
      </section>
      {state.nextScheduled && (
        <details className="delivery-next">
          <summary>Next scheduled policy settings</summary>
          <PolicyFacts row={state.nextScheduled} />
        </details>
      )}
      <dl className="delivery-schedule">
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
function DeliveryEditor({
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
  const record = useResource("/admin/policies/delivery/current", parseDeliveryWorkspace);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [validation, setValidation] = useState<string>();
  const [invalidField, setInvalidField] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const reviewButton = useRef<HTMLButtonElement>(null);
  const focusAfterReview = useRef(false);
  const [pending, setPending] = useState<DeliveryPolicyPending>();
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState<DeliveryWorkspace>();
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
      if (success) document.getElementById("delivery-success-title")?.focus();
      else if (pending) document.getElementById("delivery-recovery-title")?.focus();
      else reviewButton.current?.focus();
      focusAfterReview.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [proposal, record.loading, pending, success]);
  useEffect(() => {
    active.current = true;
    queueMicrotask(() => {
      if (active.current) {
        setPending(readDeliveryPolicyPending(owner, role));
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
      throw Error("Delivery policy account changed");
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
    const state = parseDeliveryWorkspace(
      (await apiRequest("/admin/policies/delivery/current", { signal })).data,
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
    document.getElementById(`delivery-${field}`)?.focus();
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
    const keys = form.getAll("areaKey").map(String);
    const feeIndex = keys.findIndex(
      (key) =>
        !/^\d{1,13}(?:\.\d{1,2})?$/.test(String(form.get(key + "-fee") ?? "").trim()),
    );
    if (feeIndex !== -1) {
      const field = keys[feeIndex] + "-fee";
      setValidation(
        "Enter a delivery fee in NGN with up to two decimal places, from 0 to 9,999,999,999,999.99.",
      );
      setInvalidField(field);
      document.getElementById(field)?.focus();
      return;
    }
    const settings = deliverySettingsSchema.safeParse({
      collectionEnabled: true,
      collectionAddress: business.address,
      zones: keys.map((key) => ({
        id: String(form.get(key + "-id") ?? ""),
        label: String(form.get(key + "-label") ?? ""),
        city: String(form.get(key + "-city") ?? ""),
        state: String(form.get(key + "-state") ?? ""),
        feeKobo: nairaToKobo(String(form.get(key + "-fee") ?? "")),
      })),
    });
    if (!settings.success) {
      const issue = settings.error.issues[0],
        field =
          typeof issue?.path[1] === "number"
            ? keys[issue.path[1]] + "-" + String(issue.path[2] ?? "label")
            : "delivery-add-zone";
      setValidation(
        keys.length === 0
          ? "Add at least one approved delivery area."
          : "Review each area's name, city, state and fee. Use distinct references and plain text names of at least two characters.",
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
      title: "Approve these delivery areas?",
      description:
        "This publishes the complete delivery-area list and fees for new orders when effective. Checkout also requires financial policy and delivery tax settings. Existing orders retain their saved fees and addresses.",
      facts: [
        ...settings.data.zones.map((zone, index) => ({
          label: `Area ${index + 1}`,
          value: `${zone.label} · ${zone.city}, ${zone.state} · ${formatKobo(zone.feeKobo)} before applicable tax`,
        })),
        { label: "Collection address", value: business.address },
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
          marker: Exclude<DeliveryPolicyPending, "unknown"> | undefined;
        try {
          if (readDeliveryPolicyPending(owner, role))
            throw Error("Earlier approval needs reconciliation");
          const current = await fresh(controller.signal);
          if ((current.latest?.version ?? 0) !== expectedVersion)
            throw Error("Policy version changed");
          const body: DeliveryInput = {
            kind: "DELIVERY",
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
          const fingerprint = await deliveryPolicyFingerprint(body);
          identity(controller.signal);
          marker = markDeliveryPolicyPending(owner, role, {
            expectedVersion,
            fingerprint,
          });
          setPending(marker);
          cancelDraftSubmission();
          sent = true;
          const saved = validateDeliveryReceipt(
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
          clearDeliveryPolicyPending(owner, role, marker.token);
          setSavedPolicy(saved);
          setPending(undefined);
          forgetDraft(
            draftKey(owner + ":" + role, "/admin/delivery-policy", "delivery-policy:1"),
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
            if (marker) clearDeliveryPolicyPending(owner, role, marker.token);
            setPending(readDeliveryPolicyPending(owner, role));
            setMessage(
              sent
                ? "The server rejected this approval. Refresh the policy before reviewing your draft again."
                : "No approval request was sent. Refresh the policy and review your draft.",
            );
            throw sent ? error : new PreflightError();
          }
          setPending(readDeliveryPolicyPending(owner, role));
          throw Error("Approval outcome uncertain");
        } finally {
          flight.current = false;
        }
      },
      onUncertain: () => setPending(readDeliveryPolicyPending(owner, role)),
      retryAfterRejection: false,
    });
  }
  return (
    <section className="delivery-workspace" aria-label="Delivery policy review">
      <div className="delivery-toolbar">
        <div>
          <h1>Delivery setup</h1>
          <p>Manage approved delivery areas and fees for new orders.</p>
        </div>
        <button
          className="button secondary"
          disabled={record.loading || !!proposal || recovering}
          onClick={() => {
            record.refresh();
            refreshPermission();
          }}
        >
          Refresh delivery policy
        </button>
      </div>
      <p className="delivery-impact">
        Existing orders retain their saved delivery fees and addresses. Checkout also
        requires financial policy and delivery tax settings.
      </p>
      <Feedback message={record.error ?? record.refreshError} />
      <Feedback message={message} />
      {success && (
        <section className="delivery-success">
          <h2 id="delivery-success-title" tabIndex={-1}>
            Delivery policy recorded
          </h2>
          <Feedback message={success} tone="success" toast="Delivery policy approved." />
        </section>
      )}
      {record.loading && <p role="status">Loading delivery policy…</p>}
      {pending && (
        <section className="delivery-recovery" aria-labelledby="delivery-recovery-title">
          <h2 id="delivery-recovery-title" tabIndex={-1}>
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
              <label className="delivery-ack">
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
                    const currentMarker = readDeliveryPolicyPending(owner, role);
                    if (JSON.stringify(currentMarker) !== JSON.stringify(pending))
                      throw Error("Recovery changed");
                    clearDeliveryPolicyPending(
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
          <div className="delivery-columns">
            <div className="delivery-state">
              <CurrentPolicy state={record.data} />
              <DeliveryHistory history={record.data.history} />
            </div>
            <DeliveryForm
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
                    "/admin/delivery-policy",
                    "delivery-policy:1",
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
          confirmLabel="Approve delivery"
          onClose={() => {
            focusAfterReview.current = true;
            setProposal(null);
          }}
          onSuccess={() =>
            setSuccess(
              "Delivery policy approved. Review its effective date in policy history.",
            )
          }
        />
      )}
    </section>
  );
}
function DeliveryForm({
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
    settings: deliverySettingsSchema.safeParse(initial?.settings),
  }));
  const previous = base.settings.success ? base.settings.data : undefined;
  const [baseVersion, setBaseVersion] = useState(base.version);
  const stale = baseVersion !== latestVersion;
  const errorProps = (name: string) => ({
    "aria-invalid": invalidField === name,
    "aria-describedby": invalidField === name ? "delivery-validation" : undefined,
  });
  return (
    <form
      data-draft-key="delivery-policy:1"
      className="delivery-form"
      onSubmit={(event) => {
        event.preventDefault();
        review(new FormData(event.currentTarget), Date.now(), baseVersion);
      }}
    >
      <h2>Approve delivery areas</h2>
      <p className="delivery-draft-source">
        Based on recorded version {baseVersion}. Refreshing retains your unsent draft.
      </p>
      {stale && (
        <div className="delivery-stale">
          <p>
            The latest recorded version changed. Review the current facts, then reload the
            action fields to start from version {latestVersion}. Reloading replaces your
            unsent fields.
          </p>
          <button
            id="delivery-reload"
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
      <fieldset disabled={disabled} className="delivery-edit-fields">
        <legend className="sr-only">Delivery policy approval settings</legend>
        <DeliveryAreaFields initial={previous} invalidField={invalidField} />
        <fieldset>
          <legend>Written approval</legend>
          <p>Record the approval for this version.</p>
          <div className="delivery-fields">
            <div className="field">
              <label htmlFor="delivery-effectiveAt">
                Effective date and time (Lagos time, optional)
              </label>
              <input
                id="delivery-effectiveAt"
                type="datetime-local"
                name="effectiveAt"
                {...errorProps("effectiveAt")}
                aria-describedby="delivery-effective-help delivery-validation"
              />
              <span id="delivery-effective-help" className="field-hint">
                Leave empty to apply on confirmation, or choose a future time.
              </span>
            </div>
            <div className="field">
              <label htmlFor="delivery-source">Approval source</label>
              <input
                id="delivery-source"
                name="source"
                required
                minLength={10}
                maxLength={500}
                {...errorProps("source")}
              />
            </div>
            <div className="field delivery-evidence">
              <label htmlFor="delivery-approvalEvidence">
                Written approval or reference
              </label>
              <textarea
                id="delivery-approvalEvidence"
                name="approvalEvidence"
                required
                minLength={20}
                maxLength={1000}
                {...errorProps("approvalEvidence")}
              />
            </div>
          </div>
        </fieldset>
        <div id="delivery-validation">
          <Feedback message={validation} />
        </div>
        <button ref={reviewButton} className="button" disabled={stale}>
          Review delivery approval
        </button>
      </fieldset>
    </form>
  );
}
export function DeliveryPolicy() {
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
    <div className="work-delivery-policy">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <ol className="delivery-breadcrumb-list">
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">Delivery setup</span>
          </li>
        </ol>
      </nav>
      <Feedback message={profile.error ?? profile.refreshError} />
      {profile.loading && <p role="status">Checking your delivery-policy permission…</p>}
      {canRead ? (
        <DeliveryEditor
          canApprove={canApprove}
          key={session!.user.id + ":" + session!.user.role}
          owner={session!.user.id}
          role={session!.user.role}
          refreshPermission={profile.refresh}
          onDenied={() => {
            redactDeliveryPolicyChanges();
            setDenied(true);
          }}
        />
      ) : (
        !profile.loading && (
          <>
            <Feedback message="Delivery policy requires an active, verified Super Admin account with MFA." />
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
