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
import { notify } from "@/lib/notifications";

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
        notify("Password accepted. Complete your security verification.", {
          tone: "info",
        });
        router.replace("/mfa");
        return;
      }
      const next = safeInternalRedirect(
        new URLSearchParams(window.location.search).get("next"),
      );
      notify("Signed in successfully.", { tone: "success" });
      router.replace(result.data?.user.role === "CUSTOMER" ? next : "/admin");
    } catch (error_) {
      setError(
        error_ instanceof ApiError
          ? error_.message
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
      <span className="muted">
        New to Allied AutoTech?{" "}
        <Link className="text-link" href="/register">
          Create an account
        </Link>
      </span>
      <Feedback message={error} toast="Please review the message on this page." />
      <form onSubmit={submit}>
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
        <div className="grid gap-1.5 mt-4 mb-4 w-full min-w-0">
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="password">
              Password
            </label>
            <Link className="text-link" href="/forgot-password">
              Forgot your password?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            className="input"
            required
            maxLength={128}
          />
        </div>
        <div className="form-footer">
          <button className="button" disabled={busy} type="submit">
            {busy ? "Signing in…" : "Sign in securely"}
          </button>
        </div>
      </form>
    </>
  );
}
