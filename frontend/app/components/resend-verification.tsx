"use client";
import { useState } from "react";
import { apiRequest, ApiError } from "@/lib/api/client";
import { Feedback } from "./feedback";
export function ResendVerification() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  return (
    <details className="detail-section">
      <summary>Need a new verification email?</summary>
      <p>
        Enter the email used to register. If the account is eligible, a new verification
        link will be sent.
      </p>
      <Feedback message={error} />
      <Feedback message={message} tone="info" />
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          const email = String(new FormData(event.currentTarget).get("email") ?? "");
          setBusy(true);
          setError(undefined);
          setMessage(undefined);
          try {
            await apiRequest("/auth/email/resend", { method: "POST", body: { email } });
            setMessage(
              "If the account is eligible, a verification link will be sent. Check your email.",
            );
          } catch (value) {
            setError(
              value instanceof ApiError
                ? value.message
                : "The request could not be confirmed. Check your email before trying again.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="field">
          <label htmlFor="resend-email">Registration email</label>
          <input
            id="resend-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
          />
        </div>
        <button className="button secondary" disabled={busy}>
          {busy ? "Requesting email…" : "Request verification email"}
        </button>
      </form>
    </details>
  );
}
