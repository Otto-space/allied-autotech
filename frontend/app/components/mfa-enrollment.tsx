"use client";
import { useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { apiRequest } from "@/lib/api/client";
import {
  enrollmentResultSchema,
  registrationOptionsSchema,
  totpEnrollmentSchema,
  type TotpEnrollment,
} from "@/lib/api/mfa-schemas";
import { useMfaOperation } from "@/lib/api/use-mfa-operation";
import { Feedback } from "./feedback";
import { MfaCodeForm } from "./mfa-code-form";
import type { z } from "zod";
import { AuthenticatorQr } from "./authenticator-qr";
import { CopyControl } from "./copy-control";
export function MfaEnrollment({
  onComplete,
  onCheck,
  onReverify,
}: {
  onComplete: (token: string, codes: string[]) => void;
  onCheck: () => void;
  onReverify: () => void;
}) {
  const operation = useMfaOperation();
  const [totp, setTotp] = useState<TotpEnrollment>();
  const [key, setKey] = useState<z.infer<typeof registrationOptionsSchema>>();
  const [name, setName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const disabled =
    operation.busy || operation.uncertain || operation.requiresMfa || operation.waiting;
  return (
    <>
      {!totp && !key && (
        <p className="login-intro">
          Add an authenticator app or a security key. Completing setup replaces your
          recovery codes and renews this session. Save the new codes before leaving.
        </p>
      )}
      {!totp && !key && (
        <label className="check-field">
          <input
            type="checkbox"
            checked={accepted}
            disabled={disabled || !!totp || !!key}
            onChange={(event) => setAccepted(event.target.checked)}
          />{" "}
          I understand that completing setup replaces my recovery codes.
        </label>
      )}
      <Feedback message={operation.error} />
      {operation.requiresMfa && (
        <button className="button login-submit" onClick={onReverify}>
          Verify existing MFA
        </button>
      )}
      {operation.waiting && (
        <p className="mfa-hint">
          Try again in about {Math.ceil(operation.waitSeconds / 60)}{" "}
          {operation.waitSeconds > 60 ? "minutes" : "minute"}.
        </p>
      )}
      {operation.busy && <p role="status">Preparing or verifying your MFA factor...</p>}
      {!totp && !key && (
        <>
          <p className="mfa-hint">
            Starting authenticator setup replaces any unfinished app setup.
          </p>
          <button
            className="button login-submit"
            disabled={disabled || !accepted}
            onClick={() =>
              void operation.run(async (signal, submitted) => {
                submitted();
                const result = totpEnrollmentSchema.parse(
                  (
                    await apiRequest<unknown>("/auth/mfa/totp/setup", {
                      method: "POST",
                      csrf: true,
                      signal,
                      body: {},
                    })
                  ).data,
                );
                setTotp(result);
              })
            }
          >
            Set up authenticator app
          </button>
          <div className="detail-section">
            <div className="field">
              <label htmlFor="security-key-name">Security key name (optional)</label>
              <input
                id="security-key-name"
                maxLength={100}
                autoComplete="off"
                value={name}
                disabled={disabled}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <button
              className="button secondary"
              disabled={disabled || !accepted}
              onClick={() =>
                void operation.run(async (signal) => {
                  const result = registrationOptionsSchema.parse(
                    (
                      await apiRequest<unknown>("/auth/mfa/webauthn/options", {
                        method: "POST",
                        csrf: true,
                        signal,
                        body: {},
                      })
                    ).data,
                  );
                  setKey(result);
                })
              }
            >
              Prepare new security key
            </button>
          </div>
        </>
      )}
      {totp && !operation.uncertain && !operation.requiresMfa && (
        <section className="mfa-connect">
          <h2>Connect your authenticator app</h2>
          <p>Scan this QR code, or enter the setup key below.</p>
          <AuthenticatorQr key={totp.factorId} uri={totp.uri} />
          <p className="mfa-hint">
            Choose a time-based code. Keep the setup key private.
          </p>
          <div className="field">
            <label htmlFor="totp-secret">Authenticator setup key</label>
            <textarea
              id="totp-secret"
              readOnly
              rows={1}
              value={totp.secret}
              autoComplete="off"
              spellCheck={false}
            />
            <CopyControl
              value={totp.secret}
              label="Copy setup key"
              fieldId="totp-secret"
            />
          </div>
          <MfaCodeForm
            disabled={disabled}
            onSubmit={(code) =>
              operation.run(async (signal, submitted) => {
                submitted();
                const result = enrollmentResultSchema.parse(
                  (
                    await apiRequest<unknown>("/auth/mfa/totp/verify", {
                      method: "POST",
                      csrf: true,
                      signal,
                      body: { factorId: totp.factorId, code },
                    })
                  ).data,
                );
                setTotp(undefined);
                onComplete(result.csrfToken, result.recoveryCodes);
              })
            }
          />
        </section>
      )}
      {key && (
        <div className="detail-section">
          <p>
            Continue to the browser prompt to create your new security key. The server
            must confirm it before setup is complete.
          </p>
          <button
            className="button login-submit"
            disabled={disabled}
            onClick={() =>
              void operation.run(async (signal, submitted) => {
                const prepared = key;
                setKey(undefined);
                const response = await startRegistration({ optionsJSON: prepared });
                if (signal.aborted) return;
                submitted();
                const result = enrollmentResultSchema.parse(
                  (
                    await apiRequest<unknown>("/auth/mfa/webauthn/verify", {
                      method: "POST",
                      csrf: true,
                      signal,
                      body: { response, ...(name.trim() ? { name: name.trim() } : {}) },
                    })
                  ).data,
                );
                setName("");
                onComplete(result.csrfToken, result.recoveryCodes);
              })
            }
          >
            Create security key
          </button>
        </div>
      )}
      {operation.uncertain && (
        <button className="button secondary" onClick={onCheck}>
          Check session status
        </button>
      )}
      {(totp || key) && !operation.uncertain && (
        <button
          className="mfa-text-button"
          disabled={disabled}
          onClick={() => {
            setTotp(undefined);
            setKey(undefined);
            setAccepted(false);
          }}
        >
          Discard setup shown here
        </button>
      )}
      {(totp || key) && (
        <p className="mfa-hint">
          Discarding hides these details; it does not remove a pending factor or a key
          created on your device.
        </p>
      )}
    </>
  );
}
