"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle, Mail } from "lucide-react";
import {
  apiRequest,
  ApiError,
  SESSION_CHANGED,
  invalidateSession,
  isExternalSessionChange,
} from "@/lib/api/client";
import { registrationFields, type RegistrationField } from "@/lib/auth/registration";
import { Feedback } from "./feedback";
import { notify } from "@/lib/notifications";
import { IntakePrivacyNote } from "./intake-privacy-note";
const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
const details = [
  { name: "firstName", label: "First name", autocomplete: "given-name", max: 80 },
  { name: "lastName", label: "Last name", autocomplete: "family-name", max: 80 },
  { name: "phone", label: "Phone number", autocomplete: "tel", max: 32 },
  { name: "email", label: "Email address", autocomplete: "email", max: 254 },
] as const;
export function RegisterForm() {
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  const [accepted, setAccepted] = useState(false),
    [error, setError] = useState<string>(),
    [busy, setBusy] = useState(false),
    [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<RegistrationField, string>>>({});
  const form = useRef<HTMLFormElement>(null),
    password = useRef<HTMLInputElement>(null),
    heading = useRef<HTMLHeadingElement>(null),
    pending = useRef<AbortController | null>(null);
  useEffect(() => {
    function discard() {
      pending.current?.abort();
      pending.current = null;
      form.current?.reset();
      setAccepted(false);
      setBusy(false);
      setVisible(false);
      setErrors({});
      setError(
        "Your session changed. Check your email before starting another registration.",
      );
    }
    function hide() {
      if (document.hidden) setVisible(false);
    }
    function restored(event: PageTransitionEvent) {
      if (event.persisted) discard();
    }
    const channel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel("aat-session");
    if (channel)
      channel.onmessage = (event) => {
        if (isExternalSessionChange(event.data)) invalidateSession();
      };
    window.addEventListener(SESSION_CHANGED, discard);
    window.addEventListener("pageshow", restored);
    document.addEventListener("visibilitychange", hide);
    return () => {
      pending.current?.abort();
      channel?.close();
      window.removeEventListener(SESSION_CHANGED, discard);
      window.removeEventListener("pageshow", restored);
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);
  useEffect(() => {
    if (accepted) heading.current?.focus({ preventScroll: true });
  }, [accepted]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || accepted) return;
    const fields = new FormData(event.currentTarget),
      parsed = registrationFields.safeParse(Object.fromEntries(fields));
    setErrors({});
    setError(undefined);
    if (!parsed.success) {
      const next: Partial<Record<RegistrationField, string>> = {};
      for (const issue of parsed.error.issues) {
        const name = issue.path[0] as RegistrationField;
        if (!next[name]) next[name] = issue.message;
      }
      setErrors(next);
      form.current
        ?.querySelector<HTMLInputElement>(`[name="${Object.keys(next)[0]}"]`)
        ?.focus();
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setVisible(false);
    if (password.current) password.current.value = "";
    try {
      await apiRequest<never>("/auth/register", {
        method: "POST",
        body: parsed.data,
        signal: controller.signal,
      });
      controller.signal.throwIfAborted();
      form.current?.reset();
      setAccepted(true);
      notify("Check your email for the next step.", {
        tone: "success",
        inlineAnnounced: true,
      });
    } catch (value) {
      if (!controller.signal.aborted) {
        if (value instanceof ApiError && value.fields) {
          const next: Partial<Record<RegistrationField, string>> = {};
          for (const name of [
            "firstName",
            "lastName",
            "phone",
            "email",
            "password",
          ] as const)
            if (value.fields[`body.${name}`])
              next[name] =
                name === "password"
                  ? "Use a different, unique passphrase of 12–128 characters."
                  : "Check this field and enter a valid value.";
          setErrors(next);
        }
        setError(
          value instanceof ApiError
            ? value.message
            : "Registration could not be confirmed. Check your email before submitting again.",
        );
      }
    } finally {
      parsed.data.password = "";
      fields.delete("password");
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  function restart() {
    setAccepted(false);
    setError(undefined);
    setErrors({});
    form.current?.reset();
    requestAnimationFrame(() =>
      form.current?.querySelector<HTMLInputElement>('[name="firstName"]')?.focus(),
    );
  }
  return (
    <div className="login-form register-form">
      <h1>
        Better care starts here<span>.</span>
      </h1>
      <p className="login-intro">Create your Allied AutoTech customer account.</p>
      <Feedback message={error} toast="Please review the message on this page." />
      <noscript hidden={ready}>
        <p>
          Enable JavaScript to create an account. You can still browse our Help Centre.
        </p>
      </noscript>
      {accepted && (
        <section className="register-accepted" aria-label="Registration next step">
          <Mail size={36} aria-hidden="true" />
          <h2 ref={heading} tabIndex={-1}>
            Check your email
          </h2>
          <p role="status">
            Check your email for verification instructions before signing in.
          </p>
          <Link className="button login-submit" href="/login">
            Sign in
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <button
            type="button"
            className="button secondary register-again"
            onClick={restart}
          >
            Use another email
          </button>
        </section>
      )}
      <form
        ref={form}
        hidden={!ready || accepted}
        method="post"
        onSubmit={submit}
        aria-busy={busy}
      >
        <div className="register-fields">
          {details.map((field) => (
            <div key={field.name} className={`login-field register-${field.name}`}>
              <label htmlFor={field.name}>{field.label}</label>
              <input
                id={field.name}
                name={field.name}
                type={
                  field.name === "email"
                    ? "email"
                    : field.name === "phone"
                      ? "tel"
                      : "text"
                }
                autoComplete={field.autocomplete}
                autoCapitalize={field.name === "email" ? "none" : undefined}
                spellCheck={field.name === "email" ? false : undefined}
                required
                maxLength={field.max}
                minLength={field.name === "phone" ? 7 : undefined}
                disabled={busy}
                aria-invalid={!!errors[field.name]}
                aria-describedby={errors[field.name] ? `${field.name}-error` : undefined}
              />
              {errors[field.name] && (
                <p className="register-error" id={`${field.name}-error`}>
                  {errors[field.name]}
                </p>
              )}
            </div>
          ))}
        </div>
        <div className="login-field">
          <label htmlFor="password">Password</label>
          <div className="login-password">
            <input
              ref={password}
              id="password"
              name="password"
              type={visible ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              disabled={busy}
              aria-invalid={!!errors.password}
              aria-describedby={`password-hint${errors.password ? " password-error" : ""}`}
            />
            <button
              type="button"
              className="login-reveal"
              disabled={busy}
              aria-label={visible ? "Hide password" : "Show password"}
              aria-controls="password"
              aria-pressed={visible}
              onClick={() => setVisible(!visible)}
            >
              {visible ? (
                <EyeOff size={20} aria-hidden="true" />
              ) : (
                <Eye size={20} aria-hidden="true" />
              )}
            </button>
          </div>
          <p className="register-hint" id="password-hint">
            Use a unique passphrase of 12–128 characters. Avoid common or reused
            passwords.
          </p>
          {errors.password && (
            <p className="register-error" id="password-error">
              {errors.password}
            </p>
          )}
        </div>
        <IntakePrivacyNote account />
        <button className="button login-submit" disabled={busy} type="submit">
          {busy ? (
            <>
              <LoaderCircle className="login-spinner" size={18} aria-hidden="true" />
              Creating account…
            </>
          ) : (
            <>
              Create account
              <ArrowRight size={18} aria-hidden="true" />
            </>
          )}
        </button>
      </form>
      {!accepted && (
        <p className="login-register">
          Already registered? <Link href="/login">Sign in</Link>
        </p>
      )}
      <div className="login-help">
        <Link href="/help/account-security">Need help with your account?</Link>
      </div>
    </div>
  );
}
