"use client";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import { documentTypes } from "@/lib/api/vehicle-document-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import { VehicleAssetUpload, type AssetSelection } from "./vehicle-asset-upload";
import { Feedback } from "./feedback";
import type { MutationProposal } from "./mutation-review";

const optionalDate = z.union([
  z.literal(""),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose a Lagos date and time.")
    .refine(
      (value) => z.iso.datetime({ offset: true }).safeParse(`${value}:00+01:00`).success,
      "Choose a valid date and time.",
    ),
]);
const schema = z.object({
  altText: z.string().trim().max(240),
  sortOrder: z
    .string()
    .regex(/^\d+$/, "Enter a whole number from 0 to 10000.")
    .refine((value) => Number(value) <= 10000, "Enter a whole number from 0 to 10000."),
  isPrimary: z.boolean(),
  type: z.enum(documentTypes),
  issuedAt: optionalDate,
  expiresAt: optionalDate,
});
export function VehicleAttachmentForm({
  vehicleId,
  kind,
  disabled,
  onReview,
}: {
  vehicleId: string;
  kind: "IMAGE" | "DOCUMENT";
  disabled: boolean;
  onReview: (proposal: MutationProposal) => void;
}) {
  const [selection, setSelection] = useState<AssetSelection>(null);
  const [error, setError] = useState<string>();
  const [locked, setLocked] = useState(false);
  const change = useCallback((next: AssetSelection) => {
    setSelection(next);
    setError(undefined);
  }, []);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      altText: "",
      sortOrder: "0",
      isPrimary: false,
      type: "OTHER",
      issuedAt: "",
      expiresAt: "",
    },
  });
  function review(values: z.infer<typeof schema>, now: number) {
    if (disabled || locked) return;
    if (!selection?.prepared || selection.prepared.expiresAt <= now) {
      setError(
        "Choose and upload a file before continuing. Expired uploads must be uploaded again.",
      );
      document.getElementById(`asset-${kind}`)?.focus();
      return;
    }
    setError(undefined);
    const body:
      | RequestBody<"/staff/vehicles/{vehicleId}/images", "post">
      | RequestBody<"/staff/vehicles/{vehicleId}/documents", "post"> =
      kind === "IMAGE"
        ? {
            assetToken: selection.prepared.token,
            altText: values.altText || null,
            sortOrder: Number(values.sortOrder),
            isPrimary: values.isPrimary,
          }
        : {
            assetToken: selection.prepared.token,
            type: values.type,
            issuedAt: values.issuedAt ? `${values.issuedAt}:00+01:00` : null,
            expiresAt: values.expiresAt ? `${values.expiresAt}:00+01:00` : null,
          };
    onReview({
      title:
        kind === "IMAGE"
          ? "Attach this public vehicle photo?"
          : "Attach this private vehicle document?",
      description:
        kind === "IMAGE"
          ? "This photo can appear on all available listings for this vehicle. A new primary photo replaces the previous primary selection. Attached photos cannot be edited or removed through the current application."
          : "This creates a private document with a pending review. Its type and dates cannot be edited or removed through the current application. Authorized staff must request temporary download access.",
      facts: [
        { label: "File", value: selection.name },
        ...(kind === "IMAGE"
          ? [
              { label: "Photo description", value: values.altText || "No description" },
              { label: "Display order", value: values.sortOrder },
              { label: "Primary photo", value: values.isPrimary ? "Yes" : "No" },
            ]
          : [
              { label: "Document type", value: values.type.replaceAll("_", " ") },
              {
                label: "Issued",
                value: values.issuedAt
                  ? formatBusinessDate(`${values.issuedAt}:00+01:00`)
                  : "Not recorded",
              },
              {
                label: "Expires",
                value: values.expiresAt
                  ? formatBusinessDate(`${values.expiresAt}:00+01:00`)
                  : "Not recorded",
              },
            ]),
      ],
      onUncertain: () => setLocked(true),
      submit: async () => {
        await apiRequest(
          `/staff/vehicles/${vehicleId}/${kind === "IMAGE" ? "images" : "documents"}`,
          { method: "POST", csrf: true, body },
        );
        setLocked(true);
      },
    });
  }
  const prefix = `attachment-${kind}`;
  return (
    <form
      noValidate
      onSubmit={(event) => {
        const now = Date.now();
        void form.handleSubmit((values) => review(values, now))(event);
      }}
    >
      {locked && (
        <p role="status" className="notice">
          The attachment request has been sent. Refresh the stock record and check its
          attachments before creating another. This form will not resend it.
        </p>
      )}
      <fieldset className="handover-fields" disabled={disabled || locked}>
        <VehicleAssetUpload
          vehicleId={vehicleId}
          kind={kind}
          label={
            kind === "IMAGE" ? "Vehicle photo file" : "Private vehicle document file"
          }
          disabled={disabled || locked}
          onChange={change}
        />
        <Feedback message={error} />
        {kind === "IMAGE" ? (
          <>
            <div className="field">
              <label htmlFor={`${prefix}-alt`}>Photo description (optional)</label>
              <input
                id={`${prefix}-alt`}
                {...form.register("altText")}
                maxLength={240}
                aria-describedby={`${prefix}-alt-hint`}
              />
              <p id={`${prefix}-alt-hint`} className="field-hint">
                Describe the visible vehicle and view for people who cannot see the photo.
                Include only approved public information.
              </p>
            </div>
            <div className="field">
              <label htmlFor={`${prefix}-order`}>Photo display order</label>
              <input
                id={`${prefix}-order`}
                {...form.register("sortOrder")}
                inputMode="numeric"
                maxLength={5}
                aria-invalid={!!form.formState.errors.sortOrder}
                aria-describedby={`${prefix}-order-hint`}
              />
              <p
                id={`${prefix}-order-hint`}
                className={form.formState.errors.sortOrder ? "field-error" : "field-hint"}
              >
                {form.formState.errors.sortOrder?.message ??
                  "0 to 10000; lower values appear first."}
              </p>
            </div>
            <label className="checkbox">
              <input type="checkbox" {...form.register("isPrimary")} />
              Use as the primary photo
            </label>
          </>
        ) : (
          <>
            <div className="field">
              <label htmlFor={`${prefix}-type`}>Document type</label>
              <select id={`${prefix}-type`} {...form.register("type")}>
                {documentTypes.map((type) => (
                  <option key={type} value={type}>
                    {type.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            {(
              [
                { name: "issuedAt", label: "Document issued at (optional, Lagos time)" },
                {
                  name: "expiresAt",
                  label: "Document expires at (optional, Lagos time)",
                },
              ] as const
            ).map(({ name, label }) => (
              <div className="field" key={name}>
                <label htmlFor={`${prefix}-${name}`}>{label}</label>
                <input
                  id={`${prefix}-${name}`}
                  {...form.register(name)}
                  type="datetime-local"
                  aria-invalid={!!form.formState.errors[name]}
                  aria-describedby={
                    form.formState.errors[name] ? `${prefix}-${name}-error` : undefined
                  }
                />
                {form.formState.errors[name] && (
                  <p className="field-error" role="alert" id={`${prefix}-${name}-error`}>
                    {form.formState.errors[name]?.message}
                  </p>
                )}
              </div>
            ))}
          </>
        )}
        <button className="button">
          {kind === "IMAGE" ? "Review photo attachment" : "Review document attachment"}
        </button>
      </fieldset>
    </form>
  );
}
