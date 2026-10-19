"use client";
import { useEffect, useRef, useState } from "react";
import { forgetModerationForm } from "@/lib/admin/work-review-moderation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import {
  moderationFormSchema,
  reviewSchema,
  type ReviewRecord,
  reviewLabels,
} from "@/lib/api/review-schemas";
import { MutationReview, type MutationProposal } from "./mutation-review";
export function ReviewModerationForm({
  review,
  disabled,
  onSaved,
  onUncertain,
  onReview,
}: {
  review: ReviewRecord;
  disabled: boolean;
  onSaved: () => void;
  onUncertain: () => void;
  onReview?: (proposal: MutationProposal) => void;
}) {
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const pending = useRef<AbortController | null>(null);
  const fields = useRef<HTMLFormElement>(null);
  const [version, setVersion] = useState(review.version);
  const changed = version !== review.version;
  useEffect(() => () => pending.current?.abort(), []);
  const form = useForm<z.infer<typeof moderationFormSchema>>({
    resolver: zodResolver(moderationFormSchema),
    defaultValues: { decision: "APPROVED", note: "" },
  });
  function reviewDecision(values: z.infer<typeof moderationFormSchema>) {
    if (disabled || proposal || changed) return;
    const body = {
      expectedVersion: version,
      decision: values.decision,
      ...(values.note ? { note: values.note } : {}),
    };
    let savedVersion: number | undefined;
    (onReview ?? setProposal)({
      moderationChange: { review, body },
      onConfirmed: () => {
        if (onReview && savedVersion !== undefined) {
          if (fields.current) forgetModerationForm(fields.current, review.id);
          form.reset({ decision: "APPROVED", note: "" });
          setVersion(savedVersion);
        }
      },
      title: `${values.decision === "APPROVED" ? "Publish" : "Reject"} this review?`,
      description:
        "Approval allows this review to appear publicly. The customer can see the moderation note in their account; the note is not public review text. An in-app update is recorded, while optional email depends on preferences and delivery configuration. This decision cannot be changed through this screen.",
      facts: [
        { label: "Review reference", value: review.id },
        { label: "Review type", value: reviewLabels[review.targetType] },
        { label: "Rating", value: `${review.rating} out of 5` },
        { label: "Title", value: review.title || "No title recorded" },
        { label: "Customer feedback", value: review.comment },
        ...[
          { label: "Product reference", value: review.productId },
          { label: "Order item reference", value: review.orderItemId },
          { label: "Service reference", value: review.serviceId },
          { label: "Booking reference", value: review.bookingId },
          { label: "Order reference", value: review.orderId },
          { label: "Vehicle purchase reference", value: review.vehicleTransactionId },
        ].flatMap((f) => (f.value ? [{ label: f.label, value: f.value }] : [])),
        { label: "Current version", value: String(version) },
        { label: "Decision", value: values.decision.toLowerCase() },
        { label: "Customer-visible note", value: values.note || "No note" },
      ],
      retryAfterRejection: false,
      onUncertain,
      submit: async () => {
        const controller = new AbortController();
        pending.current = controller;
        try {
          const response = await apiRequest(
            `/staff/support/reviews/${review.id}/moderation`,
            {
              method: "POST",
              csrf: true,
              signal: controller.signal,
              body,
            },
          );
          const saved = reviewSchema.parse(response.data);
          if (
            saved.id !== review.id ||
            saved.status !== values.decision ||
            saved.version !== version + 1 ||
            saved.moderationNote !== (values.note || null)
          )
            throw new Error("Unconfirmed moderation");
          savedVersion = saved.version;
          return response;
        } finally {
          pending.current = null;
        }
      },
    });
  }
  return (
    <>
      {changed && (
        <div className="notice">
          <p>
            This review changed. Your moderation fields are kept; reload them before
            reviewing another decision.
          </p>
          <button
            className="button secondary"
            type="button"
            disabled={disabled}
            onClick={() => {
              if (fields.current) forgetModerationForm(fields.current, review.id);
              form.reset({ decision: "APPROVED", note: "" });
              setVersion(review.version);
            }}
          >
            Reload moderation fields
          </button>
        </div>
      )}
      <form
        ref={fields}
        data-draft-key={JSON.stringify(["review-moderation-form:1", review?.id])}
        className="wm-moderation-form"
        noValidate
        onSubmit={(event) => void form.handleSubmit(reviewDecision)(event)}
      >
        <fieldset disabled={disabled || changed}>
          <div className="field">
            <label htmlFor={`decision-${review.id}`}>Decision</label>
            <select id={`decision-${review.id}`} {...form.register("decision")}>
              <option value="APPROVED">Approve for public display</option>
              <option value="REJECTED">Reject</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor={`note-${review.id}`}>Customer-visible moderation note</label>
            <textarea
              id={`note-${review.id}`}
              maxLength={1000}
              {...form.register("note")}
              aria-invalid={!!form.formState.errors.note}
              aria-describedby={`note-error-${review.id}`}
            />
            <p>Required when rejecting a review. Avoid private internal information.</p>
            <p id={`note-error-${review.id}`} className="field-error">
              {form.formState.errors.note?.message}
            </p>
          </div>
          <button className="button" type="submit">
            Review moderation decision
          </button>
        </fieldset>
      </form>
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => setProposal(null)}
          onSuccess={onSaved}
        />
      )}
    </>
  );
}
