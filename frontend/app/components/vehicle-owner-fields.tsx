"use client";

import type { UseFormReturn } from "react-hook-form";
import type { VehicleRecordValues } from "@/lib/forms/vehicle-record";

export function VehicleOwnerFields({
  form,
}: {
  form: UseFormReturn<VehicleRecordValues>;
}) {
  return (
    <div className="field" style={{ gridColumn: "1 / -1" }}>
      <p id="vehicle-owner-provenance">
        Owner-reported information is public when a listing is published. Record faults
        separately from general condition. Leave unknown information blank; blank does not
        mean fault-free. Use the condition-report workflow for an actual inspection. Keep
        personal details and identifiers out of these notes.
      </p>
      {(
        [
          ["ownerReportedCondition", "Owner-reported condition (optional)", 2000],
          ["ownerReportedIssues", "Owner-reported known issues (optional)", 4000],
        ] as const
      ).map(([name, label, maxLength]) => (
        <div className="field" key={name}>
          <label htmlFor={`vehicle-record-${name}`}>{label}</label>
          <textarea
            id={`vehicle-record-${name}`}
            rows={4}
            maxLength={maxLength}
            {...form.register(name)}
            aria-invalid={!!form.formState.errors[name]}
            aria-describedby={`vehicle-owner-provenance vehicle-${name}-hint${form.formState.errors[name] ? ` vehicle-${name}-error` : ""}`}
          />
          <small id={`vehicle-${name}-hint`}>
            {name === "ownerReportedIssues"
              ? "State what is not working, the source and what still needs diagnosis. When corrected, describe the current status and supporting evidence; previous notes remain in the audit history."
              : "Attribute the statement to the owner. This does not certify the vehicle's condition."}
          </small>
          {form.formState.errors[name] && (
            <p role="alert" className="field-error" id={`vehicle-${name}-error`}>
              {form.formState.errors[name]?.message}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
