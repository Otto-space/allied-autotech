"use client";
import Link from "next/link";
import { useState } from "react";
import { apiRequest, ApiError } from "@/lib/api/client";
import { Feedback } from "./feedback";
export function RegisterForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const form = event.currentTarget;
    const f = new FormData(form);
    try {
      await apiRequest<never>("/auth/register", {
        method: "POST",
        body: {
          firstName: String(f.get("firstName") ?? ""),
          lastName: String(f.get("lastName") ?? ""),
          phone: String(f.get("phone") ?? ""),
          email: String(f.get("email") ?? ""),
          password: String(f.get("password") ?? ""),
        },
      });
      setMessage("Check your email for verification instructions before signing in.");
      form.reset();
    } catch (error_) {
      setError(
        error_ instanceof ApiError
          ? error_.message
          : "Registration could not be confirmed. Check your email before submitting again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <span className="eyebrow">Create your account</span>
      <h1>Vehicle care, organised.</h1>
      <span className="muted">
        Already registered?{" "}
        <Link className="text-link" href="/login">
          Sign in
        </Link>
      </span>
      <Feedback
        message={message}
        tone="success"
        toast="Check your email for the next step."
      />
      <Feedback message={error} toast="Please review the message on this page." />
      <form onSubmit={submit}>
        <div className="form-row">
          <div className="field">
            <label className="label" htmlFor="firstName">
              First name
            </label>
            <input
              id="firstName"
              name="firstName"
              autoComplete="given-name"
              className="input"
              required
              maxLength={80}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="lastName">
              Last name
            </label>
            <input
              id="lastName"
              name="lastName"
              autoComplete="family-name"
              className="input"
              required
              maxLength={80}
            />
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="phone">
            Phone number
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            className="input"
            required
            maxLength={32}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="email">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            className="input"
            required
            maxLength={254}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            className="input"
            required
            minLength={12}
            maxLength={128}
          />
          <span className="field-hint">
            Use a unique passphrase of 12–128 characters. Avoid common or reused
            passwords.
          </span>
        </div>
        <div className="form-footer">
          <button className="button" disabled={busy} type="submit">
            {busy ? "Creating account…" : "Create customer account"}
          </button>
        </div>
      </form>
    </>
  );
}
