"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  compatibilityFormSchema,
  type CompatibilityValues,
} from "@/lib/forms/product-extras";
import type { ProductCompatibility } from "@/lib/api/product-extras-schemas";
export function ProductCompatibilityForm({
  item,
  disabled,
  onReview,
  onCancel,
}: {
  item: ProductCompatibility | null;
  disabled: boolean;
  onReview: (value: CompatibilityValues) => void;
  onCancel: () => void;
}) {
  const form = useForm<CompatibilityValues>({
    resolver: zodResolver(compatibilityFormSchema),
    defaultValues: {
      make: item?.make ?? "",
      model: item?.model ?? "",
      yearFrom: item?.yearFrom?.toString() ?? "",
      yearTo: item?.yearTo?.toString() ?? "",
      notes: item?.notes ?? "",
    },
  });
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((value) => {
        if (!disabled) onReview(value);
      })}
    >
      <h3>{item ? "Edit compatibility" : "Add compatibility"}</h3>
      <p>
        Enter verified fitment details. A model-specific search only matches records with
        that model named.
      </p>
      <fieldset className="handover-fields" disabled={disabled}>
        <div className="form-row">
          {(
            [
              { name: "make", label: "Vehicle make", max: 100 },
              { name: "model", label: "Vehicle model (optional)", max: 100 },
              { name: "yearFrom", label: "First year (optional)", max: 4 },
              { name: "yearTo", label: "Final year (optional)", max: 4 },
              { name: "notes", label: "Fitment notes (optional)", max: 1000 },
            ] as const
          ).map((field) => (
            <div className="field" key={field.name}>
              <label htmlFor={`compat-${field.name}`}>{field.label}</label>
              <input
                id={`compat-${field.name}`}
                maxLength={field.max}
                inputMode={
                  field.name === "yearFrom" || field.name === "yearTo"
                    ? "numeric"
                    : undefined
                }
                {...form.register(field.name)}
                aria-invalid={!!form.formState.errors[field.name]}
                aria-describedby={
                  form.formState.errors[field.name]
                    ? `compat-${field.name}-error`
                    : undefined
                }
              />
              {form.formState.errors[field.name] && (
                <p role="alert" className="field-error" id={`compat-${field.name}-error`}>
                  {form.formState.errors[field.name]?.message}
                </p>
              )}
            </div>
          ))}
        </div>
        <button className="button secondary">Review compatibility</button>
      </fieldset>
      <button type="button" className="text-link" onClick={onCancel}>
        Cancel compatibility edit
      </button>
    </form>
  );
}
