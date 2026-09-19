"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  apiRequest,
  ApiError,
  announceSessionChange,
  invalidateSession,
  isExternalSessionChange,
  SESSION_CHANGED,
  setCsrfToken,
} from "@/lib/api/client";
import { mfaSessionSchema, type MfaSession } from "@/lib/api/mfa-schemas";
import { Feedback } from "./feedback";
import { MfaChallenge } from "./mfa-challenge";
import { MfaEnrollment } from "./mfa-enrollment";
import { RecoveryCodes } from "./recovery-codes";
export function MfaForm({ enroll = false }: { enroll?: boolean }) {
  const router = useRouter();
  const [session, setSession] = useState<MfaSession>();
  const [error, setError] = useState<string>();
  const [revision, setRevision] = useState(0);
  const [setup, setSetup] = useState(false);
  const [challengeRequired, setChallengeRequired] = useState(false);
  const [complete, setComplete] = useState(false);
  const [codes, setCodes] = useState<string[]>();
  const [checking, setChecking] = useState(false);
  const ownRotation = useRef(false);
  const pending = useRef<AbortController | null>(null);
  const checkBusy = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    pending.current = controller;
    void apiRequest<unknown>("/auth/session", { signal: controller.signal })
      .then((result) => {
        const data = mfaSessionSchema.parse(result.data);
        if (!controller.signal.aborted) {
          setSession(data);
          setError(undefined);
        }
      })
      .catch((value) => {
        if (!controller.signal.aborted)
          setError(
            value instanceof ApiError
              ? value.message
              : "We could not verify your session. Try checking again.",
          );
      });
    function discard() {
      if (ownRotation.current) return;
      controller.abort();
      pending.current?.abort();
      setSession(undefined);
      setCodes(undefined);
      setComplete(false);
      setSetup(false);
      setChallengeRequired(false);
      setChecking(false);
      setError("Your session changed. Sign in or check your session again.");
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
    return () => {
      controller.abort();
      pending.current?.abort();
      channel?.close();
      window.removeEventListener(SESSION_CHANGED, discard);
    };
  }, [revision]);
  function finished(token: string, newCodes?: string[]) {
    ownRotation.current = true;
    try {
      announceSessionChange();
      setCsrfToken(token);
    } finally {
      ownRotation.current = false;
    }
    setSetup(false);
    setChallengeRequired(false);
    setComplete(true);
    setCodes(newCodes);
  }
  async function checkAndContinue() {
    if (checkBusy.current) return;
    checkBusy.current = true;
    setChecking(true);
    setError(undefined);
    const controller = new AbortController();
    pending.current = controller;
    try {
      const fresh = mfaSessionSchema.parse(
        (await apiRequest<unknown>("/auth/session", { signal: controller.signal })).data,
      );
      if (controller.signal.aborted) return;
      if (fresh.mfaRequired && !fresh.mfaVerifiedAt) {
        setError(
          "MFA is still required. If the last result was unknown, sign in again and use an available factor. Do not resend the previous verification.",
        );
        return;
      }
      setCodes(undefined);
      router.replace(
        fresh.user.role === "CUSTOMER" ? "/dashboard/security" : "/admin/security",
      );
    } catch (value) {
      if (!controller.signal.aborted)
        setError(
          value instanceof ApiError
            ? value.message
            : "Session status could not be confirmed. Check again when connected.",
        );
    } finally {
      checkBusy.current = false;
      if (!controller.signal.aborted) setChecking(false);
    }
  }
  const verified =
    session && !challengeRequired && (!session.mfaRequired || !!session.mfaVerifiedAt);
  return (
    <>
      <span className="eyebrow">Account protection</span>
      <h1>{enroll ? "Set up MFA." : "Verify it's you."}</h1>
      <Feedback message={error} />
      {!session ? (
        <>
          <p role="status">
            {error
              ? "Your account has not been verified in this view."
              : "Checking your session..."}
          </p>
          {error && (
            <button
              className="button secondary"
              onClick={() => {
                setError(undefined);
                setRevision((value) => value + 1);
              }}
            >
              Check session again
            </button>
          )}
        </>
      ) : complete ? (
        <>
          <Feedback tone="success" message="MFA verification confirmed." />
          {codes ? (
            <RecoveryCodes codes={codes} onDismiss={() => setCodes(undefined)} />
          ) : (
            <button
              className="button"
              disabled={checking}
              onClick={() => void checkAndContinue()}
            >
              {checking ? "Checking session..." : "Continue to account security"}
            </button>
          )}
        </>
      ) : (verified && enroll) || setup ? (
        <MfaEnrollment
          onComplete={finished}
          onCheck={() => void checkAndContinue()}
          onReverify={() => {
            setSetup(false);
            setChallengeRequired(true);
          }}
        />
      ) : verified ? (
        <>
          <p>Your current session has already passed its required security checks.</p>
          <button
            className="button"
            disabled={checking}
            onClick={() => void checkAndContinue()}
          >
            Continue to account security
          </button>
        </>
      ) : (
        <MfaChallenge
          onComplete={finished}
          onSetup={() => setSetup(true)}
          onCheck={() => void checkAndContinue()}
        />
      )}
      <p className="auth-note">
        <Link href="/login" className="text-link">
          Sign in with another session
        </Link>
      </p>
    </>
  );
}
