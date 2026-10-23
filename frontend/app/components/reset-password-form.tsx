"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowRight,
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import {
  apiRequest,
  ApiError,
  announceSessionChange,
  SESSION_CHANGED,
  invalidateSession,
  isExternalSessionChange,
} from "@/lib/api/client";
import { recoveryTokenFromFragment, resetFields } from "@/lib/auth/password-reset";
import { Feedback } from "./feedback";

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
type Mode = "form" | "complete" | "invalid" | "uncertain";

function readLink(input: HTMLInputElement) {
  const token = recoveryTokenFromFragment(window.location.hash);
  history.replaceState(history.state, "", window.location.pathname);
  input.value = token;
  const details = input.closest("details");
  if (details) details.open = !token;
}

export function ResetPasswordForm() {
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  const [mode, setMode] = useState<Mode>("form");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState<string>();
  const [passwordError, setPasswordError] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  const password = useRef<HTMLInputElement>(null);
  const token = useRef<HTMLInputElement | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const pending = useRef<AbortController | null>(null);
  const initialized = useRef(false);
  const rotating = useRef(false);
  const retryAt = useRef(0);
  const tokenRef = useCallback((node: HTMLInputElement | null) => {
    token.current = node;
    if (node && !initialized.current) {
      initialized.current = true;
      readLink(node);
    }
  }, []);

  function clearValues() {
    form.current?.reset();
    if (token.current) token.current.value = "";
    if (password.current) password.current.value = "";
    setShowPassword(false);
    setShowToken(false);
  }

  useEffect(() => {
    function discard() {
      if (rotating.current) return;
      pending.current?.abort();
      pending.current = null;
      form.current?.reset();
      if (token.current) {
        token.current.value = "";
        token.current.closest("details")!.open = true;
      }
      if (password.current) password.current.value = "";
      setShowPassword(false);
      setShowToken(false);
      setBusy(false);
      setMode("form");
      setPasswordError(false);
      setError("Your session changed. Reopen your recovery email or request a new link.");
    }
    function restored(event: PageTransitionEvent) {
      if (event.persisted) discard();
    }
    function hide() {
      if (document.hidden) {
        setShowPassword(false);
        setShowToken(false);
      }
    }
    function changedLink() {
      if (!new URLSearchParams(window.location.hash.slice(1)).has("token")) return;
      discard();
      if (token.current) readLink(token.current);
      setError(undefined);
    }
    const channel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel("aat-session");
    if (channel)
      channel.onmessage = (e) => {
        if (isExternalSessionChange(e.data)) invalidateSession();
      };
    window.addEventListener(SESSION_CHANGED, discard);
    window.addEventListener("pageshow", restored);
    window.addEventListener("hashchange", changedLink);
    document.addEventListener("visibilitychange", hide);
    return () => {
      pending.current?.abort();
      channel?.close();
      window.removeEventListener(SESSION_CHANGED, discard);
      window.removeEventListener("pageshow", restored);
      window.removeEventListener("hashchange", changedLink);
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);
  useEffect(() => {
    if (mode !== "form") heading.current?.focus();
  }, [mode]);
  const waiting = waitSeconds > 0;
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(
      () => setWaitSeconds(Math.max(0, Math.ceil((retryAt.current - Date.now()) / 1000))),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [waiting]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || mode !== "form" || Date.now() < retryAt.current) return;
    const parsed = resetFields.safeParse({
      token: token.current?.value ?? "",
      password: password.current?.value ?? "",
    });
    setError(undefined);
    setPasswordError(false);
    if (!parsed.success) {
      setError("Enter a recovery token and a new password of 12–128 characters.");
      if (token.current) token.current.closest("details")!.open = true;
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setShowPassword(false);
    setShowToken(false);
    if (password.current) password.current.value = "";
    try {
      await apiRequest<never>("/auth/password/reset", {
        method: "POST",
        body: parsed.data,
        signal: controller.signal,
      });
      controller.signal.throwIfAborted();
      clearValues();
      rotating.current = true;
      try {
        announceSessionChange("password-changed");
      } finally {
        rotating.current = false;
      }
      setMode("complete");
    } catch (value) {
      if (controller.signal.aborted) return;
      if (value instanceof ApiError && value.status === 429) {
        const seconds = value.retryAfterSeconds ?? 0;
        retryAt.current = Date.now() + seconds * 1000;
        setWaitSeconds(seconds);
        setError("Too many attempts. Please wait before trying again.");
      } else if (
        value instanceof ApiError &&
        value.status === 422 &&
        value.fields?.["body.password"]
      ) {
        setPasswordError(true);
        setError("Choose a different, unique password of 12–128 characters.");
      } else if (
        value instanceof ApiError &&
        ((value.status === 400 && value.code === "TOKEN_INVALID") ||
          (value.status === 422 && value.fields?.["body.token"]))
      ) {
        clearValues();
        setMode("invalid");
      } else if (value instanceof ApiError && value.status === 403) {
        setError(
          "The request could not be verified. Reopen your recovery email or request a new link.",
        );
      } else {
        clearValues();
        setMode("uncertain");
      }
    } finally {
      parsed.data.token = "";
      parsed.data.password = "";
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  function restart() {
    clearValues();
    setMode("form");
    setError(undefined);
    setPasswordError(false);
    requestAnimationFrame(() => {
      if (token.current) {
        token.current.closest("details")!.open = true;
        token.current.focus();
      }
    });
  }
  const title =
    mode === "complete"
      ? "Password reset"
      : mode === "invalid"
        ? "Request a new link"
        : "Check before trying again";
  const StateIcon =
    mode === "complete" ? ShieldCheck : mode === "invalid" ? KeyRound : TriangleAlert;
  return (
    <div className="login-form reset-form">
      {mode === "form" && (
        <>
          <h1>
            Choose a new password<span>.</span>
          </h1>
          <p className="login-intro">
            Use a unique password for your Allied AutoTech account.
          </p>
        </>
      )}
      <Feedback message={error} />
      <noscript hidden={ready}>
        <p>
          Enable JavaScript to reset your password. You can still request a new link or
          browse our Help Centre.
        </p>
      </noscript>
      <form
        ref={form}
        hidden={!ready || mode !== "form"}
        method="post"
        onSubmit={submit}
        aria-busy={busy}
        onInvalid={(e) => {
          if (e.target === token.current && token.current)
            token.current.closest("details")!.open = true;
        }}
      >
        <details className="reset-token" open>
          <summary>
            Recovery token
            <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <div className="login-field">
            <label htmlFor="reset-token-input">Recovery token</label>
            <div className="login-password">
              <input
                ref={tokenRef}
                id="reset-token-input"
                name="token"
                type={showToken ? "text" : "password"}
                autoComplete="off"
                required
                minLength={32}
                maxLength={512}
                disabled={busy}
                aria-describedby="reset-token-hint"
                spellCheck={false}
              />
              <button
                type="button"
                className="login-reveal"
                aria-label={showToken ? "Hide recovery token" : "Show recovery token"}
                title={showToken ? "Hide recovery token" : "Show recovery token"}
                aria-pressed={showToken}
                aria-controls="reset-token-input"
                disabled={busy}
                onClick={() => setShowToken((v) => !v)}
              >
                {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="reset-hint" id="reset-token-hint">
              Open your recovery email, or paste its token here.
            </p>
          </div>
        </details>
        <div className="login-field">
          <label htmlFor="reset-new-password">New password</label>
          <div className="login-password">
            <input
              ref={password}
              id="reset-new-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              disabled={busy}
              aria-invalid={passwordError || undefined}
              aria-describedby={
                passwordError
                  ? "reset-password-hint reset-password-error"
                  : "reset-password-hint"
              }
            />
            <button
              type="button"
              className="login-reveal"
              aria-label={showPassword ? "Hide new password" : "Show new password"}
              title={showPassword ? "Hide new password" : "Show new password"}
              aria-pressed={showPassword}
              aria-controls="reset-new-password"
              disabled={busy}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <p className="reset-hint" id="reset-password-hint">
            Use 12–128 characters. Avoid common or reused passwords.
          </p>
          {passwordError && (
            <p id="reset-password-error" className="reset-field-error">
              Choose a different, unique password.
            </p>
          )}
        </div>
        <button type="submit" className="button login-submit" disabled={busy || waiting}>
          {busy ? (
            <>
              <LoaderCircle className="login-spinner" size={18} aria-hidden="true" />
              Resetting password…
            </>
          ) : (
            <>
              Reset password
              <ArrowRight size={18} aria-hidden="true" />
            </>
          )}
        </button>
        {waiting && (
          <p className="reset-hint">
            Try again in about {Math.ceil(waitSeconds / 60)}{" "}
            {waitSeconds > 60 ? "minutes" : "minute"}.
          </p>
        )}
        <p className="reset-hint">
          Resetting your password signs you out on all devices.
        </p>
      </form>
      {mode !== "form" && (
        <section className="reset-result" aria-labelledby="reset-result-heading">
          <StateIcon size={36} aria-hidden="true" />
          <h1 ref={heading} id="reset-result-heading" tabIndex={-1}>
            {title}
          </h1>
          <p role="status">
            {mode === "complete"
              ? "Your password has been reset. Sign in with your new password."
              : mode === "invalid"
                ? "This recovery link is invalid or has expired. Request a new link to continue."
                : "We could not confirm the reset. Try signing in with your new password. If that does not work, request a new recovery link."}
          </p>
          {mode === "complete" && (
            <p className="reset-hint">Your previous sessions have been signed out.</p>
          )}
          <Link
            className="button login-submit"
            href={mode === "invalid" ? "/forgot-password" : "/login"}
          >
            {mode === "invalid" ? "Request a new link" : "Return to sign in"}
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
          {mode === "invalid" && (
            <>
              <Link href="/login">Return to sign in</Link>
              <button className="reset-secondary" type="button" onClick={restart}>
                Use another recovery token
              </button>
            </>
          )}
          {mode === "uncertain" && (
            <Link className="reset-secondary" href="/forgot-password">
              Request a new link
            </Link>
          )}
        </section>
      )}
      {mode === "form" && (
        <div className="reset-links">
          <Link href="/login">Return to sign in</Link>
          <Link href="/forgot-password">Request a new link</Link>
        </div>
      )}
      <div className="login-help">
        <Link href="/help/account-security">Need help with your account?</Link>
      </div>
    </div>
  );
}
