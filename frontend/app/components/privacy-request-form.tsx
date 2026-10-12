"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { apiRequest, ApiError } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import {
  privacyIntakeSchema,
  privacyKinds,
  privacyRequestSchema,
} from "@/lib/api/privacy-schemas";
import { draftIdentity, draftKey, forgetDraft, DRAFT_SAVED } from "@/lib/forms/drafts";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
export function PrivacyRequestForm({
  userId,
  disabled,
  onSaved,
  onUncertain,
  onSend,
  onRejected,
  onReviewChange,
}: {
  userId: string;
  disabled: boolean;
  onSaved: () => void;
  onUncertain: () => void;
  onSend?: () => boolean;
  onRejected?: () => void;
  onReviewChange?: (open: boolean) => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [invalid, setInvalid] = useState<string>();
  const [validation, setValidation] = useState<string>();
  const [message, setMessage] = useState<string>();
  const latestDisabled = useRef(disabled);
  useEffect(() => {
    latestDisabled.current = disabled;
  }, [disabled]);
  const [retryAt, setRetryAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!retryAt) return;
    const tick = () =>
      setRemaining(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);
  function review(values: FormData) {
    if (disabled || proposal || Date.now() < retryAt) return;
    setMessage(undefined);
    setValidation(undefined);
    setInvalid(undefined);
    const parsed = privacyIntakeSchema.safeParse(Object.fromEntries(values));
    if (!parsed.success) {
      setInvalid(String(parsed.error.issues[0]?.path[0] ?? "reason"));
      setValidation(
        "Choose a request type and explain your request in 10–2,000 characters.",
      );
      document
        .getElementById(
          parsed.error.issues[0]?.path[0] === "kind" ? "privacy-kind" : "privacy-reason",
        )
        ?.focus();
      return;
    }
    const body: RequestBody<"/customers/privacy-requests", "post"> = parsed.data;
    onReviewChange?.(true);
    setProposal({
      title: "Send this privacy request?",
      description:
        "This sends your request for review. It does not delete your account or personal information. If you already have an open request of this type, the existing request will be returned and its original explanation kept.",
      facts: [
        { label: "Request", value: privacyKinds[body.kind] },
        { label: "Your explanation", value: body.reason },
      ],
      submit: async () => {
        let sent = false;
        try {
          if (latestDisabled.current || Date.now() < retryAt)
            throw new ApiError(409, { error: { code: "CONFLICT" } });
          const current = z
            .object({ user: z.object({ id: z.string(), role: z.string() }) })
            .parse((await apiRequest("/auth/session")).data);
          if (current.user.id !== userId || current.user.role !== "CUSTOMER")
            throw new ApiError(403, { error: { code: "FORBIDDEN" } });
          if (latestDisabled.current)
            throw new ApiError(409, { error: { code: "CONFLICT" } });
          if (onSend && !onSend()) {
            setValidation(
              "Your browser could not save the request recovery marker. Allow session storage and try again.",
            );
            throw new ApiError(409, { error: { code: "CONFLICT" } });
          }
          sent = true;
          const saved = privacyRequestSchema.parse(
            (
              await apiRequest("/customers/privacy-requests", {
                method: "POST",
                csrf: true,
                body,
              })
            ).data,
          );
          if (
            saved.userId !== userId ||
            saved.kind !== body.kind ||
            saved.status === "REJECTED"
          )
            throw new Error("Unexpected privacy request");
        } catch (error) {
          const rejected =
            error instanceof ApiError && error.status >= 400 && error.status < 500;
          if (!sent || rejected) onRejected?.();
          if (error instanceof ApiError && error.status === 429) {
            const seconds = error.retryAfterSeconds ?? 0;
            setRemaining(seconds);
            setRetryAt(Date.now() + seconds * 1000);
          }
          if (!sent && !rejected)
            throw new ApiError(409, { error: { code: "CONFLICT" } });
          throw error;
        }
      },
      onUncertain,
      retryAfterRejection: false,
    });
  }
  return (
    <section
      className="detail-section privacy-intake"
      aria-labelledby="privacy-new-title"
    >
      <h2 id="privacy-new-title">Request a review</h2>
      <p className="privacy-intake-intro">
        Tell us what information you would like reviewed.
      </p>
      <div id="privacy-validation">
        <Feedback message={validation} />
      </div>
      <Feedback message={message} tone="success" toast="Privacy request recorded." />
      {remaining > 0 && (
        <p role="status">
          Please wait {remaining} seconds before sending another request.
        </p>
      )}
      <form
        onInput={() => {
          setValidation(undefined);
          setInvalid(undefined);
        }}
        noValidate
        data-draft-key={JSON.stringify(["privacy-request-form:1", userId])}
        ref={form}
        className="line-entry-form"
        onSubmit={(event) => {
          event.preventDefault();
          review(new FormData(event.currentTarget));
        }}
      >
        <fieldset disabled={disabled || remaining > 0}>
          <legend>Your request</legend>
          <div className="field">
            <label htmlFor="privacy-kind">Request type</label>
            <select
              id="privacy-kind"
              name="kind"
              required
              defaultValue=""
              aria-invalid={invalid === "kind" || undefined}
              aria-describedby={invalid === "kind" ? "privacy-validation" : undefined}
            >
              <option value="">Choose a request</option>
              {Object.entries(privacyKinds).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="privacy-reason">Why are you making this request?</label>
            <textarea
              id="privacy-reason"
              name="reason"
              required
              minLength={10}
              maxLength={2000}
              aria-invalid={invalid === "reason" || undefined}
              aria-describedby={`privacy-reason-help${invalid === "reason" ? " privacy-validation" : ""}`}
            />
            <span className="field-hint" id="privacy-reason-help">
              10–2,000 characters. Do not include passwords, card details or identity
              documents.
            </span>
          </div>
          <button className="button">Review privacy request</button>
        </fieldset>
      </form>
      <p className="privacy-duplicate-note">
        An existing open request of the same type keeps its original explanation.
      </p>
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel="Send privacy request"
          onClose={() => {
            setProposal(null);
            onReviewChange?.(false);
          }}
          onSuccess={() => {
            form.current?.reset();
            const owner = draftIdentity();
            if (owner) {
              const key = draftKey(
                owner,
                window.location.pathname,
                JSON.stringify(["privacy-request-form:1", userId]),
              );
              forgetDraft(key);
              window.dispatchEvent(new CustomEvent(DRAFT_SAVED, { detail: key }));
            }
            setMessage(
              "Your privacy request is recorded. Review its current status and saved explanation below. No deletion has been scheduled.",
            );
            onSaved();
          }}
        />
      )}
    </section>
  );
}
