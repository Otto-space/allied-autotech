"use client";
import { useState } from "react";
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
}: {
  onComplete: (token: string) => void;
  onSetup: () => void;
  onCheck: () => void;
}) {
  const operation = useMfaOperation();
  const [options, setOptions] = useState<Options>();
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
        if (error instanceof ApiError && error.code === "TOKEN_INVALID")
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
            if (error instanceof ApiError && error.code === "TOKEN_INVALID") return false;
            throw error;
          }
        }),
      );
      if (signal.aborted) return;
      setCanSetup(results.every((value) => !value));
      setUnavailable(
        results.some(Boolean)
          ? "An existing MFA method is available. Verify with that method before adding a new factor."
          : "No existing MFA method is available. You can set up your first factor.",
      );
    });
  }
  const disabled = operation.busy || operation.uncertain || operation.requiresMfa;
  return (
    <>
      <p>
        Use a factor already registered to this account. Recovery codes can each be used
        once.
      </p>
      <div className="actions" role="group" aria-label="MFA method">
        {(
          [
            ["totp", "Authenticator"],
            ["webauthn", "Prepare security key"],
            ["recovery-code", "Recovery code"],
          ] as const
        ).map(([method, label]) => (
          <button
            key={method}
            className="button secondary"
            disabled={disabled}
            onClick={() => void prepare(method)}
          >
            {label}
          </button>
        ))}
      </div>
      <Feedback message={operation.error} />
      <p role="status">
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
          className="button"
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
      {operation.uncertain || operation.requiresMfa ? (
        <button className="button secondary" onClick={onCheck}>
          Check session status
        </button>
      ) : (
        <div className="detail-section">
          <button
            className="button secondary"
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
      )}
    </>
  );
}
