"use client";
import { startAuthentication } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SubmitEvent } from "react";
import { apiRequest, ApiError, refreshCsrf, setCsrfToken } from "@/lib/api/client";
import { Feedback } from "./feedback";
type Method = "totp" | "recovery-code" | "webauthn";
type TotpOption = {
  method: "totp";
  available: true;
  factors: { id: string; name: string | null }[];
};
type TotpEnrollment = { factorId: string; secret: string; uri: string };
function formString(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}
export function MfaForm() {
  const router = useRouter();
  const [method, setMethod] = useState<Method>("totp");
  const [factorId, setFactorId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  useEffect(() => {
    void load("totp");
  }, []);
  async function load(next: Method) {
    setMethod(next);
    setError(null);
    try {
      await refreshCsrf();
      const result = await apiRequest<TotpOption | Record<string, unknown>>(
        "/auth/mfa/challenge/options",
        { method: "POST", csrf: true, body: { method: next } },
      );
      if (next === "totp") {
        const factors = (result.data as TotpOption | undefined)?.factors ?? [];
        setFactorId(factors[0]?.id ?? "");
      }
    } catch (error_) {
      if (
        next === "totp" &&
        error_ instanceof ApiError &&
        error_.code === "TOKEN_INVALID"
      ) {
        setError("No authenticator is configured for this account yet.");
        return;
      }
      setError(
        error_ instanceof Error ? error_.message : "This MFA method is unavailable.",
      );
    }
  }
  async function startEnrollment() {
    setBusy(true);
    setError(null);
    try {
      await refreshCsrf();
      const result = await apiRequest<TotpEnrollment>("/auth/mfa/totp/setup", {
        method: "POST",
        csrf: true,
        body: {},
      });
      if (!result.data?.factorId || !result.data.secret || !result.data.uri)
        throw new Error("The authenticator setup response was incomplete.");
      setEnrollment(result.data);
      setMethod("totp");
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : "Authenticator setup failed.");
    } finally {
      setBusy(false);
    }
  }
  async function verifyEnrollment(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!enrollment || busy) return;
    setBusy(true);
    setError(null);
    try {
      const code = formString(new FormData(e.currentTarget), "setup-code");
      const result = await apiRequest<{
        recoveryCodes: string[];
        csrfToken: string;
      }>("/auth/mfa/totp/verify", {
        method: "POST",
        csrf: true,
        body: { factorId: enrollment.factorId, code },
      });
      setCsrfToken(result.data?.csrfToken);
      setRecoveryCodes(result.data?.recoveryCodes ?? []);
    } catch (error_) {
      setError(
        error_ instanceof Error ? error_.message : "Authenticator verification failed.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    try {
      let body: Record<string, unknown>;
      if (method === "webauthn") {
        const options = await apiRequest<Record<string, unknown>>(
          "/auth/mfa/challenge/options",
          { method: "POST", csrf: true, body: { method } },
        );
        const response = await startAuthentication({
          optionsJSON: options.data as never,
        });
        body = { method, response };
      } else
        body =
          method === "totp"
            ? { method, factorId, code: formString(f, "code") }
            : { method, code: formString(f, "code") };
      const result = await apiRequest<{ csrfToken: string }>(
        "/auth/mfa/challenge/verify",
        { method: "POST", csrf: true, body },
      );
      setCsrfToken(result.data?.csrfToken);
      router.replace("/dashboard");
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <span className="eyebrow">Second step</span>
      <h1>Verify it’s you.</h1>
      <p className="muted">Complete the second factor configured for this account.</p>
      <div className="actions" role="group" aria-label="MFA method">
        <button
          type="button"
          className={`button ${method === "totp" ? "" : "secondary"}`}
          onClick={() => void load("totp")}
        >
          Authenticator
        </button>
        <button
          type="button"
          className={`button ${method === "webauthn" ? "" : "secondary"}`}
          onClick={() => void load("webauthn")}
        >
          Security key
        </button>
        <button
          type="button"
          className={`button ${method === "recovery-code" ? "" : "secondary"}`}
          onClick={() => void load("recovery-code")}
        >
          Recovery code
        </button>
      </div>
      <Feedback message={error} />
      {!enrollment && !recoveryCodes && error?.includes("No authenticator") && (
        <div className="empty">
          <h2>Set up your authenticator</h2>
          <p>Use an authenticator app to scan or enter a new setup key.</p>
          <button
            type="button"
            className="button"
            onClick={() => void startEnrollment()}
            disabled={busy}
          >
            {busy ? "Preparing setup..." : "Set up authenticator"}
          </button>
        </div>
      )}
      {enrollment && !recoveryCodes && (
        <section className="card">
          <h2>Finish authenticator setup</h2>
          <p>Enter this key in your authenticator app, then verify the six-digit code.</p>
          <p>
            <strong>Setup key:</strong> {enrollment.secret}
          </p>
          <p className="muted">If your app supports it, use this URI: {enrollment.uri}</p>
          <form onSubmit={verifyEnrollment}>
            <div className="field">
              <label htmlFor="setup-code">Authenticator code</label>
              <input
                id="setup-code"
                name="setup-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
              />
            </div>
            <button type="submit" className="button" disabled={busy}>
              {busy ? "Verifying..." : "Verify authenticator"}
            </button>
          </form>
        </section>
      )}
      {recoveryCodes && (
        <section className="card">
          <h2>Save your recovery codes</h2>
          <p>
            Store these codes securely. Each code can be used once if you lose your
            authenticator.
          </p>
          <p>
            <strong>{recoveryCodes.join("  ")}</strong>
          </p>
          <button
            type="button"
            className="button"
            onClick={() => router.replace("/dashboard")}
          >
            Continue
          </button>
        </section>
      )}
      {!enrollment && !recoveryCodes && !error?.includes("No authenticator") && (
        <form onSubmit={submit}>
          {method !== "webauthn" && (
            <div className="field">
              <label htmlFor="code">
                {method === "totp" ? "6-digit code" : "Recovery code"}
              </label>
              <input
                id="code"
                name="code"
                inputMode={method === "totp" ? "numeric" : "text"}
                autoComplete="one-time-code"
                required
                pattern={method === "totp" ? "[0-9]{6}" : undefined}
                maxLength={method === "totp" ? 6 : 128}
              />
            </div>
          )}
          <div className="form-footer">
            <button
              type="submit"
              className="button"
              disabled={busy || (method === "totp" && !factorId)}
            >
              {busy
                ? "Verifying…"
                : method === "webauthn"
                  ? "Use security key"
                  : "Verify code"}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
