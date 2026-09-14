"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  apiRequest,
  ApiError,
  announceSessionChange,
  refreshCsrf,
} from "@/lib/api/client";
import type { SessionUser } from "@/lib/api/types";
import { safeInternalRedirect } from "@/lib/auth/safe-redirect";
import { Feedback } from "./feedback";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      announceSessionChange();
      const result = await apiRequest<{ user: SessionUser; mfaRequired: boolean }>(
        "/auth/login",
        {
          method: "POST",
          body: {
            email: String(form.get("email") ?? ""),
            password: String(form.get("password") ?? ""),
          },
        },
      );
      if (!result.data?.user?.id || typeof result.data.mfaRequired !== "boolean")
        throw new Error("Invalid login response");
      announceSessionChange();
      await refreshCsrf();
      if (result.data?.mfaRequired) {
        router.replace("/mfa");
        return;
      }
      const next = safeInternalRedirect(
        new URLSearchParams(window.location.search).get("next"),
      );
      window.location.replace(result.data?.user.role === "CUSTOMER" ? next : "/admin");
    } catch (value) {
      setError(
        value instanceof ApiError
          ? value.message
          : "Sign in could not be confirmed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <span className="eyebrow">Customer account</span>
      <h1>Welcome back.</h1>
      <p className="muted">
        Use the email and password associated with your verified account.
      </p>
      <Feedback message={error} />
      <form onSubmit={submit}>
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
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
          />
        </div>
        <div className="form-footer">
          <button className="button" disabled={busy}>
            {busy ? "Signing in…" : "Sign in securely"}
          </button>
          <Link className="text-link" href="/forgot-password">
            Forgot your password?
          </Link>
          <span className="muted">
            New to Allied AutoTech?{" "}
            <Link className="text-link" href="/register">
              Create an account
            </Link>
          </span>
        </div>
      </form>
    </>
  );
}
