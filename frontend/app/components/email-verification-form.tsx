"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Mail,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import {
  apiRequest,
  ApiError,
  SESSION_CHANGED,
  invalidateSession,
  isExternalSessionChange,
} from "@/lib/api/client";
import { tokenFromFragment } from "@/lib/auth/fragment-token";
import { verificationFields, resendFields } from "@/lib/auth/email-verification";
import { Feedback } from "./feedback";

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
type Action = "verify" | "resend";
type Mode = Action | "verified" | "sent" | "invalid" | "uncertain";
function readLink(input: HTMLInputElement) {
  input.value = tokenFromFragment(window.location.hash);
  history.replaceState(history.state, "", window.location.pathname);
}
const results = {
  verified: {
    title: "Email verified",
    copy: "Your email has been verified. You can now sign in.",
    icon: ShieldCheck,
  },
  sent: {
    title: "Check your email",
    copy: "If the account is eligible, a verification link will be sent. Check your email.",
    icon: Mail,
  },
  invalid: {
    title: "Request a new email",
    copy: "This verification link is invalid or has expired. Request a new email to continue.",
    icon: KeyRound,
  },
  uncertain: {
    title: "Check your verification",
    copy: "We could not confirm verification. Try signing in. If you still need to verify your email, request a new link.",
    icon: TriangleAlert,
  },
};

