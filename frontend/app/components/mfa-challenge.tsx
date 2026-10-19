"use client";
import { useEffect, useRef, useState } from "react";
import { Smartphone, KeyRound, FileKey, ChevronRight } from "lucide-react";
import { startAuthentication } from "@simplewebauthn/browser";
import { apiRequest, ApiError } from "@/lib/api/client";
import {
  authenticationOptionsSchema,
  recoveryOptionsSchema,
  totpOptionsSchema,
} from "@/lib/api/mfa-schemas";
import { csrfResultSchema } from "@/lib/api/security-schemas";
import { useMfaOperation } from "@/lib/api/use-mfa-operation";
import { Feedback } from "./feedback";
import { MfaCodeForm } from "./mfa-code-form";
import { AuthenticatorHelp } from "./authenticator-help";
import type { z } from "zod";
type Method = "totp" | "webauthn" | "recovery-code";
type Options =
  | { method: "totp"; data: z.infer<typeof totpOptionsSchema> }
  | { method: "webauthn"; data: z.infer<typeof authenticationOptionsSchema> }
  | { method: "recovery-code" };
export function MfaChallenge({
  onComplete,
  onSetup,
  onCheck,
  replacement = false,
  onReplaceAuthenticator,
}: {
  onComplete: (token: string) => void;
  onSetup: () => void;
  onCheck: () => void;
  replacement?: boolean;
  onReplaceAuthenticator: () => void;
}) {
  const operation = useMfaOperation();
  const firstMethod = useRef<HTMLButtonElement>(null);
  const [options, setOptions] = useState<Options>();
  const keyAction = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (options?.method === "webauthn") keyAction.current?.focus();
  }, [options]);
  const [unavailable, setUnavailable] = useState<string>();
  const [canSetup, setCanSetup] = useState(false);
  async function prepare(method: Method) {
    setOptions(undefined);
    setUnavailable(undefined);
    setCanSetup(false);
    await operation.run(async (signal) => {
      try {
        const result = (
          await apiRequest<unknown>("/auth/mfa/challenge/options", {
            method: "POST",
            csrf: true,
            body: { method },
            signal,
          })
        ).data;
        if (method === "totp")
          setOptions({ method, data: totpOptionsSchema.parse(result) });
        else if (method === "webauthn")
          setOptions({ method, data: authenticationOptionsSchema.parse(result) });
        else {
          recoveryOptionsSchema.parse(result);
          setOptions({ method });
        }
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.status === 400 &&
          error.code === "TOKEN_INVALID"
        )
          setUnavailable(
            "This method is not available for this account. Choose another method.",
          );
        else throw error;
      }
    });
  }
  async function checkSetup() {
    setOptions(undefined);
    setUnavailable(undefined);
    setCanSetup(false);
    await operation.run(async (signal) => {
      const methods = ["totp", "webauthn", "recovery-code"] as const;
      const results = await Promise.all(
        methods.map(async (method) => {
          try {
            const value = (
              await apiRequest<unknown>("/auth/mfa/challenge/options", {
                method: "POST",
                csrf: true,
                body: { method },
                signal,
              })
            ).data;
            if (method === "totp") totpOptionsSchema.parse(value);
            else if (method === "webauthn") authenticationOptionsSchema.parse(value);
            else recoveryOptionsSchema.parse(value);
            return true;
          } catch (error) {
            if (
              error instanceof ApiError &&
              error.status === 400 &&
              error.code === "TOKEN_INVALID"
            )
              return false;
            throw error;
          }
        }),
      );
      if (signal.aborted) return;
      setCanSetup(results.every((value) => !value));
      setUnavailable(
        results.some(Boolean)
          ? "An MFA method is already linked to your account. Verify with that method or a saved recovery code before adding a new one."
          : "No existing MFA method is available. You can set up your first factor.",
      );
    });
  }
  const disabled =
    operation.busy || operation.uncertain || operation.requiresMfa || operation.waiting;
  return (
    <>
      <p className="login-intro">
        {options?.method === "totp"
          ? "Enter the current code from your authenticator app."
          : options?.method === "recovery-code"
            ? "Enter one of your saved recovery codes."
            : options?.method === "webauthn"
              ? "Your security key is ready. Continue to your browser?s prompt to verify."
              : replacement
                ? "Verify with a saved recovery code or another linked method. Then scan a new QR code to replace your old authenticator registration."
                : "Choose a method already linked to your account."}
      </p>
      {!options && (
        <div className="mfa-methods" role="group" aria-label="MFA method">
          {(
            [
              ["totp", "Authenticator", "Use a six-digit code from your app", Smartphone],
              [
                "webauthn",
                "Prepare security key",
                "Use your device or a physical key",
                KeyRound,
              ],
              [
                "recovery-code",
                "Recovery code",
                "Use one of your saved codes once",
                FileKey,
              ],
            ] as const
          ).map(([method, label, hint, Icon]) => (
            <button
              key={method}
              ref={method === "totp" ? firstMethod : undefined}
              type="button"
              className="mfa-method"
              aria-label={label}
              disabled={disabled}
              onClick={() => void prepare(method)}
            >
              <Icon size={20} aria-hidden="true" />
              <span>
                <strong>{label}</strong>
                <small>{hint}</small>
              </span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      <Feedback message={operation.error} />
      {operation.waiting && (
        <p className="mfa-hint">
          Try again in about {Math.ceil(operation.waitSeconds / 60)}{" "}
          {operation.waitSeconds > 60 ? "minutes" : "minute"}.
        </p>
      )}
      <p className="mfa-operation-status" role="status">
        {unavailable}
        {operation.busy ? " Preparing or verifying your security step..." : ""}
      </p>
      {options?.method !== "webauthn" && options && (
        <MfaCodeForm
          key={options.method}
          recovery={options.method === "recovery-code"}
          factors={options.method === "totp" ? options.data.factors : undefined}
          disabled={disabled}
          onSubmit={(code, factorId) =>
            operation.run(async (signal, submitted) => {
              submitted();
              const result = csrfResultSchema.parse(
                (
                  await apiRequest<unknown>("/auth/mfa/challenge/verify", {
                    method: "POST",
                    csrf: true,
                    signal,
                    body:
                      options.method === "totp"
                        ? { method: "totp", factorId, code }
                        : { method: "recovery-code", code },
                  })
                ).data,
              );
              onComplete(result.csrfToken);
            })
          }
        />
      )}
      {options?.method === "webauthn" && (
        <button
          ref={keyAction}
          className="button login-submit"
          disabled={disabled}
          onClick={() =>
            void operation.run(async (signal, submitted) => {
              const prepared = options.data;
              setOptions(undefined);
              const response = await startAuthentication({ optionsJSON: prepared });
              if (signal.aborted) return;
              submitted();
              const result = csrfResultSchema.parse(
                (
                  await apiRequest<unknown>("/auth/mfa/challenge/verify", {
                    method: "POST",
                    csrf: true,
                    signal,
                    body: { method: "webauthn", response },
                  })
                ).data,
              );
              onComplete(result.csrfToken);
            })
          }
        >
          Use security key
        </button>
      )}
      {options && !operation.uncertain && !operation.requiresMfa && (
        <button
          type="button"
          className="mfa-text-button"
          disabled={disabled}
          onClick={() => {
            setOptions(undefined);
            setUnavailable(undefined);
            operation.clearError();
            requestAnimationFrame(() => firstMethod.current?.focus());
          }}
        >
          Choose another method
        </button>
      )}
      {operation.uncertain || operation.requiresMfa ? (
        <button className="button secondary" onClick={onCheck}>
          Check session status
        </button>
      ) : !options && !replacement ? (
        <div className="mfa-first-factor">
          <button
            className="mfa-text-button"
            disabled={disabled}
            onClick={() => void checkSetup()}
          >
            Check first-factor setup
          </button>
          {canSetup && (
            <button className="button" disabled={disabled} onClick={onSetup}>
              Set up first MFA factor
            </button>
          )}
        </div>
      ) : null}
      {!replacement && (
        <button
          type="button"
          className="mfa-text-button"
          disabled={disabled}
          onClick={() => {
            setOptions(undefined);
            setUnavailable(undefined);
            setCanSetup(false);
            operation.clearError();
            onReplaceAuthenticator();
            requestAnimationFrame(() => firstMethod.current?.focus());
          }}
        >
          Set up authenticator again
        </button>
      )}
      <AuthenticatorHelp />
    </>
  );
}
