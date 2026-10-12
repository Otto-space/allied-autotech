"use client";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError, apiRequest } from "@/lib/api/client";
import {
  reviewFormSchema,
  reviewLabels,
  reviewSources,
  reviewTargets,
  type ReviewFormValues,
  type ReviewSource,
  type ReviewTarget,
} from "@/lib/api/review-schemas";
import type { useReviewWrite } from "@/lib/reviews/use-review-write";
import { draftIdentity, draftKey, forgetDraft, DRAFT_SAVED } from "@/lib/forms/drafts";
import { Feedback } from "./feedback";
import { ReviewSourcePicker } from "./review-source-picker";
import { MutationReview, type MutationProposal } from "./mutation-review";
const defaults: ReviewFormValues = { rating: "", title: "", comment: "" };
export function ReviewCreateForm({
  userId,
  guard,
  onSaved,
  onReviewChange,
}: {
  userId: string;
  guard: ReturnType<typeof useReviewWrite>;
  onSaved: () => void;
  onReviewChange: (open: boolean) => void;
}) {
  const [target, setTarget] = useState<ReviewTarget>("BUSINESS");
  const [source, setSource] = useState<ReviewSource>();
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [sourceUnavailable, setSourceUnavailable] = useState(true);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const sourceBlocked = target !== "BUSINESS" && sourceUnavailable;
  const latestSourceBlocked = useRef(sourceBlocked);
  useEffect(() => {
    latestSourceBlocked.current = sourceBlocked;
  }, [sourceBlocked]);
  const draftId = JSON.stringify(["review-create-form:2", userId]);
  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: defaults,
  });
  function review(values: ReviewFormValues) {
    if (guard.disabled || sourceBlocked || proposal) return;
    setMessage(undefined);
    setError(undefined);
    if (target !== "BUSINESS" && !source) {
      setError("Choose a completed record for this review.");
      document.getElementById("review-source")?.focus();
      return;
    }
    const body = {
      targetType: target,
      rating: Number(values.rating),
      ...(values.title ? { title: values.title } : {}),
      comment: values.comment,
      ...(target === "BUSINESS" ? {} : source?.fields),
    };
    onReviewChange(true);
    setProposal({
      title: "Submit this review for moderation?",
      description:
        "Approved reviews are public. Avoid personal contact details or private transaction information in your title and comment. Submitted reviews cannot be edited here.",
      facts: [
        { label: "Experience", value: source?.label ?? reviewLabels[target] },
        { label: "Rating", value: `${values.rating} / 5` },
        { label: "Title", value: values.title || "No title" },
        { label: "Review", value: values.comment },
      ],
      retryAfterRejection: false,
      submit: async () => {
        await guard.run(body, async (signal) => {
          if (latestSourceBlocked.current)
            throw new ApiError(409, { error: { code: "PRECONDITION_UNAVAILABLE" } });
          if (target !== "BUSINESS" && source) {
            let choices: ReviewSource[];
            try {
              const fresh = await apiRequest(source.path, { signal });
              choices = reviewSources(target, fresh.data).items;
            } catch (error) {
              if (error instanceof ApiError && error.status === 429) throw error;
              throw new ApiError(409, { error: { code: "PRECONDITION_UNAVAILABLE" } });
            }
            const matches = choices.some(
              (item) =>
                item.id === source.id &&
                JSON.stringify(item.fields) === JSON.stringify(source.fields),
            );
            if (!matches) throw new ApiError(409, { error: { code: "CONFLICT" } });
          }
          if (latestSourceBlocked.current)
            throw new ApiError(409, { error: { code: "PRECONDITION_UNAVAILABLE" } });
        });
        form.reset(defaults);
        const owner = draftIdentity();
        if (owner) {
          const key = draftKey(owner, window.location.pathname, draftId);
          forgetDraft(key);
          window.dispatchEvent(new CustomEvent(DRAFT_SAVED, { detail: key }));
        }
        setSource(undefined);
        setTarget("BUSINESS");
        setMessage("Review received. Check Your submissions for its moderation status.");
        onSaved();
      },
    });
  }
  return (
    <section className="cr-form" aria-labelledby="write-review-title">
      <h2 id="write-review-title">Write a review</h2>
      <p className="cr-form-intro">Moderated before public display.</p>
      <Feedback message={error} toast="Please review the message on this page." />
      <Feedback message={message} tone="success" toast="Review submitted." />
      {guard.remaining > 0 && (
        <p role="status">
          Please wait {guard.remaining} seconds before submitting another review.
        </p>
      )}
      <form data-draft-key={draftId} noValidate onSubmit={form.handleSubmit(review)}>
        <fieldset disabled={guard.disabled}>
          <legend className="sr-only">Your feedback</legend>
          <div className="cr-form-pair">
            <div className="field">
              <label htmlFor="review-target">Review type</label>
              <select
                id="review-target"
                name="targetType"
                data-draft-context
                value={target}
                onChange={(event) => {
                  const selected = reviewTargets.find(
                    (value) => value === event.target.value,
                  );
                  if (selected) {
                    setTarget(selected);
                    setSource(undefined);
                    setSourceUnavailable(true);
                    setError(undefined);
                  }
                }}
              >
                {reviewTargets.map((value) => (
                  <option key={value} value={value}>
                    {reviewLabels[value]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="review-rating">Rating</label>
              <select
                id="review-rating"
                {...form.register("rating")}
                aria-invalid={!!form.formState.errors.rating}
                aria-describedby="review-rating-error"
              >
                <option value="">Choose a rating</option>
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value} / 5 stars
                  </option>
                ))}
              </select>
              <p id="review-rating-error" className="field-error">
                {form.formState.errors.rating?.message}
              </p>
            </div>
          </div>
          {target !== "BUSINESS" && (
            <ReviewSourcePicker
              key={target}
              userId={userId}
              draftId={draftId}
              target={target}
              value={source}
              onChange={setSource}
              disabled={guard.disabled}
              onAvailabilityChange={setSourceUnavailable}
            />
          )}
          <div className="field">
            <label htmlFor="review-title">Title (optional)</label>
            <input
              id="review-title"
              maxLength={120}
              {...form.register("title")}
              aria-invalid={!!form.formState.errors.title}
              aria-describedby="review-title-error"
            />
            <p id="review-title-error" className="field-error">
              {form.formState.errors.title?.message}
            </p>
          </div>
          <div className="field">
            <label htmlFor="review-comment">Your review</label>
            <textarea
              id="review-comment"
              maxLength={2000}
              rows={5}
              {...form.register("comment")}
              aria-invalid={!!form.formState.errors.comment}
              aria-describedby="review-comment-help review-comment-error"
            />
            <p id="review-comment-help" className="cr-field-hint">
              Keep contact details and private transaction information out of your review.
              Up to 2,000 characters.
            </p>
            <p id="review-comment-error" className="field-error">
              {form.formState.errors.comment?.message}
            </p>
          </div>
          <div className="cr-form-footer">
            <button className="button" type="submit" disabled={sourceBlocked}>
              Review submission
            </button>
            <p>You can check everything before sending.</p>
          </div>
        </fieldset>
      </form>
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => {
            setProposal(null);
            onReviewChange(false);
          }}
          onSuccess={() => {}}
          confirmLabel="Submit for moderation"
        />
      )}
    </section>
  );
}
