"use client";
import { useRef, useState } from "react";
import { apiRequest } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import {
  privacyIntakeSchema,
  privacyKinds,
  privacyRequestSchema,
} from "@/lib/api/privacy-schemas";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
export function PrivacyRequestForm({
  userId,
  disabled,
  onSaved,
  onUncertain,
}: {
  userId: string;
  disabled: boolean;
  onSaved: () => void;
  onUncertain: () => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [validation, setValidation] = useState<string>();
  const [message, setMessage] = useState<string>();
  function review(values: FormData) {
    if (disabled || proposal) return;
    setMessage(undefined);
    setValidation(undefined);
    const parsed = privacyIntakeSchema.safeParse(Object.fromEntries(values));
    if (!parsed.success) {
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
    setProposal({
      title: "Send this privacy request?",
      description:
        "This sends your request for review. It does not delete your account or personal information. If you already have an open request of this type, the existing request will be returned and its original explanation kept.",
      facts: [
        { label: "Request", value: privacyKinds[body.kind] },
        { label: "Your explanation", value: body.reason },
      ],
      submit: async () => {
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
      },
      onUncertain,
      retryAfterRejection: false,
    });
  }
  return (
    <section className="detail-section" aria-labelledby="privacy-new-title">
      <h2 id="privacy-new-title">Request a review</h2>
      <Feedback message={validation} />
      <Feedback message={message} tone="success" toast="Privacy request recorded." />
      <form
        ref={form}
        className="line-entry-form"
        onSubmit={(event) => {
          event.preventDefault();
          review(new FormData(event.currentTarget));
        }}
      >
        <fieldset disabled={disabled}>
          <legend>Your request</legend>
          <div className="field">
            <label htmlFor="privacy-kind">Request type</label>
            <select id="privacy-kind" name="kind" required defaultValue="">
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
              aria-describedby="privacy-reason-help"
            />
            <span className="field-hint" id="privacy-reason-help">
              Describe the information concerned. Do not include passwords, card details
              or identity documents.
            </span>
          </div>
          <button className="button">Review privacy request</button>
        </fieldset>
      </form>
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel="Send privacy request"
          onClose={() => setProposal(null)}
          onSuccess={() => {
            form.current?.reset();
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
