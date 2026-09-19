"use client";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import {
  moderationFormSchema,
  reviewSchema,
  type ReviewRecord,
} from "@/lib/api/review-schemas";
import { MutationReview, type MutationProposal } from "./mutation-review";
export function ReviewModerationForm({
  review,
  disabled,
  onSaved,
  onUncertain,
}: {
  review: ReviewRecord;
  disabled: boolean;
  onSaved: () => void;
  onUncertain: () => void;
}) {
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const form = useForm<z.infer<typeof moderationFormSchema>>({
    resolver: zodResolver(moderationFormSchema),
    defaultValues: { decision: "APPROVED", note: "" },
  });
  return (
    <>
      <form
        noValidate
        onSubmit={form.handleSubmit((values) => {
          if (disabled || proposal) return;
          setProposal({
            title: `${values.decision === "APPROVED" ? "Publish" : "Reject"} this review?`,
            description:
              "Approval makes this review public. The customer can see the moderation note and receives an in-app update; optional email delivery depends on their preferences. This decision cannot be changed through this screen.",
            facts: [
              { label: "Review", value: review.title || review.comment },
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
                    body: {
                      expectedVersion: review.version,
                      decision: values.decision,
                      ...(values.note ? { note: values.note } : {}),
                    },
                  },
                );
                const saved = reviewSchema.parse(response.data);
                if (
                  saved.id !== review.id ||
                  saved.status !== values.decision ||
                  saved.version !== review.version + 1 ||
                  (values.note !== "" && saved.moderationNote !== values.note)
                )
                  throw new Error("Unconfirmed moderation");
              } finally {
                pending.current = null;
              }
            },
          });
        })}
      >
        <fieldset disabled={disabled}>
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
