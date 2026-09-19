"use client";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import type { StaffVehicleSale } from "@/lib/api/staff-vehicle-sales-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import type { MutationProposal } from "./mutation-review";
import { VehicleAssetUpload, type AssetSelection } from "./vehicle-asset-upload";
import { PrivateDocumentAccess } from "./private-document-access";
import { Feedback } from "./feedback";

const wholeNumber = (maximum: number) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter a whole number, including zero where appropriate.")
    .refine(
      (value) => Number(value) <= maximum,
      `Enter a value no greater than ${maximum.toLocaleString("en-NG")}.`,
    );
const createSchema = z.object({
  recipientName: z.string().trim().min(1, "Enter the recipient’s name.").max(160),
  recipientPhone: z
    .string()
    .trim()
    .regex(
      /^\+?[1-9][0-9]{7,14}$/,
      "Enter an international phone number, for example +2348136075567.",
    ),
  odometerKm: wholeNumber(10_000_000),
  keysDelivered: wholeNumber(20),
});
type Props = {
  sale: StaffVehicleSale;
  disabled: boolean;
  onReview: (proposal: MutationProposal) => void;
};

export function VehicleHandoverCreate({ sale, disabled, onReview }: Props) {
  const [uncertain, setUncertain] = useState(false);
  const [attachment, setAttachment] = useState<AssetSelection>(null);
  const [attachmentError, setAttachmentError] = useState<string>();
  const changeAttachment = useCallback((selection: AssetSelection) => {
    setAttachment(selection);
    setAttachmentError(undefined);
  }, []);
  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      recipientName: "",
      recipientPhone: "",
      odometerKm: "",
      keysDelivered: "",
    },
  });
  function review(values: z.infer<typeof createSchema>, reviewedAt: number) {
    if (disabled || uncertain || sale.status !== "PAID" || sale.handover) return;
    setAttachmentError(undefined);
    if (
      attachment &&
      (!attachment.prepared || attachment.prepared.expiresAt <= reviewedAt)
    ) {
      setAttachmentError(
        "Upload the selected document before continuing, or remove it to proceed without an attachment. Expired uploads must be uploaded again.",
      );
      document.getElementById("asset-HANDOVER")?.focus();
      return;
    }
    const body: RequestBody<
      "/staff/vehicle-transactions/{transactionId}/handovers",
      "post"
    > = {
      recipientName: values.recipientName,
      recipientPhone: values.recipientPhone,
      odometerKm: Number(values.odometerKm),
      keysDelivered: Number(values.keysDelivered),
      ...(attachment?.prepared ? { assetToken: attachment.prepared.token } : {}),
    };
    onReview({
      title: "Create this handover record?",
      description:
        "This moves the paid purchase to handover pending. It does not complete delivery. Your account must have a staff profile to create a handover.",
      facts: [
        { label: "Transaction", value: sale.transactionNumber },
        { label: "Recipient", value: body.recipientName },
        { label: "Recipient phone", value: body.recipientPhone },
        { label: "Odometer", value: `${body.odometerKm.toLocaleString("en-NG")} km` },
        { label: "Keys", value: String(body.keysDelivered) },
        { label: "Signed document", value: attachment?.name ?? "No document attached" },
      ],
      onUncertain: () => setUncertain(true),
      submit: () =>
        apiRequest(`/staff/vehicle-transactions/${sale.id}/handovers`, {
          method: "POST",
          csrf: true,
          body,
        }),
    });
  }
  return (
    <section className="detail-section">
      <h2>Create handover</h2>
      <p>
        Record the recipient and the vehicle readings for this paid purchase. Check the
        details before continuing; they cannot be edited after creation.
      </p>
      {uncertain && (
        <p className="notice" role="status">
          Handover creation is unconfirmed. Refresh the purchase to check for its record.
          This form will not resend the request.
        </p>
      )}
      <form
        noValidate
        onSubmit={(event) => {
          const reviewedAt = Date.now();
          void form.handleSubmit((values) => review(values, reviewedAt))(event);
        }}
      >
        <fieldset className="handover-fields" disabled={disabled || uncertain}>
          {(
            [
              {
                name: "recipientName",
                label: "Recipient name",
                maxLength: 160,
                inputMode: "text",
              },
              {
                name: "recipientPhone",
                label: "Recipient phone (international format)",
                maxLength: 16,
                inputMode: "tel",
              },
              {
                name: "odometerKm",
                label: "Recorded odometer (km)",
                maxLength: 8,
                inputMode: "numeric",
              },
              {
                name: "keysDelivered",
                label: "Number of keys",
                maxLength: 2,
                inputMode: "numeric",
              },
            ] as const
          ).map((field) => (
            <div className="field" key={field.name}>
              <label htmlFor={`handover-${field.name}`}>{field.label}</label>
              <input
                id={`handover-${field.name}`}
                {...form.register(field.name)}
                inputMode={field.inputMode}
                maxLength={field.maxLength}
                autoComplete="off"
                aria-invalid={!!form.formState.errors[field.name]}
                aria-describedby={
                  form.formState.errors[field.name]
                    ? `handover-${field.name}-error`
                    : undefined
                }
              />
              {form.formState.errors[field.name] && (
                <p
                  id={`handover-${field.name}-error`}
                  className="field-error"
                  role="alert"
                >
                  {form.formState.errors[field.name]?.message}
                </p>
              )}
            </div>
          ))}
          <VehicleAssetUpload
            vehicleId={sale.vehicleListing.vehicle.id}
            kind="HANDOVER"
            label="Signed handover document (optional)"
            disabled={disabled || uncertain}
            onChange={changeAttachment}
          />
          <Feedback message={attachmentError} />
          <button className="button">Review new handover</button>
        </fieldset>
      </form>
    </section>
  );
}

