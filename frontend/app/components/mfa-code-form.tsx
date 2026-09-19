"use client";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
export function MfaCodeForm({
  recovery = false,
  factors,
  disabled,
  onSubmit,
}: {
  recovery?: boolean;
  factors?: { id: string; name: string | null }[];
  disabled: boolean;
  onSubmit: (code: string, factorId?: string) => Promise<boolean>;
}) {
  const schema = z.object({
    code: recovery
      ? z.string().min(8, "Enter your recovery code.").max(128)
      : z.string().regex(/^\d{6}$/, "Enter the six-digit code from your authenticator."),
    factorId: z.string(),
  });
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { code: "", factorId: factors?.[0]?.id ?? "" },
  });
  const { setFocus } = form;
  const chooseFactor = !!factors && factors.length > 1;
  useEffect(() => {
    setFocus(chooseFactor ? "factorId" : "code");
  }, [setFocus, chooseFactor]);
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(async (values) => {
        if (disabled) return;
        const result = await onSubmit(values.code, values.factorId);
        values.code = "";
        form.setValue("code", "");
        if (!result) form.setFocus("code");
      })}
    >
      {factors && (
        <div className="field">
          <label htmlFor="mfa-factor">Authenticator</label>
          <select id="mfa-factor" disabled={disabled} {...form.register("factorId")}>
            {factors.map((factor, index) => (
              <option key={factor.id} value={factor.id}>
                {factor.name ?? "Authenticator app"}
                {factors.length > 1 ? ` (${index + 1})` : ""}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="field">
        <label htmlFor="mfa-code">{recovery ? "Recovery code" : "6-digit code"}</label>
        <input
          id="mfa-code"
          {...form.register("code")}
          type="text"
          inputMode={recovery ? "text" : "numeric"}
          autoComplete="one-time-code"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={recovery ? 128 : 6}
          disabled={disabled}
          aria-invalid={!!form.formState.errors.code}
          aria-describedby={form.formState.errors.code ? "mfa-code-error" : undefined}
        />
        {form.formState.errors.code && (
          <p id="mfa-code-error" role="alert" className="field-error">
            {form.formState.errors.code.message}
          </p>
        )}
      </div>
      <button className="button" disabled={disabled || form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Verifying..." : "Verify code"}
      </button>
    </form>
  );
}
