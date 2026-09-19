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
  const disabled = operation.busy || operation.uncertain || operation.requiresMfa;
  return (
    <>
      <h2>Add an MFA factor</h2>
      <p>
        Use an authenticator app or a security key supported by your browser. Completing
        setup replaces every previous recovery code and renews this session. Save the new
        codes before leaving.
      </p>
      <label className="check-field">
        <input
          type="checkbox"
          checked={accepted}
          disabled={disabled || !!totp || !!key}
          onChange={(event) => setAccepted(event.target.checked)}
        />{" "}
        I understand that completing setup replaces my recovery codes.
      </label>
      <Feedback message={operation.error} />
      {operation.requiresMfa && (
        <button className="button" onClick={onReverify}>
          Verify existing MFA
        </button>
      )}
      {operation.busy && <p role="status">Preparing or verifying your MFA factor...</p>}
      {!totp && !key && (
        <>
          <p>
            Starting authenticator setup replaces any unfinished authenticator-app setup
            for this account.
          </p>
          <button
            className="button"
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
        <section className="detail-section">
          <h3>Enter this setup key in your authenticator app</h3>
          <p>
            Choose a time-based code for Allied AutoTech. Keep the setup key private. It
            is shown only during this setup.
          </p>
          <div className="field">
            <label htmlFor="totp-secret">Authenticator setup key</label>
            <textarea
              id="totp-secret"
              readOnly
              rows={2}
              value={totp.secret}
              autoComplete="off"
              spellCheck={false}
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
            className="button"
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
          className="button secondary"
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
      <p className="muted">
        Discarding this view hides the setup details. It does not remove a pending factor
        or a credential already created on your device.
      </p>
    </>
  );
}
