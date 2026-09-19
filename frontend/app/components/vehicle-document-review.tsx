"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import type { VehicleDocument } from "@/lib/api/vehicle-document-schemas";
import type { MutationProposal } from "./mutation-review";

const schema = z
  .object({
    status: z.enum(["VERIFIED", "REJECTED"]),
    reason: z.string().trim().max(1000),
  })
  .superRefine((value, context) => {
    if (value.status === "REJECTED" && !value.reason)
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Explain why this document is rejected.",
      });
  });
export function VehicleDocumentReview({
  vehicleId,
  document,
  disabled,
  onReview,
}: {
  vehicleId: string;
  document: VehicleDocument;
  disabled: boolean;
  onReview: (proposal: MutationProposal) => void;
}) {
  const [loadedVersion, setLoadedVersion] = useState(document.version);
  const changed = loadedVersion !== document.version;
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { status: "VERIFIED", reason: "" },
  });
  const prefix = `document-${document.id}`;
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => {
        if (disabled || changed) return;
        const body: RequestBody<
          "/staff/vehicles/{vehicleId}/documents/{documentId}/review",
          "post"
        > = {
          status: values.status,
          expectedVersion: loadedVersion,
          ...(values.status === "REJECTED" ? { rejectionReason: values.reason } : {}),
        };
        onReview({
          title: "Record this document review?",
          description:
            "Confirm your assessment of the private document. Your account must have a staff profile. This does not change its contents or publish it.",
          facts: [
            { label: "Document type", value: document.type.replaceAll("_", " ") },
            { label: "Assessment", value: values.status },
            ...(values.status === "REJECTED"
              ? [{ label: "Reason", value: values.reason }]
              : []),
          ],
          submit: () =>
            apiRequest(`/staff/vehicles/${vehicleId}/documents/${document.id}/review`, {
              method: "POST",
              csrf: true,
              body,
            }),
        });
      })}
    >
      {changed && (
        <div className="notice">
          <p>
            The document review changed. Your input has been kept; reload before
            submitting another assessment.
          </p>
          <button
            type="button"
            className="button secondary"
            disabled={disabled}
            onClick={() => {
              form.reset({ status: "VERIFIED", reason: "" });
              setLoadedVersion(document.version);
            }}
          >
            Reload document review
          </button>
        </div>
      )}
      <fieldset className="handover-fields" disabled={disabled || changed}>
        <div className="field">
          <label htmlFor={`${prefix}-status`}>Document assessment</label>
          <select id={`${prefix}-status`} {...form.register("status")}>
            <option value="VERIFIED">Verified</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${prefix}-reason`}>
            Rejection reason (required when rejected)
          </label>
          <textarea
            id={`${prefix}-reason`}
            {...form.register("reason")}
            maxLength={1000}
            aria-invalid={!!form.formState.errors.reason}
            aria-describedby={`${prefix}-reason-hint`}
          />
          <p
            id={`${prefix}-reason-hint`}
            className={form.formState.errors.reason ? "field-error" : "field-hint"}
          >
            {form.formState.errors.reason?.message ??
              "The reason is sent only with a rejected assessment."}
          </p>
        </div>
        <button className="button secondary">Review document assessment</button>
      </fieldset>
    </form>
  );
}
