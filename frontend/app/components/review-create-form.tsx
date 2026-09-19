"use client";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError, apiRequest } from "@/lib/api/client";
import {
  reviewFormSchema,
  reviewLabels,
  reviewSchema,
  reviewSources,
  reviewTargets,
  type ReviewFormValues,
  type ReviewSource,
  type ReviewTarget,
} from "@/lib/api/review-schemas";
import { Feedback } from "./feedback";
import { ReviewSourcePicker } from "./review-source-picker";
import { MutationReview, type MutationProposal } from "./mutation-review";
const defaults: ReviewFormValues = { rating: "", title: "", comment: "" };
export function ReviewCreateForm({ onSaved }: { onSaved: () => void }) {
  const [target, setTarget] = useState<ReviewTarget>("BUSINESS");
  const [source, setSource] = useState<ReviewSource>();
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: defaults,
  });
  function review(values: ReviewFormValues) {
    if (uncertain || proposal) return;
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
      onUncertain: () => setUncertain(true),
      retryAfterRejection: false,
      submit: async () => {
        const controller = new AbortController();
        pending.current = controller;
        try {
          if (target !== "BUSINESS" && source) {
            let choices: ReviewSource[];
            try {
              const fresh = await apiRequest(source.path, { signal: controller.signal });
              choices = reviewSources(target, { items: [fresh.data] }).items;
            } catch {
              throw new ApiError(409, { error: { code: "PRECONDITION_UNAVAILABLE" } });
            }
            const matches = choices.some(
              (item) =>
                item.id === source.id &&
                JSON.stringify(item.fields) === JSON.stringify(source.fields),
            );
            if (!matches) throw new ApiError(409, { error: { code: "CONFLICT" } });
          }
          const response = await apiRequest("/customers/support/reviews", {
            method: "POST",
            csrf: true,
            body,
            signal: controller.signal,
          });
          const saved = reviewSchema.parse(response.data);
          if (
            saved.targetType !== target ||
            saved.rating !== body.rating ||
            saved.comment !== body.comment ||
            saved.title !== (body.title ?? null) ||
            (source &&
              Object.entries(source.fields).some(
                ([key, value]) =>
                  !Object.entries(saved).some(
                    ([savedKey, savedValue]) => key === savedKey && value === savedValue,
                  ),
              ))
          )
            throw new Error("Unconfirmed review");
          form.reset(defaults);
          setSource(undefined);
          setTarget("BUSINESS");
          setMessage(
            "Review received. Check Your submissions for its moderation status.",
          );
          onSaved();
        } finally {
          pending.current = null;
        }
      },
    });
  }
  return (
    <section className="detail-section" aria-labelledby="write-review-title">
      <h2 id="write-review-title">Write a review</h2>
      <p>
        Share your experience with a 1–5 rating. Reviews are moderated before public
        display.
      </p>
      <Feedback message={error} />
      <Feedback message={message} tone="success" />
      {uncertain && (
        <p role="status" className="notice">
          Your submission has an unknown outcome. Check Your submissions before starting
          another review. This form will not resend it.
        </p>
      )}
      <form noValidate onSubmit={form.handleSubmit(review)}>
        <fieldset disabled={uncertain}>
          <div className="field">
            <label htmlFor="review-target">Review type</label>
            <select
              id="review-target"
              value={target}
              onChange={(event) => {
                const selected = reviewTargets.find(
                  (value) => value === event.target.value,
                );
                if (selected) {
                  setTarget(selected);
                  setSource(undefined);
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
          {target !== "BUSINESS" && (
            <ReviewSourcePicker
              key={target}
              target={target}
              value={source}
              onChange={setSource}
              disabled={uncertain || !!proposal}
            />
          )}
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
              aria-describedby="review-comment-error"
            />
            <p id="review-comment-error" className="field-error">
              {form.formState.errors.comment?.message}
            </p>
          </div>
          <button className="button" type="submit">
            Review submission
          </button>
        </fieldset>
      </form>
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => setProposal(null)}
          onSuccess={() => {}}
          confirmLabel="Submit for moderation"
        />
      )}
    </section>
  );
}
