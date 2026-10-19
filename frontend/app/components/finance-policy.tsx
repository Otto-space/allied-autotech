"use client";
import { useEffect, useRef, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api/client";
import { parseOwnStaffProfile } from "@/lib/api/capability-schemas";
import type { RequestBody } from "@/lib/api/contracts";
import { financeSettingsSchema, type PolicyVersion } from "@/lib/api/policy-schemas";
import { useResource } from "@/lib/api/use-resource";
import { lagosDateTime } from "@/lib/forms/vehicle-condition";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";

import {
  parseFinanceWorkspace,
  validateFinanceReceipt,
  type FinanceWorkspace,
} from "@/lib/admin/work-finance-policy";
import {
  readFinancePolicyPending,
  markFinancePolicyPending,
  clearFinancePolicyPending,
  financePolicyFingerprint,
  redactFinancePolicyChanges,
  type FinancePolicyPending,
} from "@/lib/admin/work-finance-policy-pending";
import {
  draftIdentity,
  draftKey,
  forgetDraft,
  cancelDraftSubmission,
} from "@/lib/forms/drafts";

type FinanceInput = Extract<RequestBody<"/admin/policies", "post">, { kind: "FINANCE" }>;
const invoiceFields = [
  { name: "invoiceName", label: "Invoice business name", min: 2, max: 200 },
  { name: "invoiceAddress", label: "Invoice business address", min: 10, max: 500 },
  { name: "paymentTerms", label: "Payment terms", min: 10, max: 1000 },
] as const;
function PolicyFacts({ row }: { row: PolicyVersion }) {
  const settings = financeSettingsSchema.safeParse(row.settings);
  if (!settings.success)
    return (
      <p>
        This draft or older version does not contain all settings required by the current
        approval form.
      </p>
    );
  return (
    <div className="finance-facts">
      <dl>
        {invoiceFields.map(({ name, label }) => (
          <div key={name}>
            <dt>{label}</dt>
            <dd>{settings.data[name]}</dd>
          </div>
        ))}
      </dl>
      <dl>
        <div>
          <dt>VAT</dt>
          <dd>7.5%, added to prices</dd>
        </div>
        <div>
          <dt>Applies to</dt>
          <dd>All products and services</dd>
        </div>
        <div>
          <dt>Discounts</dt>
          <dd>Applied before VAT</dd>
        </div>
        <div>
          <dt>Rounding</dt>
          <dd>Nearest kobo, rounding half up</dd>
        </div>
        <div>
          <dt>Delivery fees</dt>
          <dd>
            {settings.data.deliveryTaxable ? "Subject to VAT" : "Not subject to VAT"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
function FinanceHistory({ history }: { history: PolicyVersion[] }) {
  return (
    <details className="finance-history">
      <summary>Financial policy history</summary>
      <p>
        Latest 100 recorded versions, newest version first. Effective time determines
        which policy applies.
      </p>
      {history.length === 0 && <p>No financial policy has been recorded.</p>}
      {history.map((row) => (
        <details key={row.id} className="finance-version">
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
function CurrentPolicy({ state }: { state: FinanceWorkspace }) {
  return (
    <>
      <section className="finance-current" aria-labelledby="finance-current-title">
        <div className="finance-section-heading">
          <h2 id="finance-current-title">Current policy</h2>
          {state.current && (
            <span
              className={
                state.current.approvalStatus === "APPROVED"
                  ? "finance-approved"
                  : "finance-draft"
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
            <p className="finance-meta">
              Version {state.current.version} · Effective{" "}
              {formatBusinessDate(state.current.effectiveAt)}
            </p>
            <PolicyFacts row={state.current} />
          </>
        ) : (
          <p>No financial policy is effective at this check.</p>
        )}
        <p className="finance-checked">
          Checked {formatBusinessDate(state.evaluatedAt)}. Refresh to check for scheduled
          changes.
        </p>
      </section>
      <dl className="finance-schedule">
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
function FinanceEditor({
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
  const record = useResource("/staff/finance-policy/current", parseFinanceWorkspace);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [validation, setValidation] = useState<string>();
  const [invalidField, setInvalidField] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const reviewButton = useRef<HTMLButtonElement>(null);
  const focusAfterReview = useRef(false);
  const [pending, setPending] = useState<FinancePolicyPending>();
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState<FinanceWorkspace>();
  const [acknowledged, setAcknowledged] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string>();
  const [formRevision, setFormRevision] = useState(0);
  const [savedPolicy, setSavedPolicy] = useState<PolicyVersion>();
  const active = useRef(true),
    request = useRef<AbortController | null>(null),
    flight = useRef(false);
  const latest = record.data?.latest;
  const previous = financeSettingsSchema.safeParse(
    savedPolicy?.settings ?? latest?.settings,
  );
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
      if (success) document.getElementById("finance-success-title")?.focus();
      else if (pending) document.getElementById("finance-recovery-title")?.focus();
      else reviewButton.current?.focus();
      focusAfterReview.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [proposal, record.loading, pending, success]);
  useEffect(() => {
    active.current = true;
    queueMicrotask(() => {
      if (active.current) {
        setPending(readFinancePolicyPending(owner, role));
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
      throw Error("Financial policy account changed");
  }
  function denied(error: unknown) {
    if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
      onDenied();
      return true;
    }
    return false;
  }
  async function fresh(signal: AbortSignal, publish = false) {
    const profile = parseOwnStaffProfile(
      (await apiRequest("/staff/profile", { signal })).data,
    );
    identity(signal);
    if (
      profile.id !== owner ||
      profile.role !== role ||
      profile.status !== "ACTIVE" ||
      (!profile.capabilities.includes("FINANCE_POLICY_APPROVE") &&
        (publish || role !== "SUPER_ADMIN"))
    )
      throw new ApiError(403, { error: { code: "FORBIDDEN" } });
    const state = parseFinanceWorkspace(
      (await apiRequest("/staff/finance-policy/current", { signal })).data,
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
    document.getElementById(`finance-${field}`)?.focus();
  }
  function review(form: FormData, submittedAt: number) {
    if (disabled) return;
    setValidation(undefined);
    setInvalidField(undefined);
    setRecovery(undefined);
    setAcknowledged(false);
    setMessage(undefined);
    setSuccess(undefined);
    const delivery = String(form.get("deliveryTaxable") ?? "");
    if (!["yes", "no"].includes(delivery)) {
      invalid("Choose the approved VAT treatment for delivery fees.", "deliveryTaxable");
      return;
    }
    const settings = financeSettingsSchema.safeParse({
      vatBasisPoints: 750,
      pricesIncludeVat: false,
      rounding: "HALF_UP_MINOR_UNIT",
      discountTreatment: "BEFORE_VAT",
      applicability: "ALL_PRODUCTS_AND_SERVICES",
      deliveryTaxable: delivery === "yes",
      invoiceName: String(form.get("invoiceName") ?? ""),
      invoiceAddress: String(form.get("invoiceAddress") ?? ""),
      paymentTerms: String(form.get("paymentTerms") ?? ""),
    });
    if (!settings.success) {
      const field = invoiceFields.find(
        (entry) => entry.name === settings.error.issues[0]?.path[0],
      );
      invalid(
        field
          ? `${field.label} must contain ${field.min}–${field.max} characters.`
          : "Review the financial settings.",
        field?.name ?? "invoiceName",
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
        "Record the written accounting approval or its reference in 20–1,000 characters.",
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
    const expectedVersion = latest?.version ?? 0;
    setProposal({
      title: "Approve this financial policy?",
      description:
        "This records the accounting approval used for live checkout and invoicing when it takes effect. Existing transaction snapshots remain unchanged. Confirm that the settings and written approval are correct.",
      facts: [
        ...invoiceFields.map(({ name, label }) => ({
          label,
          value: settings.data[name],
        })),
        { label: "VAT", value: "7.5%, added to prices; all products and services" },
        { label: "Discounts", value: "Applied before VAT" },
        { label: "Rounding", value: "Nearest kobo, rounding half up" },
        {
          label: "Delivery fees",
          value: settings.data.deliveryTaxable ? "Subject to VAT" : "Not subject to VAT",
        },
        {
          label: "Effective",
          value: immediate ? "On confirmation" : formatBusinessDate(`${start}:00+01:00`),
        },
        { label: "Approval source", value: source },
        { label: "Written accounting approval", value: approvalEvidence },
        { label: "New version", value: String(expectedVersion + 1) },
      ],
      submit: async () => {
        if (flight.current) throw new PreflightError();
        flight.current = true;
        request.current?.abort();
        const controller = new AbortController();
        request.current = controller;
        let sent = false,
          marker: Exclude<FinancePolicyPending, "unknown"> | undefined;
        try {
          if (readFinancePolicyPending(owner, role))
            throw Error("Earlier approval needs reconciliation");
          const current = await fresh(controller.signal, true);
          if ((current.latest?.version ?? 0) !== expectedVersion)
            throw Error("Policy version changed");
          const body: FinanceInput = {
            kind: "FINANCE",
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
          const fingerprint = await financePolicyFingerprint(body);
          identity(controller.signal);
          marker = markFinancePolicyPending(owner, role, {
            expectedVersion,
            fingerprint,
          });
          setPending(marker);
          cancelDraftSubmission();
          sent = true;
          const saved = validateFinanceReceipt(
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
          clearFinancePolicyPending(owner, role, marker.token);
          setSavedPolicy(saved);
          setPending(undefined);
          forgetDraft(
            draftKey(owner + ":" + role, "/admin/finance-policy", "finance-policy:1"),
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
            if (marker) clearFinancePolicyPending(owner, role, marker.token);
            setPending(readFinancePolicyPending(owner, role));
            setMessage(
              sent
                ? "The server rejected this approval. Refresh the policy before reviewing your draft again."
                : "No approval request was sent. Refresh the policy and review your draft.",
            );
            throw sent ? error : new PreflightError();
          }
          setPending(readFinancePolicyPending(owner, role));
          throw Error("Approval outcome uncertain");
        } finally {
          flight.current = false;
        }
      },
      onUncertain: () => setPending(readFinancePolicyPending(owner, role)),
      retryAfterRejection: false,
    });
  }
  return (
    <section className="finance-workspace" aria-label="Financial policy review">
      <div className="finance-toolbar">
        <p>Invoice settings and written accounting approval.</p>
        <button
          className="button secondary"
          disabled={record.loading || !!proposal || recovering}
          onClick={() => {
            record.refresh();
            refreshPermission();
          }}
        >
          Refresh financial policy
        </button>
      </div>
      <Feedback message={record.error ?? record.refreshError} />
      <Feedback message={message} />
      {success && (
        <section className="finance-success">
          <h2 id="finance-success-title" tabIndex={-1}>
            Financial policy recorded
          </h2>
          <Feedback message={success} tone="success" toast="Financial policy approved." />
        </section>
      )}
      {record.loading && <p role="status">Loading financial policy…</p>}
      {pending && (
        <section className="finance-recovery" aria-labelledby="finance-recovery-title">
          <h2 id="finance-recovery-title" tabIndex={-1}>
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
              <label className="finance-ack">
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
                    clearFinancePolicyPending(owner, role);
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
          <CurrentPolicy state={record.data} />
          {!canApprove ? (
            <Feedback message="An active financial-policy approval permission is required to publish a version, including for Super Admin." />
          ) : (
            <form
              data-draft-key="finance-policy:1"
              key={formRevision}
              className="finance-form"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                review(new FormData(event.currentTarget), new Date().getTime());
              }}
            >
              <fieldset disabled={disabled}>
                <legend>New approval</legend>
                <p>
                  The application currently uses 7.5% VAT added to prices, discounts
                  before VAT and rounding half up to the nearest kobo, across all products
                  and services. Record the written accounting approval for these settings.
                </p>
                <p className="finance-draft-source">
                  Form starts from the latest recorded version, which may be scheduled.
                  Refreshing retains your unsent draft.
                </p>
                <div className="finance-fields">
                  {invoiceFields.map(({ name, label, min, max }) => {
                    const Field = name === "invoiceName" ? "input" : "textarea";
                    return (
                      <div className="field" key={name}>
                        <label htmlFor={`finance-${name}`}>{label}</label>
                        <Field
                          id={`finance-${name}`}
                          name={name}
                          minLength={min}
                          maxLength={max}
                          required
                          aria-invalid={invalidField === name}
                          aria-describedby={
                            invalidField === name ? "finance-validation" : undefined
                          }
                          defaultValue={previous.success ? previous.data[name] : ""}
                        />
                      </div>
                    );
                  })}
                  <div className="field">
                    <label htmlFor="finance-deliveryTaxable">VAT on delivery fees</label>
                    <select
                      id="finance-deliveryTaxable"
                      name="deliveryTaxable"
                      aria-invalid={invalidField === "deliveryTaxable"}
                      aria-describedby={
                        invalidField === "deliveryTaxable"
                          ? "finance-validation"
                          : undefined
                      }

                      required
                      defaultValue={
                        previous.success
                          ? previous.data.deliveryTaxable
                            ? "yes"
                            : "no"
                          : ""
                      }
                    >
                      <option value="">Choose the approved treatment</option>
                      <option value="yes">Subject to VAT</option>
                      <option value="no">Not subject to VAT</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="finance-effectiveAt">
                      Effective date and time (Lagos time, optional)
                    </label>
                    <input
                      id="finance-effectiveAt"
                      name="effectiveAt"
                      aria-invalid={invalidField === "effectiveAt"}

                      type="datetime-local"
                      aria-describedby={
                        invalidField === "effectiveAt"
                          ? "finance-effective-help finance-validation"
                          : "finance-effective-help"
                      }
                    />
                    <span id="finance-effective-help" className="field-hint">
                      Leave empty to apply on confirmation, or schedule a future change.
                    </span>
                  </div>
                  <div className="field">
                    <label htmlFor="finance-source">Approval source</label>
                    <input
                      id="finance-source"
                      name="source"
                      aria-invalid={invalidField === "source"}
                      aria-describedby={
                        invalidField === "source" ? "finance-validation" : undefined
                      }

                      required
                      minLength={10}
                      maxLength={500}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="finance-approvalEvidence">
                      Written accounting approval or reference
                    </label>
                    <textarea
                      id="finance-approvalEvidence"
                      name="approvalEvidence"
                      aria-invalid={invalidField === "approvalEvidence"}
                      aria-describedby={
                        invalidField === "approvalEvidence"
                          ? "finance-validation"
                          : undefined
                      }

                      required
                      minLength={20}
                      maxLength={1000}
                    />
                  </div>
                </div>
                <div id="finance-validation">
                  <Feedback message={validation} />
                </div>
                <button ref={reviewButton} className="button">
                  Review financial approval
                </button>
              </fieldset>
            </form>
          )}
          <FinanceHistory history={record.data.history} />
        </>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel="Approve financial policy"
          onClose={() => {
            focusAfterReview.current = true;
            setProposal(null);
          }}
          onSuccess={() =>
            setSuccess(
              "Financial policy approved. Review its effective date in policy history.",
            )
          }
        />
      )}
    </section>
  );
}
export function FinancePolicy() {
  const session = useAccountSession();
  const [denied, setDenied] = useState(false);
  const profile = useResource(
    session && session.user.role !== "CUSTOMER" ? "/staff/profile" : null,
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
    !!profile.data?.capabilities.includes("FINANCE_POLICY_APPROVE");
  const canRead =
    identityMatches &&
    !profile.error &&
    !profile.refreshError &&
    !denied &&
    profile.data?.status === "ACTIVE" &&
    (session?.user.role === "SUPER_ADMIN" ||
      !!profile.data?.capabilities.includes("FINANCE_POLICY_APPROVE"));
  return (
    <div className="work-finance-policy">
      <h1>Financial policy</h1>
      <Feedback message={profile.error ?? profile.refreshError} />
      {profile.loading && <p role="status">Checking your financial-policy permission…</p>}
      {canRead ? (
        <FinanceEditor
          canApprove={canApprove}
          key={session!.user.id + ":" + session!.user.role}
          owner={session!.user.id}
          role={session!.user.role}
          refreshPermission={profile.refresh}
          onDenied={() => {
            redactFinancePolicyChanges();
            setDenied(true);
          }}
        />
      ) : (
        !profile.loading && (
          <>
            <Feedback message="Financial policy access requires an active approval permission. Super Admin can also read the history." />
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
