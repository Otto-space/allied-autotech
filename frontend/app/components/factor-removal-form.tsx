"use client";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { factorRemovalSchema } from "@/lib/forms/security";
export function FactorRemovalForm({
  disabled,
  onReview,
  onCancel,
  compact = false,
}: {
  disabled: boolean;
  onReview: (password: string, clear: () => void) => void;
  onCancel: () => void;
  compact?: boolean;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) setShown(false);
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);
  const form = useForm({
    resolver: zodResolver(factorRemovalSchema),
    defaultValues: { password: "" },
  });
  return (
    <form
      method="post"
      noValidate
      onSubmit={form.handleSubmit((value) => {
        setShown(false);
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
          <div className="security-password-input">
            <input
              id="remove-factor-password"
              type={shown ? "text" : "password"}
              autoComplete="current-password"
              maxLength={128}
              {...form.register("password")}
              aria-invalid={!!form.formState.errors.password}
              aria-describedby={
                form.formState.errors.password ? "factor-password-error" : undefined
              }
            />
            {compact && (
              <button
                type="button"
                className="security-reveal"
                aria-label={
                  shown ? "Hide factor-removal password" : "Show factor-removal password"
                }
                title={
                  shown ? "Hide factor-removal password" : "Show factor-removal password"
                }
                aria-pressed={shown}
                aria-controls="remove-factor-password"
                onClick={() => setShown((v) => !v)}
              >
                {shown ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            )}
          </div>
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
