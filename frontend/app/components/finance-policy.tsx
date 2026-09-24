"use client";
import { useState } from "react";
import { apiRequest } from "@/lib/api/client";
import { parseOwnStaffProfile } from "@/lib/api/capability-schemas";
import type { RequestBody } from "@/lib/api/contracts";
import {
  financeSettingsSchema,
  parseFinanceHistory,
  policyVersionSchema,
  type PolicyVersion,
} from "@/lib/api/policy-schemas";
import { useResource } from "@/lib/api/use-resource";
import { lagosDateTime } from "@/lib/forms/vehicle-condition";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";

type FinanceInput = Extract<RequestBody<"/admin/policies", "post">, { kind: "FINANCE" }>;
const invoiceFields = [
  { name: "invoiceName", label: "Invoice business name", min: 2, max: 200 },
  { name: "invoiceAddress", label: "Invoice business address", min: 10, max: 500 },
  { name: "paymentTerms", label: "Payment terms", min: 10, max: 1000 },
] as const;
function FinanceHistory({ history }: { history: PolicyVersion[] }) {
  return (
    <details className="detail-section">
      <summary>Financial policy history</summary>
      <p>
        Latest 100 recorded versions. Scheduled versions take effect at their recorded
        start times.
      </p>
      {history.length === 0 && <p>No financial policy has been recorded.</p>}
      {history.map((row) => {
        const settings = financeSettingsSchema.safeParse(row.settings);
        return (
          <article className="detail-section" key={row.id}>
            <h3>
              Version {row.version} · {row.approvalStatus.replaceAll("_", " ")}
            </h3>
            <p>Effective {formatBusinessDate(row.effectiveAt)}</p>
            <p>Recorded {formatBusinessDate(row.recordedAt)}</p>
            {settings.success ? (
              <dl className="totals">
                {invoiceFields.map(({ name, label }) => (
                  <div className="spec-row" key={name}>
                    <dt>{label}</dt>
                    <dd>{settings.data[name]}</dd>
                  </div>
                ))}
                <dt>VAT</dt>
                <dd>7.5%, added to prices, across all products and services</dd>
                <dt>Discounts</dt>
                <dd>Applied before VAT</dd>
                <dt>Rounding</dt>
                <dd>Nearest kobo, rounding half up</dd>
                <dt>Delivery fees</dt>
                <dd>
                  {settings.data.deliveryTaxable
                    ? "Subject to VAT"
                    : "Not subject to VAT"}
                </dd>
              </dl>
            ) : (
              <p>
                This draft or older version does not contain all settings required by the
                current approval form.
              </p>
            )}
            <p>Approval source: {row.source}</p>
            <p>Approval record: {row.approvalEvidence ?? "Not recorded"}</p>
          </article>
        );
      })}
    </details>
  );
}
function FinanceEditor({
  canApprove,
  refreshPermission,
  uncertain,
  onUncertain,
}: {
  canApprove: boolean;
  refreshPermission: () => void;
  uncertain: boolean;
  onUncertain: () => void;
}) {
  const record = useResource("/staff/finance-policy", parseFinanceHistory);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [validation, setValidation] = useState<string>();
  const [message, setMessage] = useState<string>();
  const latest = record.data?.reduce<PolicyVersion | undefined>(
    (found, row) => (!found || row.version > found.version ? row : found),
    undefined,
  );
  const previous = financeSettingsSchema.safeParse(latest?.settings);
  const disabled =
    !canApprove ||
    record.loading ||
    !!record.error ||
    !record.data ||
    !!proposal ||
    uncertain;
  function invalid(message: string, field: string) {
    setValidation(message);
    document.getElementById(`finance-${field}`)?.focus();
  }
  function review(form: FormData, submittedAt: number) {
    if (disabled) return;
    setValidation(undefined);
    setMessage(undefined);
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
        const body: FinanceInput = {
          kind: "FINANCE",
          expectedVersion,
          settings: settings.data,
          source,
          approvalEvidence,
          effectiveAt: immediate
            ? new Date().toISOString()
            : new Date(`${start}:00+01:00`).toISOString(),
        };
        const result = policyVersionSchema.parse(
          (await apiRequest("/admin/policies", { method: "POST", csrf: true, body }))
            .data,
        );
        const saved = financeSettingsSchema.parse(result.settings);
        if (
          result.key !== "finance" ||
          result.version !== expectedVersion + 1 ||
          result.approvalStatus !== "APPROVED" ||
          result.source !== source ||
          result.approvalEvidence !== approvalEvidence ||
          Date.parse(result.effectiveAt) !== Date.parse(body.effectiveAt) ||
          JSON.stringify(saved) !== JSON.stringify(settings.data)
        )
          throw new Error("Unexpected financial policy result");
      },
      onUncertain,
      retryAfterRejection: false,
    });
  }
  return (
    <section className="detail-section" aria-label="Financial policy review">
      <Feedback message={record.error} />
      <Feedback message={validation} />
      <Feedback message={message} tone="success" toast="Financial policy approved." />
      {uncertain && (
        <Feedback
          tone="warning"
          message="The approval outcome is uncertain. Review the refreshed history before reloading to make any further change."
        />
      )}
      <button
        className="button secondary"
        disabled={record.loading || !!proposal}
        onClick={() => {
          record.refresh();
          refreshPermission();
        }}
      >
        Refresh financial policy
      </button>
      {record.loading && <p role="status">Loading financial policy…</p>}
      {record.data && (
        <>
          <p>
            {latest
              ? `Latest recorded version: ${latest.version}.`
              : "No financial policy has been recorded."}
          </p>
          {latest && (
            <p>
              Latest version effective {formatBusinessDate(latest.effectiveAt)}. Review
              scheduled versions before approving another change.
            </p>
          )}
          {!canApprove ? (
            <Feedback message="An active financial-policy approval permission is required to publish a version, including for Super Admin." />
          ) : (
            <form
              key={latest?.version ?? 0}
              onSubmit={(event) => {
                event.preventDefault();
                review(new FormData(event.currentTarget), new Date().getTime());
              }}
            >
              <fieldset disabled={disabled}>
                <legend>Accounting approval</legend>
                <p>
                  The application currently uses 7.5% VAT added to prices, discounts
                  before VAT and rounding half up to the nearest kobo, across all products
                  and services. Record the written accounting approval for these settings.
                </p>
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
                    type="datetime-local"
                    aria-describedby="finance-effective-help"
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
                    required
                    minLength={20}
                    maxLength={1000}
                  />
                </div>
                <button className="button">Review financial approval</button>
              </fieldset>
            </form>
          )}
          <FinanceHistory history={record.data} />
        </>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel="Approve financial policy"
          onClose={() => {
            setProposal(null);
            record.refresh();
          }}
          onSuccess={() =>
            setMessage(
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
  const [uncertain, setUncertain] = useState(false);
  const profile = useResource(
    session && session.user.role !== "CUSTOMER" ? "/staff/profile" : null,
    parseOwnStaffProfile,
  );
  const identityMatches =
    profile.data?.id === session?.user.id && profile.data?.role === session?.user.role;
  const canApprove =
    identityMatches &&
    !profile.error &&
    !profile.loading &&
    !!profile.data?.capabilities.includes("FINANCE_POLICY_APPROVE");
  const canRead =
    identityMatches &&
    !profile.error &&
    (session?.user.role === "SUPER_ADMIN" ||
      !!profile.data?.capabilities.includes("FINANCE_POLICY_APPROVE"));
  return (
    <>
      <h1>Financial policy</h1>
      <p>
        Review the invoice details, tax settings and written accounting approval used by
        Allied AutoTech.
      </p>
      <Feedback message={profile.error} />
      {profile.loading && <p role="status">Checking your financial-policy permission…</p>}
      {canRead ? (
        <FinanceEditor
          canApprove={canApprove}
          refreshPermission={profile.refresh}
          uncertain={uncertain}
          onUncertain={() => setUncertain(true)}
        />
      ) : (
        !profile.loading && (
          <>
            <Feedback message="Financial policy access requires an active approval permission. Super Admin can also read the history." />
            <button className="button secondary" onClick={profile.refresh}>
              Refresh permission
            </button>
          </>
        )
      )}
    </>
  );
}
