"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, LoaderCircle, Mail } from "lucide-react";
import { z } from "zod";
import {
  apiRequest,
  ApiError,
  SESSION_CHANGED,
  invalidateSession,
  isExternalSessionChange,
} from "@/lib/api/client";
import { Feedback } from "./feedback";

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
const emailSchema = z.string().trim().pipe(z.email().max(254));

export function ForgotPasswordForm() {
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldError, setFieldError] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  const email = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const pending = useRef<AbortController | null>(null);
  const retryAt = useRef(0);

  useEffect(() => {
    function discard() {
      pending.current?.abort();
      pending.current = null;
      form.current?.reset();
      setAccepted(false);
      setBusy(false);
      setFieldError(false);
      setError(
        "Your session changed. Check your email before requesting another recovery link.",
      );
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
    return () => {
      pending.current?.abort();
      channel?.close();
      window.removeEventListener(SESSION_CHANGED, discard);
      window.removeEventListener("pageshow", restored);
    };
  }, []);

  useEffect(() => {
    if (accepted) heading.current?.focus();
  }, [accepted]);

  const waiting = waitSeconds > 0;
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => {
      setWaitSeconds(Math.max(0, Math.ceil((retryAt.current - Date.now()) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [waiting]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || accepted || Date.now() < retryAt.current) return;
    setError(undefined);
    setFieldError(false);
    const parsed = emailSchema.safeParse(email.current?.value);
    if (!parsed.success) {
      setFieldError(true);
      email.current?.focus();
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    try {
      await apiRequest<never>("/auth/password/forgot", {
        method: "POST",
        body: { email: parsed.data },
        signal: controller.signal,
      });
      controller.signal.throwIfAborted();
      form.current?.reset();
      setAccepted(true);
    } catch (value) {
      if (controller.signal.aborted) return;
      if (value instanceof ApiError && value.status === 429) {
        const seconds = value.retryAfterSeconds ?? 0;
        retryAt.current = Date.now() + seconds * 1000;
        setWaitSeconds(seconds);
        setError(
          "Too many requests. Please wait before requesting another recovery link.",
        );
      } else if (value instanceof ApiError && value.fields?.["body.email"]) {
        setFieldError(true);
        setError("Check your email address and try again.");
      } else if (value instanceof ApiError && value.status === 403) {
        setError("The request could not be verified. Refresh this page and try again.");
      } else {
        setError(
          "We could not confirm the request. Check your email before trying again.",
        );
      }
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }

  function restart() {
    setAccepted(false);
    setError(undefined);
    setFieldError(false);
    requestAnimationFrame(() => email.current?.focus());
  }

  return (
    <div className="login-form recovery-form">
      {!accepted && (
        <>
          <h1>
            Forgot your password<span>.</span>
          </h1>
          <p className="login-intro">
            Enter the email address you use for your account. If it is eligible, we will
            send a recovery link.
          </p>
        </>
      )}
      <Feedback message={error} />
      {!ready && (
        <p className="login-intro">
          Enable JavaScript to request a recovery link. You can still browse our Help
          Centre.
        </p>
      )}
      <form
        ref={form}
        hidden={!ready || accepted}
        method="post"
        onSubmit={submit}
        aria-busy={busy}
      >
        <div className="login-field">
          <label htmlFor="recovery-email">Email address</label>
          <input
            ref={email}
            id="recovery-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            disabled={busy}
            aria-invalid={fieldError || undefined}
            aria-describedby={fieldError ? "recovery-email-error" : undefined}
          />
          {fieldError && (
            <p id="recovery-email-error" className="recovery-field-error">
              Enter a valid email address.
            </p>
          )}
        </div>
        <button className="button login-submit" type="submit" disabled={busy || waiting}>
          {busy ? (
            <>
              <LoaderCircle className="login-spinner" size={18} aria-hidden="true" />
              Requesting link…
            </>
          ) : (
            <>
              Send recovery link
              <ArrowRight size={18} aria-hidden="true" />
            </>
          )}
        </button>
        {waiting && (
          <p className="recovery-hint">
            Try again in about {Math.ceil(waitSeconds / 60)}{" "}
            {waitSeconds > 60 ? "minutes" : "minute"}.
          </p>
        )}
        <div className="recovery-return">
          <Link href="/login">Return to sign in</Link>
        </div>
      </form>
      {accepted && (
        <section className="recovery-accepted" aria-labelledby="recovery-heading">
          <Mail size={36} aria-hidden="true" />
          <h1 id="recovery-heading" ref={heading} tabIndex={-1}>
            Check your email
          </h1>
          <p role="status">
            If your account is eligible, a recovery link will be sent. Check your email
            for the next step.
          </p>
          <p className="recovery-hint">
            Check your spam folder. If you request another link, use the newest email.
          </p>
          <Link className="button login-submit" href="/login">
            Return to sign in
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <button className="recovery-restart" type="button" onClick={restart}>
            Use another email
          </button>
        </section>
      )}
      <div className="login-help">
        <Link href="/help/account-security">Need help with your account?</Link>
        {!accepted && <p>Check your spam folder before requesting another link.</p>}
      </div>
    </div>
  );
}