export function EmailVerificationForm() {
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  const [mode, setMode] = useState<Mode>("verify");
  const [busy, setBusy] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState<string>();
  const [emailError, setEmailError] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const token = useRef<HTMLInputElement | null>(null);
  const email = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const initialized = useRef(false);
  const pending = useRef<AbortController | null>(null);
  const retryAt = useRef({ verify: 0, resend: 0 });
  const tokenRef = useCallback((node: HTMLInputElement | null) => {
    token.current = node;
    if (node && !initialized.current) {
      initialized.current = true;
      readLink(node);
    }
  }, []);
  function clearValues() {
    if (token.current) token.current.value = "";
    if (email.current) email.current.value = "";
    setShowToken(false);
  }
  useEffect(() => {
    function discard() {
      pending.current?.abort();
      pending.current = null;
      if (token.current) token.current.value = "";
      if (email.current) email.current.value = "";
      setShowToken(false);
      setBusy(false);
      setMode("verify");
      setEmailError(false);
      setWaitSeconds(
        Math.max(0, Math.ceil((retryAt.current.verify - Date.now()) / 1000)),
      );
      setError(
        "Your session changed. Reopen your verification email or request a new link.",
      );
    }
    function restored(e: PageTransitionEvent) {
      if (e.persisted) discard();
    }
    function hide() {
      if (document.hidden) setShowToken(false);
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
  const formMode = mode === "verify" || mode === "resend";
  useEffect(() => {
    if (!formMode) heading.current?.focus();
  }, [mode, formMode]);
  const waiting = waitSeconds > 0;
  useEffect(() => {
    if (!waiting || (mode !== "verify" && mode !== "resend")) return;
    const timer = window.setInterval(
      () =>
        setWaitSeconds(
          Math.max(0, Math.ceil((retryAt.current[mode] - Date.now()) / 1000)),
        ),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [waiting, mode]);
  function move(next: Action) {
    if (pending.current) return;
    clearValues();
    setError(undefined);
    setEmailError(false);
    setMode(next);
    setWaitSeconds(Math.max(0, Math.ceil((retryAt.current[next] - Date.now()) / 1000)));
    requestAnimationFrame(() =>
      (next === "verify" ? token.current : email.current)?.focus(),
    );
  }
  async function submit(e: React.FormEvent<HTMLFormElement>, action: Action) {
    e.preventDefault();
    if (pending.current || mode !== action || Date.now() < retryAt.current[action])
      return;
    const parsed =
      action === "verify"
        ? verificationFields.safeParse({ token: token.current?.value ?? "" })
        : resendFields.safeParse({ email: email.current?.value ?? "" });
    setError(undefined);
    setEmailError(false);
    if (!parsed.success) {
      setError(
        action === "verify"
          ? "Enter a verification token from your email."
          : "Enter a valid registration email address.",
      );
      setEmailError(action === "resend");
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setShowToken(false);
    try {
      await apiRequest<never>(`/auth/email/${action}`, {
        method: "POST",
        body: parsed.data,
        signal: controller.signal,
      });
      controller.signal.throwIfAborted();
      clearValues();
      setMode(action === "verify" ? "verified" : "sent");
    } catch (value) {
      if (controller.signal.aborted) return;
      if (value instanceof ApiError && value.status === 429) {
        const seconds = value.retryAfterSeconds ?? 0;
        retryAt.current[action] = Date.now() + seconds * 1000;
        setWaitSeconds(seconds);
        setError("Too many attempts. Please wait before trying again.");
      } else if (
        action === "verify" &&
        value instanceof ApiError &&
        ((value.status === 400 && value.code === "TOKEN_INVALID") ||
          (value.status === 422 && value.fields?.["body.token"]))
      ) {
        clearValues();
        setMode("invalid");
      } else if (
        action === "resend" &&
        value instanceof ApiError &&
        value.status === 422
      ) {
        setEmailError(true);
        setError("Check your registration email address and try again.");
      } else if (value instanceof ApiError && value.status === 403) {
        setError(
          "The request could not be verified. Refresh this page and try again, or visit our Help Centre.",
        );
      } else if (action === "verify") {
        clearValues();
        setMode("uncertain");
      } else {
        setError(
          "We could not confirm your request. Check your email before trying again.",
        );
      }
    } finally {
      if ("token" in parsed.data) parsed.data.token = "";
      if ("email" in parsed.data) parsed.data.email = "";
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  const result = !formMode ? results[mode] : null;
  const StateIcon = result?.icon;
  return (
    <div className="login-form verify-form">
      {formMode && (
        <>
          <h1>
            {mode === "verify" ? "Verify your email" : "Get a new verification email"}
            <span>.</span>
          </h1>
          <p className="login-intro">
            {mode === "verify"
              ? "Open the link in your email, or paste your verification token below."
              : "Enter the email used to register. If the account is eligible, a new verification link will be sent."}
          </p>
        </>
      )}
      <Feedback message={error} />
      <noscript>
        <p>
          Enable JavaScript to verify your email or request a new link. You can still sign
          in or browse our Help Centre.
        </p>
      </noscript>
      <form
        hidden={!ready || mode !== "verify"}
        method="post"
        onSubmit={(e) => submit(e, "verify")}
        aria-busy={busy}
      >
        <div className="login-field">
          <label htmlFor="verify-token">Verification token</label>
          <div className="login-password">
            <input
              ref={tokenRef}
              id="verify-token"
              name="token"
              type={showToken ? "text" : "password"}
              autoComplete="off"
              required
              minLength={32}
              maxLength={512}
              disabled={busy}
              aria-describedby="verify-token-hint"
              spellCheck={false}
            />
            <button
              type="button"
              className="login-reveal"
              aria-label={
                showToken ? "Hide verification token" : "Show verification token"
              }
              title={showToken ? "Hide verification token" : "Show verification token"}
              aria-pressed={showToken}
              aria-controls="verify-token"
              disabled={busy}
              onClick={() => setShowToken((v) => !v)}
            >
              {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <p id="verify-token-hint" className="verify-hint">
            Your email is verified only after you confirm this step.
          </p>
        </div>
        <button type="submit" className="button login-submit" disabled={busy || waiting}>
          {busy ? (
            <>
              <LoaderCircle className="login-spinner" size={18} aria-hidden="true" />
              Verifying email…
            </>
          ) : (
            <>
              Verify email
              <ArrowRight size={18} aria-hidden="true" />
            </>
          )}
        </button>
      </form>
      <form
        hidden={!ready || mode !== "resend"}
        method="post"
        onSubmit={(e) => submit(e, "resend")}
        aria-busy={busy}
      >
        <div className="login-field">
          <label htmlFor="verify-email-input">Registration email</label>
          <input
            ref={email}
            id="verify-email-input"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            disabled={busy}
            aria-invalid={emailError || undefined}
            aria-describedby={emailError ? "verify-email-error" : undefined}
          />
          {emailError && (
            <p id="verify-email-error" className="verify-field-error">
              Check your registration email address.
            </p>
          )}
        </div>
        <button type="submit" className="button login-submit" disabled={busy || waiting}>
          {busy ? (
            <>
              <LoaderCircle className="login-spinner" size={18} aria-hidden="true" />
              Requesting email…
            </>
          ) : (
            <>
              Request verification email
              <ArrowRight size={18} aria-hidden="true" />
            </>
          )}
        </button>
        <p className="verify-hint">Use the newest link if you receive another email.</p>
      </form>
      {formMode && (
        <>
          {waiting && (
            <p className="verify-hint">
              Try again in about {Math.ceil(waitSeconds / 60)}{" "}
              {waitSeconds > 60 ? "minutes" : "minute"}.
            </p>
          )}
          <div className="verify-links">
            {ready && (
              <button
                className="verify-switch"
                type="button"
                disabled={busy}
                onClick={() => move(mode === "verify" ? "resend" : "verify")}
              >
                {mode === "verify"
                  ? "Need a new verification email?"
                  : "Use a verification token"}
              </button>
            )}
            <Link href="/login">Return to sign in</Link>
          </div>
        </>
      )}
      {result && StateIcon && (
        <section className="verify-result" aria-labelledby="verify-result-heading">
          <StateIcon size={36} aria-hidden="true" />
          <h1 ref={heading} id="verify-result-heading" tabIndex={-1}>
            {result.title}
          </h1>
          <p role="status">{result.copy}</p>
          {mode === "sent" && (
            <p className="verify-hint">
              Use the newest link if you receive another email.
            </p>
          )}
          {mode === "invalid" ? (
            <button
              className="button login-submit"
              type="button"
              onClick={() => move("resend")}
            >
              Request a new email
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          ) : (
            <Link className="button login-submit" href="/login">
              Return to sign in
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          )}
          {(mode === "sent" || mode === "invalid") && (
            <button
              className="verify-secondary"
              type="button"
              onClick={() => move("verify")}
            >
              {mode === "sent" ? "Use a verification token" : "Use another token"}
            </button>
          )}
          {mode === "sent" && (
            <button
              className="verify-switch"
              type="button"
              onClick={() => move("resend")}
            >
              Use another email
            </button>
          )}
          {mode === "invalid" && <Link href="/login">Return to sign in</Link>}
          {mode === "uncertain" && (
            <button
              className="verify-secondary"
              type="button"
              onClick={() => move("resend")}
            >
              Request a new email
            </button>
          )}
        </section>
      )}
      <div className="login-help">
        <Link href="/help/account-security">Need help with your account?</Link>
      </div>
    </div>
  );
}
