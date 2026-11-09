"use client";

import type { UseFormReturn } from "react-hook-form";
import type { VehicleRecordValues } from "@/lib/forms/vehicle-record";
import { vehicleEnums } from "@/lib/api/staff-vehicle-schemas";
import { vehicleLabel } from "@/lib/vehicle-discovery";
import { VehicleEngineDetailsField } from "./vehicle-engine-details-field";
import styles from "./vehicle-features.module.css";

export function VehicleEngineFields({
  form,
}: {
  form: UseFormReturn<VehicleRecordValues>;
}) {
  return (
    <fieldset className={styles.editor}>
      <legend>Engine &amp; drive</legend>
      <div className="record-form-grid">
        {(
          [
            ["powertrain", "Engine / Power type"],
            ["fuelType", "Fuel type"],
            ["driveType", "Drive system"],
            ["transmission", "Transmission"],
          ] as const
        ).map(([name, label]) => {
          const error = form.formState.errors[name];
          return (
            <div className="field" key={name}>
              <label htmlFor={`vehicle-record-${name}`}>{label} (optional)</label>
              <select
                id={`vehicle-record-${name}`}
                {...form.register(name)}
                aria-invalid={!!error}
                aria-describedby={
                  [
                    name === "powertrain" ? "vehicle-power-help" : "",
                    error ? `vehicle-record-${name}-error` : "",
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined
                }
              >
                <option value="">Not set</option>
                {vehicleEnums[name].map((value) => (
                  <option key={value} value={value}>
                    {vehicleLabel(value)}
                  </option>
                ))}
              </select>
              {name === "powertrain" && (
                <small id="vehicle-power-help">
                  Choose what powers the vehicle. Leave blank if unknown.
                </small>
              )}
              {error && (
                <p
                  id={`vehicle-record-${name}-error`}
                  role="alert"
                  className="field-error"
                >
                  {error.message}
                </p>
              )}
            </div>
          );
        })}
        {(
          [
            ["engineCapacityCc", "Engine capacity (optional, cc)", 5],
            ["cylinders", "Cylinders (optional)", 2],
            ["engineCode", "Engine code (optional)", 40],
            ["engineSize", "Engine size (optional)", 40],
          ] as const
        ).map(([name, label, max]) => {
          const error = form.formState.errors[name];
          return (
            <div className="field" key={name}>
              <label htmlFor={`vehicle-record-${name}`}>{label}</label>
              <input
                id={`vehicle-record-${name}`}
                {...form.register(name)}
                maxLength={max}
                inputMode={
                  name === "cylinders" || name === "engineCapacityCc" ? "numeric" : "text"
                }
                aria-invalid={!!error}
                aria-describedby={error ? `vehicle-record-${name}-error` : undefined}
              />
              {error && (
                <p
                  id={`vehicle-record-${name}-error`}
                  role="alert"
                  className="field-error"
                >
                  {error.message}
                </p>
              )}
            </div>
          );
        })}
        <VehicleEngineDetailsField form={form} />
      </div>
      <p>
        Leave unknown or inapplicable specifications blank. Changing the power type keeps
        your other supplied details.
      </p>
    </fieldset>
  );
}
