"use client";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import {
  inspectionTransitions,
  type StaffInspection,
} from "@/lib/api/staff-inspection-schemas";
import { lagosDateTime, toLagosInput } from "@/lib/forms/vehicle-condition";
import { formatBusinessDate } from "@/lib/format/date";
import { StaffPicker } from "./staff-picker";
import { useAccountSession } from "./dashboard-shell";
import type { MutationProposal } from "./mutation-review";
const schema = z
  .object({
    status: z.enum(["CONFIRMED", "COMPLETED", "RESCHEDULED", "CANCELLED", "NO_SHOW"]),
    start: z.string(),
    end: z.string(),
    assignedStaffId: z.string(),
    reason: z.string().trim().max(1000),
  })
  .superRefine((value, context) => {
    if (["CONFIRMED", "RESCHEDULED"].includes(value.status)) {
      if (!lagosDateTime.safeParse(value.start).success)
        context.addIssue({
          code: "custom",
          path: ["start"],
          message: "Choose the complete inspection start date and time.",
        });
      if (!lagosDateTime.safeParse(value.end).success || value.end <= value.start)
        context.addIssue({
          code: "custom",
          path: ["end"],
          message: "Choose an end date and time after the start.",
        });
    }
    if (value.status === "CANCELLED" && !value.reason)
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Explain why this inspection is cancelled.",
      });
  });
