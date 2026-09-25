"use client";

import Link from "next/link";
import { useState } from "react";
import { apiRequest, ApiError } from "@/lib/api/client";
import { Feedback } from "./feedback";

export function RegisterForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
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
    <div className="mx-auto flex w-full max-w-xl flex-col items-center px-4 py-8">
      {/* <span className="eyebrow text-center">Create your account</span> */}

      <h1 className="whitespace-nowrap text-center text-xl font-semibold tracking-tight sm:text-3xl">
        Better care starts here.
      </h1>

      <span className="muted text-sm text-center">
        Already registered?{" "}
        <Link className="text-link" href="/login">
          Sign in
        </Link>
      </span>

      <div className="w-full">
        <Feedback
          message={message}
          tone="success"
          toast="Check your email for the next step."
        />
        <Feedback message={error} toast="Please review the message on this page." />
      </div>

      <form onSubmit={submit} className="w-full space-y-4 text-left">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="field min-w-0">
            <label className="label" htmlFor="firstName">
              First name
            </label>
            <input
              id="firstName"
              name="firstName"
              autoComplete="given-name"
              className="input w-full"
              required
              maxLength={80}
            />
          </div>

          <div className="field min-w-0">
            <label className="label" htmlFor="lastName">
              Last name
            </label>
            <input
              id="lastName"
              name="lastName"
              autoComplete="family-name"
              className="input w-full"
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
            className="input w-full"
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
            className="input w-full"
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
            className="input w-full"
            required
            minLength={12}
            maxLength={128}
          />
          <span className="field-hint">
            Use a unique passphrase of 12–128 characters. Avoid common or reused
            passwords.
          </span>
        </div>

        <div className="w-full pt-2">
          <button className="button w-full justify-center" disabled={busy} type="submit">
            {busy ? "Creating account…" : "Create account"}
          </button>
        </div>
      </form>
    </div>
  );
}
