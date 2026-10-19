"use client";
import { useRef, useState } from "react";
import { forgetPrivacyForm } from "@/lib/admin/work-privacy";
import { apiRequest } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import {
  privacyRequestSchema,
  privacyReviewSchema,
  privacyKinds,
  privacyStatuses,
  reviewStatuses,
  type PrivacyRequest,
} from "@/lib/api/privacy-schemas";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { RetentionHolds } from "./retention-holds";
export function PrivacyRequestReview({
  record,
  disabled,
  onSaved,
  onUncertain,
  onReview,
  onDenied,
}: {
  record: PrivacyRequest;
  disabled: boolean;
  onSaved: () => void;
  onUncertain: () => void;
  onReview?: (proposal: MutationProposal) => void;
  onDenied?: () => void;
}) {
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [validation, setValidation] = useState<string>();
  const [reviewedAt, setReviewedAt] = useState(record.reviewedAt);
  const fields = useRef<HTMLFormElement>(null);
  const changed = reviewedAt !== record.reviewedAt;
  function review(form: FormData) {
    if (disabled || proposal || changed) return;
    setValidation(undefined);
    const parsed = privacyReviewSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) {
      setValidation(
        "Choose a review outcome and write a customer-visible response in 10–2,000 characters.",
      );
      document
        .getElementById(
          `${record.id}-${parsed.error.issues[0]?.path[0] === "status" ? "status" : "note"}`,
        )
        ?.focus();
      return;
    }
    const body: RequestBody<"/staff/privacy-requests/{id}/review", "post"> = {
      ...parsed.data,
      expectedReviewedAt: reviewedAt,
    };
    let savedAt: string | undefined;
    (onReview ?? setProposal)({
      privacyChange: { kind: "review", request: record, body },
      onConfirmed: () => {
        if (onReview && savedAt) {
          if (fields.current) {
            forgetPrivacyForm(fields.current);
            fields.current.reset();
          }
          setReviewedAt(savedAt);
        }
      },
      title: "Record this privacy review?",
      description:
        "The response is visible to the customer. Active holds or unresolved disputes prevent approval. Approval does not schedule deletion or anonymization. A newer review will require you to refresh before submitting.",
      facts: [
        { label: "Account", value: record.userId },
        { label: "Request", value: privacyKinds[record.kind] },
        { label: "Current status", value: privacyStatuses[record.status] },
        { label: "New status", value: privacyStatuses[body.status] },
        { label: "Customer-visible response", value: body.note },
      ],
      submit: async () => {
        const response = await apiRequest(`/staff/privacy-requests/${record.id}/review`, {
          method: "POST",
          csrf: true,
          body,
        });
        const saved = privacyRequestSchema.parse(response.data);
        if (
          saved.id !== record.id ||
          saved.userId !== record.userId ||
          saved.kind !== record.kind ||
          saved.status !== body.status ||
          saved.reviewNote !== body.note ||
          !saved.reviewedAt
        )
          throw new Error("Unexpected privacy review");
        savedAt = saved.reviewedAt;
        return response;
      },
      onUncertain,
      retryAfterRejection: false,
    });
  }
  return (
    <section className="detail-section" aria-label="Review selected privacy request">
      <div className="wpr-response">
        <h3>Customer response</h3>
        <Feedback message={validation} />
        {changed && (
          <div className="notice">
            <p>
              This request changed. Your response fields are kept; reload them before
              reviewing again.
            </p>
            <button
              className="button secondary"
              disabled={disabled}
              onClick={() => {
                if (fields.current) {
                  forgetPrivacyForm(fields.current);
                  fields.current.reset();
                }
                setReviewedAt(record.reviewedAt);
              }}
            >
              Reload response fields
            </button>
          </div>
        )}
        <form
          ref={fields}
          data-draft-key={JSON.stringify(["privacy-request-review:1", record?.id])}
          className="line-entry-form"
          onSubmit={(event) => {
            event.preventDefault();
            review(new FormData(event.currentTarget));
          }}
        >
          <fieldset disabled={disabled || changed}>
            <legend>Review outcome</legend>
            <div className="field">
              <label htmlFor={`${record.id}-status`}>New request status</label>
              <select id={`${record.id}-status`} name="status" required defaultValue="">
                <option value="">Choose the reviewed outcome</option>
                {reviewStatuses.map((status) => (
                  <option key={status} value={status}>
                    {privacyStatuses[status]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`${record.id}-note`}>
                Response visible to the customer
              </label>
              <textarea
                id={`${record.id}-note`}
                name="note"
                required
                minLength={10}
                maxLength={2000}
              />
            </div>
            <button className="button">Review response</button>
          </fieldset>
        </form>
      </div>
      <RetentionHolds
        userId={record.userId}
        disabled={disabled || !!proposal}
        onUncertain={onUncertain}
        onReview={onReview}
        onDenied={onDenied}
        privacyRequest={record}
      />
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel="Save privacy review"
          onClose={() => setProposal(null)}
          onSuccess={onSaved}
        />
      )}
    </section>
  );
}
