"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ShieldCheck, LoaderCircle, ArrowRight } from "lucide-react";
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
import { AuthenticatorReplacement } from "./authenticator-replacement";
const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
export function MfaForm({
  enroll = false,
  replace = false,
}: {
  enroll?: boolean;
  replace?: boolean;
}) {
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  const router = useRouter();
  const [session, setSession] = useState<MfaSession>();
  const [error, setError] = useState<string>();
  const [revision, setRevision] = useState(0);
  const [setup, setSetup] = useState(false);
  const [replacement, setReplacement] = useState(replace);
  const [challengeRequired, setChallengeRequired] = useState(false);
  const [complete, setComplete] = useState(false);
  const [codes, setCodes] = useState<string[]>();
  const [checking, setChecking] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (complete && !codes) heading.current?.focus();
  }, [complete, codes]);
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
      setReplacement(false);
      setChallengeRequired(false);
      setChecking(false);
      checkBusy.current = false;
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
    function restored(e: PageTransitionEvent) {
      if (e.persisted) discard();
    }
    window.addEventListener("pageshow", restored);
    window.addEventListener(SESSION_CHANGED, discard);
    return () => {
      controller.abort();
      pending.current?.abort();
      channel?.close();
      window.removeEventListener("pageshow", restored);
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
    if (replacement && !newCodes) {
      setSetup(true);
      setComplete(false);
      return;
    }
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
      if (pending.current === controller) {
        checkBusy.current = false;
        if (!controller.signal.aborted) setChecking(false);
      }
    }
  }
  const verified =
    session && !challengeRequired && (!session.mfaRequired || !!session.mfaVerifiedAt);
  return (
    <div className="login-form mfa-form">
      {complete && !codes && (
        <ShieldCheck className="mfa-complete-icon" size={36} aria-hidden="true" />
      )}
      {!codes && (
        <h1 ref={heading} tabIndex={-1}>
          {complete
            ? "Verification complete"
            : session && ((verified && (enroll || replacement)) || setup)
              ? replacement
                ? "Replace authenticator"
                : "Set up MFA"
              : "Verify it's you"}
          <span>.</span>
        </h1>
      )}
      <noscript hidden={ready}>
        <p>
          Enable JavaScript to verify your sign-in. You can still open our Help Centre.
        </p>
      </noscript>
      <Feedback message={error} />
      {!ready ? null : !session ? (
        <>
          <p className="mfa-loading" role="status">
            {!error && (
              <LoaderCircle className="login-spinner" size={18} aria-hidden="true" />
            )}
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
          {!codes && (
            <Feedback
              tone="success"
              message={
                replacement
                  ? "Authenticator replaced. Your previous registration can no longer verify sign-ins."
                  : "MFA verification confirmed."
              }
            />
          )}
          {codes ? (
            <RecoveryCodes
              headingLevel="h1"
              codes={codes}
              onDismiss={() => setCodes(undefined)}
            />
          ) : (
            <button
              className="button login-submit"
              disabled={checking}
              onClick={() => void checkAndContinue()}
            >
              {checking ? "Checking session..." : "Continue to account security"}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          )}
        </>
      ) : (verified && (enroll || replacement)) || setup ? (
        replacement ? (
          <AuthenticatorReplacement
            onComplete={finished}
            onCheck={() => void checkAndContinue()}
            onReverify={() => {
              setSetup(false);
              setChallengeRequired(true);
            }}
            onCancel={() => {
              setSetup(false);
              setReplacement(false);
              setSession(undefined);
              setRevision((value) => value + 1);
            }}
          />
        ) : (
          <MfaEnrollment
            onComplete={finished}
            onCheck={() => void checkAndContinue()}
            onReverify={() => {
              setSetup(false);
              setChallengeRequired(true);
            }}
          />
        )
      ) : verified ? (
        <>
          <p>Your current session has already passed its required security checks.</p>
          <button
            className="button login-submit"
            disabled={checking}
            onClick={() => void checkAndContinue()}
          >
            Continue to account security
          </button>
        </>
      ) : (
        <MfaChallenge
          replacement={replacement}
          onReplaceAuthenticator={() => setReplacement(true)}
          onComplete={finished}
          onSetup={() => setSetup(true)}
          onCheck={() => void checkAndContinue()}
        />
      )}
      <p className="mfa-sign-in">
        <Link href="/login" className="text-link">
          Sign in with another session
        </Link>
      </p>
      <div className="login-help">
        <Link href="/help/account-security">Need help with your account?</Link>
      </div>
    </div>
  );
}
