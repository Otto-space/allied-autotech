"use client";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  acceptInvitationSchema,
  type AcceptInvitationValues,
} from "@/lib/forms/staff-admin";
import {
  apiRequest,
  announceSessionChange,
  invalidateSession,
  isExternalSessionChange,
  SESSION_CHANGED,
} from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";

const defaults: AcceptInvitationValues = { token: "", currentPassword: "" };
const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
const parseSession = (value: unknown) =>
  z
    .object({
      user: z.object({ id: z.uuid(), email: z.email(), role: z.string() }),
      mfaRequired: z.boolean(),
      mfaVerifiedAt: z.string().nullable(),
    })
    .parse(value);
export function AcceptStaffInvitation() {
  const form = useForm<AcceptInvitationValues>({
    resolver: zodResolver(acceptInvitationSchema),
    defaultValues: defaults,
  });
  const session = useResource("/auth/session", parseSession);
  const initialized = useRef(false);
  const pending = useRef<AbortController | null>(null);
  const accepted = useRef(false);
  const [complete, setComplete] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string>();
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const { setValue, reset } = form;
  useClientLayoutEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    window.history.replaceState(window.history.state, "", window.location.pathname);
    if (token && token.length >= 32 && token.length <= 512) setValue("token", token);
  }, [setValue]);
  useEffect(() => {
    const discard = () => {
      pending.current?.abort();
      reset(defaults);
      setProposal(null);
      if (!accepted.current)
        setError(
          "Your session changed. Sign in to the intended staff account and reopen the invitation link.",
        );
    };
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
      pending.current?.abort();
      channel?.close();
      window.removeEventListener(SESSION_CHANGED, discard);
    };
  }, [reset]);
  const eligible =
    session.data?.user.role === "STAFF" &&
    session.data.mfaVerifiedAt !== null &&
    !session.error &&
    !session.loading;
  return (
    <>
      <span className="eyebrow">Team invitation</span>
      <h1>Review administrator access.</h1>
      <p className="muted">
        This invitation applies to an existing verified staff account. Opening the link
        does not change access.
      </p>
      {complete ? (
        <>
          <Feedback
            tone="success"
            message="Administrator access accepted. Your previous sessions were revoked. Sign in again to continue."
          />
          <Link className="button" href="/login">
            Sign in again
          </Link>
        </>
      ) : (
        <>
          <Feedback message={error} />
          {session.loading && <p role="status">Checking your signed-in account…</p>}
          {!eligible && !session.loading && (
            <p className="notice">
              Sign in as the invited staff member and complete MFA, then reopen the
              original invitation link.
            </p>
          )}
          {session.data && (
            <p>
              Signed in as {session.data.user.email} · {session.data.user.role}
            </p>
          )}
          {!eligible && (
            <div className="actions">
              <Link className="text-link" href="/login">
                Sign in
              </Link>
              {session.data && (
                <Link className="text-link" href="/mfa">
                  Complete MFA
                </Link>
              )}
              <button className="button secondary" onClick={session.refresh}>
                Check session again
              </button>
            </div>
          )}
          {uncertain && (
            <p className="notice" role="status">
              Acceptance could not be confirmed. Do not submit again. Sign in and check
              your role, or ask the administrator to check invitation status.
            </p>
          )}
          {eligible && (
            <form
              noValidate
              onSubmit={form.handleSubmit((value) => {
                if (proposal || uncertain) return;
                setProposal({
                  title: "Accept administrator access?",
                  description:
                    "This grants administrator access across branches and revokes your existing sessions. You will sign in again using your current credentials and MFA.",
                  facts: [
                    { label: "Signed-in account", value: session.data!.user.email },
                  ],
                  retryAfterRejection: false,
                  onUncertain: () => setUncertain(true),
                  submit: async () => {
                    const controller = new AbortController();
                    pending.current = controller;
                    try {
                      const result = await apiRequest("/auth/staff/invitations/accept", {
                        method: "POST",
                        body: value,
                        csrf: true,
                        signal: controller.signal,
                      });
                      z.object({
                        role: z.literal("ADMIN"),
                        signInRequired: z.literal(true),
                      }).parse(result.data);
                      if (controller.signal.aborted) throw new Error("Account changed");
                      accepted.current = true;
                      setComplete(true);
                      reset(defaults);
                      announceSessionChange();
                    } finally {
                      if (pending.current === controller) pending.current = null;
                      setValue("currentPassword", "");
                    }
                  },
                });
              })}
            >
              <fieldset disabled={!!proposal || uncertain}>
                <div className="field">
                  <label htmlFor="accept-token">Invitation token</label>
                  <input
                    id="accept-token"
                    type="password"
                    autoComplete="off"
                    {...form.register("token")}
                    aria-invalid={!!form.formState.errors.token}
                    aria-describedby="accept-token-error"
                  />
                  <p className="field-error" id="accept-token-error">
                    {form.formState.errors.token?.message}
                  </p>
                </div>
                <div className="field">
                  <label htmlFor="accept-password">Your current password</label>
                  <input
                    id="accept-password"
                    type="password"
                    autoComplete="current-password"
                    {...form.register("currentPassword")}
                    aria-invalid={!!form.formState.errors.currentPassword}
                    aria-describedby="accept-password-error"
                  />
                  <p className="field-error" id="accept-password-error">
                    {form.formState.errors.currentPassword?.message}
                  </p>
                </div>
                <button className="button">Review acceptance</button>
              </fieldset>
            </form>
          )}
          {proposal && (
            <MutationReview
              proposal={proposal}
              onClose={() => {
                setProposal(null);
                setValue("currentPassword", "");
              }}
              onSuccess={() => {}}
              confirmLabel="Accept administrator access"
            />
          )}
        </>
      )}
    </>
  );
}
