"use client";
import { useState } from "react";
import type { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import { deliverySettingsSchema } from "@/lib/api/fulfillment-schemas";
import {
  parsePolicyHistory,
  policyVersionSchema,
  type PolicyVersion,
} from "@/lib/api/policy-schemas";
import { useResource } from "@/lib/api/use-resource";
import { business } from "@/lib/business";
import { lagosDateTime } from "@/lib/forms/vehicle-condition";
import { koboToInput, nairaToKobo } from "@/lib/format/currency-input";
import { formatBusinessDate } from "@/lib/format/date";
import { formatKobo } from "@/lib/format/money";
import { useAccountSession } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
type Settings = z.infer<typeof deliverySettingsSchema>;
type DeliveryInput = Extract<
  RequestBody<"/admin/policies", "post">,
  { kind: "DELIVERY" }
>;
const parseHistory = (value: unknown) => {
  const history = parsePolicyHistory(value);
  if (history.some((row) => row.key !== "delivery"))
    throw new Error("Unexpected delivery policy");
  return history;
};
function DeliveryForm({
  latest,
  disabled,
  onReview,
}: {
  latest?: PolicyVersion;
  disabled: boolean;
  onReview: (settings: Settings, form: FormData, submittedAt: number) => void;
}) {
  const previous = deliverySettingsSchema.safeParse(latest?.settings);
  const [zones, setZones] = useState(() =>
    previous.success
      ? previous.data.zones.map(({ feeKobo, ...zone }) => ({
          ...zone,
          fee: koboToInput(feeKobo),
        }))
      : [],
  );
  const [validation, setValidation] = useState<string>();
  function submit(form: FormData, submittedAt: number) {
    if (disabled) return;
    setValidation(undefined);
    const invalidFee = zones.findIndex(
      (zone) => !/^\d{1,13}(?:\.\d{1,2})?$/.test(zone.fee.trim()),
    );
    if (invalidFee !== -1) {
      setValidation("Enter a valid delivery fee in NGN, with up to two decimal places.");
      document.getElementById(`zone-${invalidFee}-fee`)?.focus();
      return;
    }
    const settings = deliverySettingsSchema.safeParse({
      collectionEnabled: true,
      collectionAddress: business.address,
      zones: zones.map(({ fee, ...zone }) => ({ ...zone, feeKobo: nairaToKobo(fee) })),
    });
    if (!settings.success) {
      const issue = settings.error.issues[0];
      const index = issue?.path[1];
      const field = issue?.path[2];
      setValidation(
        zones.length === 0
          ? "Add at least one approved delivery area."
          : "Review each area's name, city, state and fee. Names must contain at least two characters.",
      );
      document
        .getElementById(
          typeof index === "number" && typeof field === "string"
            ? `zone-${index}-${field}`
            : "add-delivery-area",
        )
        ?.focus();
      return;
    }
    onReview(settings.data, form, submittedAt);
  }
  return (
    <form
      className="line-entry-form"
      onSubmit={(event) => {
        event.preventDefault();
        submit(new FormData(event.currentTarget), new Date().getTime());
      }}
    >
      <Feedback message={validation} />
      <fieldset disabled={disabled}>
        <legend>Approved delivery areas and fees</legend>
        <p>
          Collection remains available at {business.address}. Enter only approved service
          areas and fees. This publishes the complete list and replaces the previous list
          for new orders once effective.
        </p>
        {zones.map((zone, index) => (
          <fieldset className="service-line-editor" key={zone.id}>
            <legend>Delivery area {index + 1}</legend>
            <div className="record-form-grid">
              {(
                [
                  { field: "label", label: "Area name", max: 160 },
                  { field: "city", label: "City", max: 120 },
                  { field: "state", label: "State", max: 120 },
                  { field: "fee", label: "Delivery fee (NGN, before tax)", max: 16 },
                ] as const
              ).map(({ field, label, max }) => (
                <div className="field" key={field}>
                  <label htmlFor={`zone-${index}-${field}`}>{label}</label>
                  <input
                    id={`zone-${index}-${field}`}
                    required
                    maxLength={max}
                    inputMode={field === "fee" ? "decimal" : undefined}
                    value={zone[field]}
                    onChange={(event) =>
                      setZones((current) =>
                        current.map((item) =>
                          item.id === zone.id
                            ? { ...item, [field]: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                setZones((current) => current.filter((item) => item.id !== zone.id))
              }
            >
              Remove area {index + 1}
            </button>
          </fieldset>
        ))}
        <button
          id="add-delivery-area"
          type="button"
          className="button secondary"
          disabled={zones.length >= 100}
          onClick={() =>
            setZones((current) => [
              ...current,
              { id: crypto.randomUUID(), label: "", city: "", state: "", fee: "" },
            ])
          }
        >
          Add delivery area
        </button>
        <div className="field">
          <label htmlFor="delivery-effective">
            Effective date and time (Lagos time, optional)
          </label>
          <input
            id="delivery-effective"
            name="effectiveAt"
            type="datetime-local"
            aria-describedby="delivery-effective-help"
          />
          <span id="delivery-effective-help" className="field-hint">
            Leave empty to apply on confirmation, or schedule a future change.
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
          />
        </div>
        <div className="field">
          <label htmlFor="delivery-approval">Written approval or reference</label>
          <textarea
            id="delivery-approval"
            name="approvalEvidence"
            required
            minLength={20}
            maxLength={1000}
          />
        </div>
        <button className="button">Review delivery approval</button>
      </fieldset>
    </form>
  );
}
function DeliveryHistory({ history }: { history: PolicyVersion[] }) {
  return (
    <details className="detail-section">
      <summary>Delivery policy history</summary>
      <p>
        Latest 100 recorded versions. A scheduled version takes effect at its recorded
        start time.
      </p>
      {history.length === 0 && <p>No delivery policy has been recorded.</p>}
      {history.map((row) => {
        const settings = deliverySettingsSchema.safeParse(row.settings);
        return (
          <article className="detail-section" key={row.id}>
            <h3>
              Version {row.version} · {row.approvalStatus.replaceAll("_", " ")}
            </h3>
            <p>Effective {formatBusinessDate(row.effectiveAt)}</p>
            <p>Recorded {formatBusinessDate(row.recordedAt)}</p>
            {settings.success ? (
              <ul>
                {settings.data.zones.map((zone) => (
                  <li key={zone.id}>
                    {zone.label} · {zone.city}, {zone.state} · {formatKobo(zone.feeKobo)}{" "}
                    before any applicable tax
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                This draft or older version does not contain an approved delivery-area
                list.
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
function DeliveryEditor() {
  const record = useResource("/admin/policies?key=delivery&limit=100", parseHistory);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [validation, setValidation] = useState<string>();
  const [message, setMessage] = useState<string>();
  const latest = record.data?.reduce<PolicyVersion | undefined>(
    (found, row) => (!found || row.version > found.version ? row : found),
    undefined,
  );
  const disabled =
    record.loading || !!record.error || !record.data || !!proposal || uncertain;
  function invalid(message: string, id: string) {
    setValidation(message);
    document.getElementById(id)?.focus();
  }
  function review(settings: Settings, form: FormData, submittedAt: number) {
    if (disabled) return;
    setValidation(undefined);
    setMessage(undefined);
    const source = String(form.get("source") ?? "").trim();
    const approvalEvidence = String(form.get("approvalEvidence") ?? "").trim();
    if (source.length < 10 || source.length > 500) {
      invalid("Describe the approval source in 10–500 characters.", "delivery-source");
      return;
    }
    if (approvalEvidence.length < 20 || approvalEvidence.length > 1000) {
      invalid(
        "Record the written approval or its reference in 20–1,000 characters.",
        "delivery-approval",
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
        "delivery-effective",
      );
      return;
    }
    const expectedVersion = latest?.version ?? 0;
    setProposal({
      title: "Approve these delivery areas?",
      description:
        "This publishes the complete delivery-area list and fees for new orders when effective. Checkout also requires the financial policy and delivery tax treatment to be configured. Existing orders retain their saved fees and addresses.",
      facts: [
        ...settings.zones.map((zone, index) => ({
          label: `Area ${index + 1}`,
          value: `${zone.label} · ${zone.city}, ${zone.state} · ${formatKobo(zone.feeKobo)} before applicable tax`,
        })),
        { label: "Collection address", value: business.address },
        {
          label: "Effective",
          value: immediate ? "On confirmation" : formatBusinessDate(`${start}:00+01:00`),
        },
        { label: "Approval source", value: source },
        { label: "Approval record", value: approvalEvidence },
        { label: "New version", value: String(expectedVersion + 1) },
      ],
      submit: async () => {
        const body: DeliveryInput = {
          kind: "DELIVERY",
          expectedVersion,
          effectiveAt: immediate
            ? new Date().toISOString()
            : new Date(`${start}:00+01:00`).toISOString(),
          source,
          approvalEvidence,
          settings,
        };
        const result = policyVersionSchema.parse(
          (await apiRequest("/admin/policies", { method: "POST", csrf: true, body }))
            .data,
        );
        const saved = deliverySettingsSchema.parse(result.settings);
        if (
          result.key !== "delivery" ||
          result.version !== expectedVersion + 1 ||
          result.approvalStatus !== "APPROVED" ||
          result.source !== source ||
          result.approvalEvidence !== approvalEvidence ||
          Date.parse(result.effectiveAt) !== Date.parse(body.effectiveAt) ||
          JSON.stringify(saved) !== JSON.stringify(settings)
        )
          throw new Error("Unexpected delivery policy result");
      },
      onUncertain: () => setUncertain(true),
      retryAfterRejection: false,
    });
  }
  return (
    <>
      <Feedback message={record.error} />
      <Feedback message={validation} />
      <Feedback message={message} tone="success" toast="Delivery policy approved." />
      {uncertain && (
        <Feedback
          tone="warning"
          message="The approval outcome is uncertain. Review the refreshed policy history before reloading to make any further change."
        />
      )}
      <button
        className="button secondary"
        disabled={record.loading || !!proposal}
        onClick={record.refresh}
      >
        Refresh delivery policy
      </button>
      {record.loading && <p role="status">Loading delivery policy…</p>}
      {record.data && (
        <>
          <p>
            {latest
              ? `Latest recorded version: ${latest.version}.`
              : "No delivery policy has been recorded."}
          </p>
          {latest && (
            <p>
              Latest version effective {formatBusinessDate(latest.effectiveAt)}. Review
              scheduled versions before approving another change.
            </p>
          )}
          <DeliveryForm
            key={latest?.version ?? 0}
            latest={latest}
            disabled={disabled}
            onReview={review}
          />
          <DeliveryHistory history={record.data} />
        </>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel="Approve delivery"
          onClose={() => {
            setProposal(null);
            record.refresh();
          }}
          onSuccess={() =>
            setMessage(
              "Delivery policy approved. Review its effective date in policy history.",
            )
          }
        />
      )}
    </>
  );
}
export function DeliveryPolicy() {
  const session = useAccountSession();
  return (
    <>
      <h1>Delivery setup</h1>
      <p>
        Record the approved delivery areas, fees and written approval used at checkout.
      </p>
      {session?.user.role === "SUPER_ADMIN" ? (
        <DeliveryEditor />
      ) : (
        <Feedback message="Super Admin access is required to configure delivery." />
      )}
    </>
  );
}
