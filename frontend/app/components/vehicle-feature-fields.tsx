"use client";

import { useFieldArray, type UseFormReturn } from "react-hook-form";
import type { VehicleRecordValues } from "@/lib/forms/vehicle-record";
import styles from "./vehicle-features.module.css";

export function VehicleFeatureFields({
  form,
}: {
  form: UseFormReturn<VehicleRecordValues>;
}) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "features",
  });
  const errors = form.formState.errors.features;
  return (
    <fieldset className={styles.editor} aria-describedby="vehicle-features-help">
      <legend>Additional features (optional)</legend>
      <p id="vehicle-features-help">
        Add one feature at a time. Only include features supplied for this vehicle.
      </p>
      <p>Up to 40 items, with 80 characters per item. Commas within an item are kept.</p>
      {fields.map((item, index) => {
        const error = errors?.[index]?.value?.message;
        return (
          <div className={styles.row} key={item.id} data-draft-row="features">
            <div className="field">
              <label htmlFor={`vehicle-feature-${index}`}>Feature {index + 1}</label>
              <input
                id={`vehicle-feature-${index}`}
                {...form.register(`features.${index}.value`)}
                maxLength={80}
                autoComplete="off"
                aria-invalid={!!error}
                aria-describedby={
                  error ? `vehicle-feature-${index}-error` : "vehicle-features-help"
                }
              />
              {error && (
                <p
                  className="field-error"
                  role="alert"
                  id={`vehicle-feature-${index}-error`}
                >
                  {error}
                </p>
              )}
            </div>
            <button
              type="button"
              className="button secondary"
              data-draft-remove="features"
              aria-label={`Remove feature ${index + 1}`}
              onClick={() => {
                remove(index);
                requestAnimationFrame(() => {
                  const target =
                    document.getElementById(
                      `vehicle-feature-${Math.min(index, fields.length - 2)}`,
                    ) ?? document.getElementById("vehicle-feature-add");
                  target?.focus();
                });
              }}
            >
              Remove
            </button>
          </div>
        );
      })}
      {errors?.root?.message && (
        <p className="field-error" role="alert">
          {errors.root.message}
        </p>
      )}
      <p role="status">{fields.length} of 40 features</p>
      <button
        id="vehicle-feature-add"
        data-draft-add="features"
        type="button"
        className="button secondary"
        disabled={fields.length >= 40}
        onClick={() => append({ value: "" })}
      >
        Add feature
      </button>
    </fieldset>
  );
}
