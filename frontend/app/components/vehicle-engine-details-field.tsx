"use client";

import type { UseFormReturn } from "react-hook-form";
import type { VehicleRecordValues } from "@/lib/forms/vehicle-record";

export function VehicleEngineDetailsField({
  form,
}: {
  form: UseFormReturn<VehicleRecordValues>;
}) {
  const error = form.formState.errors.engineDetails;
  return (
    <div className="field">
      <label htmlFor="vehicle-record-engineDetails">Engine details (optional)</label>
      <textarea
        id="vehicle-record-engineDetails"
        {...form.register("engineDetails")}
        rows={3}
        maxLength={500}
        aria-invalid={!!error}
        aria-describedby={`vehicle-engine-details-help${error ? " vehicle-engine-details-error" : ""}`}
      />
      <small id="vehicle-engine-details-help">
        Use the supplied engine description, up to 500 characters. Keep precise capacity
        and known issues in their own fields.
      </small>
      {error && (
        <p id="vehicle-engine-details-error" className="field-error" role="alert">
          {error.message}
        </p>
      )}
    </div>
  );
}
