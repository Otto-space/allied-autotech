"use client";
import { useState } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import type { StaffVehicle } from "@/lib/api/staff-vehicle-schemas";
import {
  conditionFormSchema,
  conditionFindings,
  type ConditionValues,
} from "@/lib/forms/vehicle-condition";
import { formatBusinessDate } from "@/lib/format/date";
import { CompletedInspectionPicker } from "./completed-inspection-picker";
import type { MutationProposal } from "./mutation-review";
const defaults: ConditionValues = {
  inspectionId: "",
  inspectedAt: "",
  odometer: "",
  score: "",
  summary: "",
  findings: [],
};
export function VehicleConditionForm({
  vehicle,
  disabled,
  onReview,
}: {
  vehicle: StaffVehicle;
  disabled: boolean;
  onReview: (proposal: MutationProposal) => void;
}) {
  const [locked, setLocked] = useState(false);
  const [confirmedId, setConfirmedId] = useState<string>();
  const [linkInspection, setLinkInspection] = useState(false);
  const form = useForm<ConditionValues>({
    resolver: zodResolver(conditionFormSchema),
    defaultValues: defaults,
  });
  const fields = useFieldArray({ control: form.control, name: "findings" });
  const findings = useWatch({ control: form.control, name: "findings" });
  const inspectionId = useWatch({ control: form.control, name: "inspectionId" });
  function review(values: ConditionValues) {
    if (disabled || locked) return;
    const body: RequestBody<"/staff/vehicles/{vehicleId}/condition-reports", "post"> = {
      summary: values.summary,
      inspectedAt: `${values.inspectedAt}:00+01:00`,
      odometerKm: values.odometer === "" ? null : Number(values.odometer),
      conditionScore: values.score === "" ? null : Number(values.score),
      ...(values.inspectionId ? { inspectionId: values.inspectionId } : {}),
      ...(values.findings.length ? { findings: conditionFindings(values.findings) } : {}),
    };
    onReview({
      title: "Record this public condition report?",
      description:
        "The summary, readings and findings can appear on available listings for this vehicle. Include only approved public information. Reports cannot be edited through this application. The stock screen shows the report with the latest inspection time; an older report will not replace that summary.",
      facts: [
        { label: "Stock", value: vehicle.stockNumber },
        { label: "Inspected", value: formatBusinessDate(body.inspectedAt) },
        { label: "Summary", value: values.summary },
        {
          label: "Odometer",
          value: body.odometerKm === null ? "Not recorded" : `${body.odometerKm} km`,
        },
        {
          label: "Condition score",
          value:
            body.conditionScore === null
              ? "Not recorded"
              : `${body.conditionScore} / 100`,
        },
        {
          label: "Linked inspection",
          value: values.inspectionId
            ? (document.querySelector<HTMLSelectElement>("#condition-inspection")
                ?.selectedOptions[0]?.textContent ?? "Selected completed inspection")
            : "None",
        },
        ...Object.entries(body.findings ?? {}).map(([name, value], index) => ({
          label: `Finding ${index + 1}: ${name}`,
          value:
            value === null
              ? "Not recorded"
              : typeof value === "boolean"
                ? value
                  ? "Yes"
                  : "No"
                : String(value),
        })),
      ],
      onUncertain: () => setLocked(true),
      submit: async () => {
        const response = await apiRequest(
          `/staff/vehicles/${vehicle.id}/condition-reports`,
          { method: "POST", csrf: true, body },
        );
        const result = z.object({ id: z.string().uuid() }).parse(response.data);
        setConfirmedId(result.id);
        setLocked(true);
      },
    });
  }
  return (
    <form noValidate onSubmit={form.handleSubmit(review)}>
      {locked && (
        <p className="notice" role="status">
          {confirmedId
            ? "The condition report was recorded. Check the refreshed summary; reports with an earlier inspection time may not appear here."
            : "Report creation is unconfirmed. Refresh the record to check the latest report. This form will not resend it; an older report may require an administrator to verify its creation."}
        </p>
      )}
      {confirmedId && (
        <button
          type="button"
          className="button secondary"
          disabled={disabled}
          onClick={() => {
            form.reset(defaults);
            setConfirmedId(undefined);
            setLocked(false);
            setLinkInspection(false);
          }}
        >
          Record another condition report
        </button>
      )}
      <fieldset className="handover-fields" disabled={disabled || locked}>
        <p>
          Use the observed inspection time and readings. Optional fields can remain
          unrecorded.
        </p>
        <div className="record-form-grid">
          {(
            [
              {
                name: "inspectedAt",
                label: "Inspected at (Lagos time)",
                type: "datetime-local",
              },
              {
                name: "odometer",
                label: "Inspected odometer (optional, km)",
                type: "text",
              },
              { name: "score", label: "Condition score (optional, 0–100)", type: "text" },
            ] as const
          ).map((field) => (
            <div className="field" key={field.name}>
              <label htmlFor={`condition-${field.name}`}>{field.label}</label>
              <input
                id={`condition-${field.name}`}
                {...form.register(field.name)}
                type={field.type}
                inputMode={field.type === "text" ? "numeric" : undefined}
                aria-invalid={!!form.formState.errors[field.name]}
                aria-describedby={
                  form.formState.errors[field.name]
                    ? `condition-${field.name}-error`
                    : undefined
                }
              />
              {form.formState.errors[field.name] && (
                <p
                  role="alert"
                  className="field-error"
                  id={`condition-${field.name}-error`}
                >
                  {form.formState.errors[field.name]?.message}
                </p>
              )}
            </div>
          ))}
        </div>
        <div className="field">
          <label htmlFor="condition-summary">Public condition summary</label>
          <textarea
            id="condition-summary"
            {...form.register("summary")}
            maxLength={5000}
            rows={5}
            aria-invalid={!!form.formState.errors.summary}
            aria-describedby="condition-summary-hint"
          />
          <p
            id="condition-summary-hint"
            className={form.formState.errors.summary ? "field-error" : "field-hint"}
          >
            {form.formState.errors.summary?.message ??
              "Describe the findings factually. Do not include customer details or private document contents."}
          </p>
        </div>
        <h3>Additional public findings</h3>
        {fields.fields.map((field, index) => (
          <div className="detail-section" key={field.id}>
            <div className="field">
              <label htmlFor={`finding-${field.id}-name`}>Finding {index + 1} name</label>
              <input
                id={`finding-${field.id}-name`}
                {...form.register(`findings.${index}.name`)}
                maxLength={100}
                aria-invalid={!!form.formState.errors.findings?.[index]?.name}
                aria-describedby={`finding-${field.id}-error`}
              />
            </div>
            <div className="field">
              <label htmlFor={`finding-${field.id}-type`}>
                Finding {index + 1} answer type
              </label>
              <select
                id={`finding-${field.id}-type`}
                {...form.register(`findings.${index}.type`)}
              >
                <option value="TEXT">Text</option>
                <option value="NUMBER">Number</option>
                <option value="YES">Yes</option>
                <option value="NO">No</option>
                <option value="NOT_RECORDED">Not recorded</option>
              </select>
            </div>
            {(findings[index]?.type === "TEXT" || findings[index]?.type === "NUMBER") && (
              <div className="field">
                <label htmlFor={`finding-${field.id}-value`}>
                  Finding {index + 1} answer
                </label>
                <input
                  id={`finding-${field.id}-value`}
                  {...form.register(`findings.${index}.value`)}
                  maxLength={1000}
                  aria-invalid={!!form.formState.errors.findings?.[index]?.value}
                  aria-describedby={`finding-${field.id}-error`}
                />
              </div>
            )}
            <p id={`finding-${field.id}-error`} className="field-error" role="alert">
              {form.formState.errors.findings?.[index]?.name?.message ??
                form.formState.errors.findings?.[index]?.value?.message}
            </p>
            <button
              type="button"
              className="button secondary"
              onClick={() => fields.remove(index)}
            >
              Remove finding {index + 1}
            </button>
          </div>
        ))}
        <button
          type="button"
          className="button secondary"
          onClick={() => fields.append({ name: "", type: "TEXT", value: "" })}
        >
          Add a finding
        </button>
        <div className="detail-section">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={linkInspection}
              onChange={(event) => {
                setLinkInspection(event.target.checked);
                form.setValue("inspectionId", "");
              }}
            />
            Link this report to a completed inspection
          </label>
          {linkInspection && (
            <CompletedInspectionPicker
              vehicle={vehicle}
              value={inspectionId}
              onChange={(value) => form.setValue("inspectionId", value)}
            />
          )}
        </div>
        <p className="field-hint">
          PDF attachments are unavailable until private report downloads are supported.
        </p>
        <button className="button">Review condition report</button>
      </fieldset>
    </form>
  );
}
