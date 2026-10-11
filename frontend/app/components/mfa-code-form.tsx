"use client";
import { useEffect, useState } from "react";
import { Eye, EyeOff, ArrowRight, ChevronDown } from "lucide-react";
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
  const [show, setShow] = useState(false);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) setShow(false);
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);
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
      method="post"
      noValidate
      onSubmit={form.handleSubmit(async (values) => {
        if (disabled) return;
        const code = values.code;
        values.code = "";
        form.setValue("code", "");
        setShow(false);
        const result = await onSubmit(code, values.factorId);
        if (!result) form.setFocus("code");
      })}
    >
      {factors && (
        <div className="field">
          <label htmlFor="mfa-factor">Authenticator</label>
          <div className="mfa-select">
            <select id="mfa-factor" disabled={disabled} {...form.register("factorId")}>
              {factors.map((factor, index) => (
                <option key={factor.id} value={factor.id}>
                  {factor.name ?? "Authenticator app"}
                  {factors.length > 1 ? ` (${index + 1})` : ""}
                </option>
              ))}
            </select>
            <ChevronDown size={16} aria-hidden="true" />
          </div>
        </div>
      )}
      <div className="field">
        <label htmlFor="mfa-code">{recovery ? "Recovery code" : "6-digit code"}</label>
        <div className="login-password">
          <input
            id="mfa-code"
            {...form.register("code")}
            type={show ? "text" : "password"}
            inputMode={recovery ? "text" : "numeric"}
            autoComplete={recovery ? "off" : "one-time-code"}
            autoCapitalize="none"
            spellCheck={false}
            maxLength={recovery ? 128 : 6}
            disabled={disabled}
            aria-invalid={!!form.formState.errors.code}
            aria-describedby={
              form.formState.errors.code
                ? "mfa-code-hint mfa-code-error"
                : "mfa-code-hint"
            }
          />
          <button
            type="button"
            className="login-reveal"
            disabled={disabled}
            aria-label={show ? "Hide code" : "Show code"}
            title={show ? "Hide code" : "Show code"}
            aria-pressed={show}
            aria-controls="mfa-code"
            onClick={() => setShow((v) => !v)}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <p className="mfa-hint" id="mfa-code-hint">
          {recovery
            ? "Each recovery code can be used once."
            : "Codes change regularly. Use the current one."}
        </p>
        {form.formState.errors.code && (
          <p id="mfa-code-error" role="alert" className="field-error">
            {form.formState.errors.code.message}
          </p>
        )}
      </div>
      <button
        className="button login-submit"
        disabled={disabled || form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? "Verifying..." : "Verify code"}
        <ArrowRight size={18} aria-hidden="true" />
      </button>
    </form>
  );
}