const transitions = {
  PENDING: ["READY", "CANCELLED"],
  READY: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
} as const;
type Target = RequestBody<
  "/staff/vehicle-transactions/{transactionId}/handovers/{handoverId}/status",
  "post"
>["status"];
const explanations: Record<Target, string> = {
  READY:
    "This marks the handover ready. The purchase remains handover pending until completion is recorded.",
  COMPLETED:
    "Confirm only after the vehicle has been handed over. This completes the purchase and marks the vehicle listing sold. This action does not collect a payment.",
  CANCELLED:
    "This cancels the handover record. It does not refund payment, cancel the purchase or release the vehicle. The purchase remains handover pending. You cannot reopen or replace a cancelled handover; an administrator must coordinate recovery before delivery can continue.",
};

export function VehicleHandoverRecord({ sale, disabled, onReview }: Props) {
  const handover = sale.handover;
  const [target, setTarget] = useState<Target>(
    handover?.status === "READY" ? "COMPLETED" : "READY",
  );
  if (!handover) return null;
  const choices: readonly Target[] = transitions[handover.status];
  function review() {
    if (!handover || disabled || !choices.includes(target)) return;
    const body: RequestBody<
      "/staff/vehicle-transactions/{transactionId}/handovers/{handoverId}/status",
      "post"
    > = { status: target, expectedVersion: handover.version };
    onReview({
      title: "Change this handover status?",
      description: explanations[target],
      facts: [
        { label: "Transaction", value: sale.transactionNumber },
        { label: "Recipient", value: handover.recipientName ?? "Not recorded" },
        { label: "From", value: handover.status },
        { label: "To", value: target },
      ],
      submit: () =>
        apiRequest(
          `/staff/vehicle-transactions/${sale.id}/handovers/${handover.id}/status`,
          { method: "POST", csrf: true, body },
        ),
    });
  }
  return (
    <section className="detail-section">
      <h2>Recorded handover</h2>
      <p className="status">{handover.status}</p>
      <dl className="totals">
        <dt>Recipient</dt>
        <dd>{handover.recipientName ?? "Not recorded"}</dd>
        <dt>Recipient phone</dt>
        <dd>{handover.recipientPhone ?? "Not recorded"}</dd>
        <dt>Odometer</dt>
        <dd>
          {handover.odometerKm === null
            ? "Not recorded"
            : `${handover.odometerKm.toLocaleString("en-NG")} km`}
        </dd>
        <dt>Keys recorded</dt>
        <dd>{handover.keysDelivered}</dd>
      </dl>
      {handover.readyAt && <p>Ready {formatBusinessDate(handover.readyAt)}</p>}
      {handover.completedAt && (
        <p>Completed {formatBusinessDate(handover.completedAt)}</p>
      )}
      {handover.cancelledAt && (
        <p>Cancelled {formatBusinessDate(handover.cancelledAt)}</p>
      )}
      {handover.status === "CANCELLED" && sale.status === "HANDOVER_PENDING" && (
        <p className="notice">
          The purchase is still handover pending. You cannot reopen or replace this
          cancelled handover. Coordinate recovery with an administrator.
        </p>
      )}
      <PrivateDocumentAccess
        key={handover.id}
        path={`/staff/vehicle-transactions/${sale.id}/handovers/${handover.id}/access`}
        disabled={disabled}
        label="signed handover document"
      />
      {choices.length > 0 && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            review();
          }}
        >
          <fieldset disabled={disabled}>
            <div className="field">
              <label htmlFor="handover-status">Next handover status</label>
              <select
                id="handover-status"
                value={target}
                onChange={(event) => {
                  const next = choices.find((choice) => choice === event.target.value);
                  if (next) setTarget(next);
                }}
              >
                {choices.map((choice) => (
                  <option key={choice} value={choice}>
                    {choice}
                  </option>
                ))}
              </select>
            </div>
            <button className="button secondary">Review handover status</button>
          </fieldset>
        </form>
      )}
    </section>
  );
}