type Values = z.infer<typeof schema>;
function defaults(inspection: StaffInspection): Values {
  return {
    status: inspectionTransitions[inspection.status][0] ?? "CONFIRMED",
    start: toLagosInput(inspection.scheduledStartAt ?? inspection.preferredStartAt),
    end: toLagosInput(inspection.scheduledEndAt ?? inspection.preferredEndAt),
    assignedStaffId: inspection.assignedStaffId ?? "",
    reason: "",
  };
}
export function InspectionStatusForm({
  inspection,
  disabled,
  onReview,
}: {
  inspection: StaffInspection;
  disabled: boolean;
  onReview: (proposal: MutationProposal) => void;
}) {
  const session = useAccountSession();
  const admin = session?.user.role !== "STAFF";
  const [version, setVersion] = useState(inspection.version);
  const changed = version !== inspection.version;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: defaults(inspection),
  });
  const status = useWatch({ control: form.control, name: "status" });
  const schedule = status === "CONFIRMED" || status === "RESCHEDULED";
  const choices: readonly string[] = inspectionTransitions[inspection.status];
  const prefix = `inspection-${inspection.id}`;
  if (!choices.length)
    return (
      <p className="notice">
        This inspection is closed. Further status changes are unavailable.
      </p>
    );
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => {
        if (disabled || changed || !choices.includes(values.status)) return;
        if (
          admin &&
          schedule &&
          !z.string().uuid().safeParse(values.assignedStaffId).success
        ) {
          form.setError("assignedStaffId", {
            message: "Choose an active staff member at this branch.",
          });
          document.getElementById(`${prefix}-staff`)?.focus();
          return;
        }
        const body: RequestBody<
          "/staff/vehicle-inspections/{inspectionId}/status",
          "post"
        > = {
          status: values.status,
          expectedVersion: version,
          ...(schedule
            ? {
                scheduledStartAt: `${values.start}:00+01:00`,
                scheduledEndAt: `${values.end}:00+01:00`,
              }
            : {}),
          ...(admin && schedule ? { assignedStaffId: values.assignedStaffId } : {}),
          ...(values.status === "CANCELLED" ? { reason: values.reason } : {}),
        };
        onReview({
          title: "Update this inspection?",
          description: `This records inspection progress. It does not reserve the vehicle, record payment or create a condition report. ${admin ? "Your account must have a staff profile. The selected or existing assignee must remain active at the listing branch." : "This action assigns the inspection to your own staff profile."}`,
          facts: [
            { label: "Vehicle", value: inspection.vehicleListing.title },
            { label: "Customer", value: inspection.customerName },
            {
              label: "Assigned staff",
              value:
                admin && schedule
                  ? (document.querySelector<HTMLSelectElement>(`#${prefix}-staff`)
                      ?.selectedOptions[0]?.textContent ?? "Selected staff member")
                  : admin
                    ? inspection.assignedStaff
                      ? `${inspection.assignedStaff.firstName} ${inspection.assignedStaff.lastName}`
                      : "Not assigned"
                    : "Your staff profile",
            },
            { label: "Next status", value: values.status.replaceAll("_", " ") },
            ...(schedule
              ? [
                  { label: "Start", value: formatBusinessDate(body.scheduledStartAt) },
                  { label: "End", value: formatBusinessDate(body.scheduledEndAt) },
                ]
              : []),
            ...(values.status === "CANCELLED"
              ? [{ label: "Reason", value: values.reason }]
              : []),
          ],
          submit: () =>
            apiRequest(`/staff/vehicle-inspections/${inspection.id}/status`, {
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
            This inspection changed. Your input has been kept; reload the fields before
            submitting.
          </p>
          <button
            className="button secondary"
            type="button"
            disabled={disabled}
            onClick={() => {
              form.reset(defaults(inspection));
              setVersion(inspection.version);
            }}
          >
            Reload inspection fields
          </button>
        </div>
      )}
      <fieldset className="handover-fields" disabled={disabled || changed}>
        <div className="field">
          <label htmlFor={`${prefix}-status`}>Next inspection status</label>
          <select id={`${prefix}-status`} {...form.register("status")}>
            {choices.map((choice) => (
              <option key={choice} value={choice}>
                {choice.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        {schedule && (
          <>
            <div className="record-form-grid">
              {(
                [
                  { name: "start", label: "Inspection starts (Lagos time)" },
                  { name: "end", label: "Inspection ends (Lagos time)" },
                ] as const
              ).map(({ name, label }) => (
                <div className="field" key={name}>
                  <label htmlFor={`${prefix}-${name}`}>{label}</label>
                  <input
                    id={`${prefix}-${name}`}
                    type="datetime-local"
                    {...form.register(name)}
                    aria-invalid={!!form.formState.errors[name]}
                    aria-describedby={
                      form.formState.errors[name] ? `${prefix}-${name}-error` : undefined
                    }
                  />
                  {form.formState.errors[name] && (
                    <p
                      className="field-error"
                      role="alert"
                      id={`${prefix}-${name}-error`}
                    >
                      {form.formState.errors[name]?.message}
                    </p>
                  )}
                </div>
              ))}
            </div>
            {admin && (
              <div className="field">
                <label htmlFor={`${prefix}-staff`}>Inspection assignee</label>
                <StaffPicker
                  key={version}
                  branchId={inspection.vehicleListing.branchId}
                  id={`${prefix}-staff`}
                  initialId={form.getValues("assignedStaffId")}
                  onSelect={(value) => {
                    form.setValue("assignedStaffId", value);
                    form.clearErrors("assignedStaffId");
                  }}
                  error={form.formState.errors.assignedStaffId?.message}
                />
              </div>
            )}
          </>
        )}
        {status === "CANCELLED" && (
          <div className="field">
            <label htmlFor={`${prefix}-reason`}>Inspection cancellation reason</label>
            <textarea
              id={`${prefix}-reason`}
              {...form.register("reason")}
              maxLength={1000}
              aria-invalid={!!form.formState.errors.reason}
              aria-describedby={
                form.formState.errors.reason ? `${prefix}-reason-error` : undefined
              }
            />
            {form.formState.errors.reason && (
              <p className="field-error" role="alert" id={`${prefix}-reason-error`}>
                {form.formState.errors.reason.message}
              </p>
            )}
          </div>
        )}
        <p className="field-hint">
          Confirm scheduling and staff availability before recording changes.
        </p>
        <button className="button secondary">Review inspection change</button>
      </fieldset>
    </form>
  );
}
