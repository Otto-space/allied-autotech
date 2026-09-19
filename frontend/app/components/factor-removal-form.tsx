"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { factorRemovalSchema } from "@/lib/forms/security";
export function FactorRemovalForm({
  disabled,
  onReview,
  onCancel,
}: {
  disabled: boolean;
  onReview: (password: string, clear: () => void) => void;
  onCancel: () => void;
}) {
  const form = useForm({
    resolver: zodResolver(factorRemovalSchema),
    defaultValues: { password: "" },
  });
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((value) => {
        if (!disabled)
          onReview(value.password, () => {
            value.password = "";
            form.reset({ password: "" });
          });
      })}
    >
      <fieldset className="handover-fields" disabled={disabled}>
        <div className="field">
          <label htmlFor="remove-factor-password">
            Current password to remove this factor
          </label>
          <input
            id="remove-factor-password"
            type="password"
            autoComplete="current-password"
            maxLength={128}
            {...form.register("password")}
            aria-invalid={!!form.formState.errors.password}
            aria-describedby={
              form.formState.errors.password ? "factor-password-error" : undefined
            }
          />
          {form.formState.errors.password && (
            <p id="factor-password-error" className="field-error" role="alert">
              {form.formState.errors.password.message}
            </p>
          )}
        </div>
        <button className="button secondary">Review factor removal</button>
      </fieldset>
      <button
        type="button"
        className="text-link"
        onClick={() => {
          form.reset();
          onCancel();
        }}
      >
        Cancel factor removal
      </button>
    </form>
  );
}
