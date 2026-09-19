"use client";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SubmitEvent } from "react";
import { apiRequest, announceSessionChange } from "@/lib/api/client";
import { Feedback } from "./feedback";

function getFieldValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

type EmailActionMode = "verify" | "forgot" | "reset";

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

function getActionPath(mode: EmailActionMode): string {
  switch (mode) {
    case "verify":
      return "/auth/email/verify";
    case "forgot":
      return "/auth/password/forgot";
    default:
      return "/auth/password/reset";
  }
}

function getActionBody(
  mode: EmailActionMode,
  formData: FormData,
): Record<string, string> {
  if (mode === "forgot") {
    return { email: getFieldValue(formData, "email") };
  }

  if (mode === "reset") {
    return {
      token: getFieldValue(formData, "token"),
      password: getFieldValue(formData, "password"),
    };
  }

  return { token: getFieldValue(formData, "token") };
}

export function EmailActionForm({
  mode,
}: {
  readonly mode: "verify" | "forgot" | "reset";
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tokenInput = useRef<HTMLInputElement>(null);

  useIsomorphicLayoutEffect(() => {
    if (mode === "forgot") return;
    const fragment = window.location.hash.slice(1);
    history.replaceState(null, "", window.location.pathname);
    const token = new URLSearchParams(fragment).get("token");
    if (token && token.length >= 32 && token.length <= 512 && tokenInput.current)
      tokenInput.current.value = token;
  }, [mode]);

  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const path = getActionPath(mode);
      const body = getActionBody(mode, formData);
      await apiRequest<never>(path, { method: "POST", body });
      if (mode === "reset") announceSessionChange();
      setMessage(
        mode === "forgot"
          ? "If your account is eligible, a recovery link will be sent. Check your email for the next step."
          : mode === "verify"
            ? "Your email has been verified. You can now sign in."
            : "Your password has been reset. Sign in with your new password.",
      );

      if (mode !== "forgot") {
        form.reset();
      }
    } catch (error_) {
      setError(
        error_ instanceof Error ? error_.message : "The request could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }

  let title = "Choose a new password.";

  if (mode === "verify") {
    title = "Verify your email.";
  } else if (mode === "forgot") {
    title = "Reset access safely.";
  }
  const tokenLabel = mode === "verify" ? "Verification" : "Reset";
  let buttonLabel = "Reset password";
  if (busy) {
    buttonLabel = "Submitting…";
  } else if (mode === "verify") {
    buttonLabel = "Verify email";
  } else if (mode === "forgot") {
    buttonLabel = "Send recovery link";
  }

  return (
    <>
      <span className="eyebrow">Account security</span>
      <h1>{title}</h1>
      <p className="muted">
        {mode === "forgot"
          ? "If the account is eligible, we will send a time-limited recovery link."
          : "Open the link in your email to complete this step. If the link has expired, request a new one."}
      </p>
      <Feedback message={message} tone="success" />
      <Feedback message={error} />
      <form onSubmit={submit}>
        {mode === "forgot" ? (
          <div className="field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
            />
          </div>
        ) : (
          <div className="field">
            <label htmlFor="token">{tokenLabel} token</label>
            <input
              id="token"
              name="token"
              type="password"
              autoComplete="off"
              ref={tokenInput}
              required
              minLength={32}
              maxLength={512}
            />
          </div>
        )}
        {mode === "reset" && (
          <div className="field">
            <label htmlFor="password">New password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
            />
          </div>
        )}
        <div className="form-footer">
          <button type="submit" className="button" disabled={busy}>
            {buttonLabel}
          </button>
          <Link className="text-link" href="/login">
            Return to sign in
          </Link>
        </div>
      </form>
    </>
  );
}
