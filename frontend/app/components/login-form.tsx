"use client";
import Link from "next/link";
import { catalogueOnly } from "@/lib/public-launch";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole } from "lucide-react";
import {
  apiRequest,
  ApiError,
  announceSessionChange,
  refreshCsrf,
  SESSION_CHANGED,
  invalidateSession,
  isExternalSessionChange,
} from "@/lib/api/client";
import { loginResponse, loginDestination } from "@/lib/auth/login";
import { Feedback } from "./feedback";
import { notify } from "@/lib/notifications";
const subscribeHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function LoginForm() {
  const ready = useSyncExternalStore(subscribeHydration, clientReady, serverReady);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const pending = useRef<AbortController | null>(null);
  const rotating = useRef(false);
  useEffect(() => {
    function discard() {
      if (rotating.current) return;
      pending.current?.abort();
      pending.current = null;
      formRef.current?.reset();
      setVisible(false);
      setBusy(false);
      setError("Your session changed. Enter your details again to sign in.");
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
  function rotate() {
    rotating.current = true;
    try {
      announceSessionChange();
    } finally {
      rotating.current = false;
    }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const fields = new FormData(event.currentTarget);
    const body = {
      email: String(fields.get("email") ?? "").trim(),
      password: String(fields.get("password") ?? ""),
    };
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError(null);
    setVisible(false);
    if (passwordRef.current) passwordRef.current.value = "";
    try {
      rotate();
      const result = await apiRequest<unknown>("/auth/login", {
        method: "POST",
        body,
        signal: controller.signal,
      });
      const data = loginResponse.parse(result.data);
      controller.signal.throwIfAborted();
      rotate();
      await refreshCsrf();
      controller.signal.throwIfAborted();
      const destination = loginDestination(
        data,
        new URLSearchParams(window.location.search).get("next"),
      );
      notify(
        data.mfaRequired
          ? "Password accepted. Complete your security verification."
          : "Signed in successfully.",
        { tone: data.mfaRequired ? "info" : "success" },
      );
      router.replace(destination);
      // Keep the submission lock until this page unmounts during navigation.
    } catch (value) {
      if (!controller.signal.aborted) {
        setError(
          value instanceof ApiError
            ? value.message
            : "Sign in could not be confirmed. Please try again.",
        );
        setBusy(false);
        pending.current = null;
      }
    } finally {
      body.password = "";
      fields.delete("password");
    }
  }
  return (
    <div className="login-form">
      <h1>
        Welcome back<span>.</span>
      </h1>
      <p className="login-intro">
        {catalogueOnly()
          ? "Sign in with your authorised Allied AutoTech staff account."
          : "Sign in to your Allied AutoTech account."}
      </p>
      <Feedback message={error} toast="Please review the message on this page." />
      <noscript hidden={ready}>
        <p>Enable JavaScript to sign in. You can still browse our Help Centre.</p>
      </noscript>
      <form
        ref={formRef}
        hidden={!ready}
        method="post"
        onSubmit={submit}
        aria-busy={busy}
      >
        <div className="login-field">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={254}
            disabled={busy}
          />
        </div>
        <div className="login-field">
          <div className="login-password-label">
            <label htmlFor="password">Password</label>
            <Link href="/forgot-password">Forgot password?</Link>
          </div>
          <div className="login-password">
            <input
              ref={passwordRef}
              id="password"
              name="password"
              type={visible ? "text" : "password"}
              autoComplete="current-password"
              required
              maxLength={128}
              disabled={busy}
            />
            <button
              type="button"
              className="login-reveal"
              aria-label={visible ? "Hide password" : "Show password"}
              aria-pressed={visible}
              aria-controls="password"
              disabled={busy}
              onClick={() => setVisible(!visible)}
            >
              {visible ? (
                <EyeOff size={20} aria-hidden="true" />
              ) : (
                <Eye size={20} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
        <button className="button login-submit" disabled={busy} type="submit">
          {busy ? (
            <>
              <LoaderCircle className="login-spinner" size={18} aria-hidden="true" />{" "}
              Signing in…
            </>
          ) : (
            <>
              Sign in <ArrowRight size={18} aria-hidden="true" />
            </>
          )}
        </button>
      </form>
      {!catalogueOnly() && (
        <p className="login-register">
          New to Allied AutoTech? <Link href="/register">Create an account</Link>
        </p>
      )}
      <div className="login-help">
        <Link href="/help/account-security">Need help with your account?</Link>
        <p>
          <LockKeyhole size={18} aria-hidden="true" />
          Additional verification may be required for your account.
        </p>
      </div>
    </div>
  );
}
