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

      const result = await apiRequest<{
        user: SessionUser;
        mfaRequired: boolean;
      }>("/auth/login", {
        method: "POST",
        body: {
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
        },
      });

      if (!result.data?.user?.id || typeof result.data.mfaRequired !== "boolean") {
        throw new Error("Invalid login response");
      }

      announceSessionChange();
      await refreshCsrf();

      if (result.data.mfaRequired) {
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
      router.replace(result.data.user.role === "CUSTOMER" ? next : "/admin");
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
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-2 px-4 py-8">
      {/* <span className="eyebrow text-center">Your account</span> */}

      <h1 className="whitespace-nowrap text-center text-xl font-semibold tracking-tight sm:text-3xl">
        Welcome back.
      </h1>

      <span className="muted text-sm text-center">
        New to Allied AutoTech?{" "}
        <Link className="text-link" href="/register">
          Create an account
        </Link>
      </span>

      <div className="w-full">
        <Feedback
          message={error}
          toast="Please review the message on this page."
        />
      </div>

      <form onSubmit={submit} className="w-full space-y-4 text-left">
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

        <div className="grid w-full min-w-0 gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <label className="label" htmlFor="password">
              Password
            </label>
            <Link
              className="text-link text-sm"
              href="/forgot-password"
            >
              Forgot password?
            </Link>
          </div>

          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            className="input w-full"
            required
            maxLength={128}
          />
        </div>

        <div className="w-full pt-2">
          <button
            className="button flex w-full items-center justify-center"
            disabled={busy}
            type="submit"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </form>
    </div>
  );
}