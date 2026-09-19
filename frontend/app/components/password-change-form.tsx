"use client";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  apiRequest,
  ApiError,
  announceSessionChange,
  setCsrfToken,
} from "@/lib/api/client";
import { csrfResultSchema } from "@/lib/api/security-schemas";
import { passwordChangeSchema, type PasswordChangeValues } from "@/lib/forms/security";
import { MutationReview, type MutationProposal } from "./mutation-review";
const defaults = { currentPassword: "", newPassword: "", confirmation: "" };
export function PasswordChangeForm() {
  const form = useForm<PasswordChangeValues>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: defaults,
  });
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const serverFocus = useRef<keyof PasswordChangeValues | null>(null);
  const { setFocus, setValue } = form;
  const clearPasswords = () => {
    setValue("currentPassword", "");
    setValue("newPassword", "");
    setValue("confirmation", "");
  };
  useEffect(() => {
    if (proposal || !serverFocus.current) return;
    const field = serverFocus.current;
    const frame = requestAnimationFrame(() => {
      setFocus(field);
      serverFocus.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [proposal, setFocus]);
  useEffect(() => () => pending.current?.abort(), []);
  return (
    <section className="detail-section">
      <h2>Change password</h2>
      <p>
        Use 12 to 128 characters. Changing your password signs out your other sessions and
        invalidates unused password-reset links.
      </p>
      {uncertain && (
        <p className="notice" role="status">
          The password change could not be confirmed. Do not resend it. Check sign-in with
          the new password, or use password recovery if needed.
        </p>
      )}
      <form
        noValidate
        onSubmit={(event) =>
          void form.handleSubmit((values) => {
            if (proposal || uncertain) return;
            setProposal({
              title: "Change your password?",
              description:
                "Your other sessions will be signed out. This browser's session will be renewed and checked again. Passwords are not included in this review.",
              facts: [
                { label: "Other sessions", value: "Sign out" },
                { label: "Unused password-reset links", value: "Invalidate" },
              ],
              onUncertain: () => setUncertain(true),
              retryAfterRejection: false,
              submit: async () => {
                const controller = new AbortController();
                pending.current = controller;
                try {
                  const result = csrfResultSchema.parse(
                    (
                      await apiRequest<unknown>("/auth/password/change", {
                        method: "POST",
                        csrf: true,
                        signal: controller.signal,
                        body: {
                          currentPassword: values.currentPassword,
                          newPassword: values.newPassword,
                        },
                      })
                    ).data,
                  );
                  if (!controller.signal.aborted) {
                    announceSessionChange("password-changed");
                    setCsrfToken(result.csrfToken);
                  }
                } catch (error) {
                  if (
                    error instanceof ApiError &&
                    error.code === "AUTHENTICATION_FAILED"
                  ) {
                    form.setError("currentPassword", {
                      message: "Enter your current password again.",
                    });
                    serverFocus.current = "currentPassword";
                    throw new ApiError(401, {
                      error: { code: "SECURITY_PASSWORD_REJECTED" },
                    });
                  }
                  if (error instanceof ApiError && error.fields?.["body.newPassword"]) {
                    form.setError("newPassword", {
                      message:
                        "Choose a different passphrase that meets the password requirements.",
                    });
                    serverFocus.current = "newPassword";
                  }
                  throw error;
                } finally {
                  clearPasswords();
                  values.currentPassword = "";
                  values.newPassword = "";
                  values.confirmation = "";
                  pending.current = null;
                }
              },
            });
          })(event)
        }
      >
        <fieldset className="handover-fields" disabled={uncertain}>
          {(
            [
              {
                name: "currentPassword",
                label: "Current password",
                autocomplete: "current-password",
              },
              {
                name: "newPassword",
                label: "New password",
                autocomplete: "new-password",
              },
              {
                name: "confirmation",
                label: "Confirm new password",
                autocomplete: "new-password",
              },
            ] as const
          ).map((field) => (
            <div className="field" key={field.name}>
              <label htmlFor={`security-${field.name}`}>{field.label}</label>
              <input
                id={`security-${field.name}`}
                type="password"
                autoComplete={field.autocomplete}
                maxLength={128}
                {...form.register(field.name)}
                aria-invalid={!!form.formState.errors[field.name]}
                aria-describedby={
                  form.formState.errors[field.name]
                    ? `security-${field.name}-error`
                    : undefined
                }
              />
              {form.formState.errors[field.name] && (
                <p
                  className="field-error"
                  role="alert"
                  id={`security-${field.name}-error`}
                >
                  {form.formState.errors[field.name]?.message}
                </p>
              )}
            </div>
          ))}
          <button className="button">Review password change</button>
        </fieldset>
      </form>
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => {
            setProposal(null);
            clearPasswords();
          }}
          onSuccess={() => undefined}
        />
      )}
    </section>
  );
}
