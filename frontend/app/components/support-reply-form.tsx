"use client";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ApiError, apiRequest } from "@/lib/api/client";
import {
  parseSupportRecord,
  supportMessageSchema,
  supportReplySchema,
  type SupportRecord,
} from "@/lib/api/support-schemas";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { Feedback } from "./feedback";
import { forgetThreadFormDraft } from "@/lib/admin/work-support-detail";
import { useSupportWrite } from "@/lib/support/use-support-write";
import {
  draftIdentity,
  draftKey,
  forgetDraft,
  readDraft,
  DRAFT_SAVED,
} from "@/lib/forms/drafts";
export function SupportReplyForm({
  record,
  staff,
  base,
  disabled,
  onSaved,
  onUncertain,
  guard,
  userId,
  onReviewChange,
  onReview,
}: {
  record: SupportRecord;
  staff: boolean;
  base: string;
  disabled: boolean;
  onSaved: () => void;
  onUncertain: () => void;
  guard?: ReturnType<typeof useSupportWrite>;
  userId?: string;
  onReviewChange?: (open: boolean) => void;
  onReview?: (proposal: MutationProposal) => void;
}) {
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState<string>();
  const pending = useRef<AbortController | null>(null);
  const formElement = useRef<HTMLFormElement>(null);
  const latestDisabled = useRef(disabled);
  useEffect(() => {
    latestDisabled.current = disabled;
  }, [disabled]);
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    onReviewChange?.(!!proposal);
    return () => onReviewChange?.(false);
  }, [proposal, onReviewChange]);
  const draftId = JSON.stringify(
    guard
      ? ["support-reply-form:2", userId, record.id, base]
      : ["support-reply-form:1", record.id, base],
  );
  const form = useForm<z.infer<typeof supportReplySchema>>({
    resolver: zodResolver(supportReplySchema),
    defaultValues: { message: "", visibility: "CUSTOMER" },
  });
  const messageText = useWatch({ control: form.control, name: "message" });
  const { getValues, setValue } = form;
  useEffect(() => {
    // The shared draft restorer waits for enabled controls. An uncertain reply
    // stays disabled, but its saved text must remain readable during recovery.
    if (!guard?.pending || getValues("message")) return;
    const owner = draftIdentity();
    if (!owner || owner !== `${userId}:CUSTOMER`) return;
    const saved = readDraft(draftKey(owner, window.location.pathname, draftId))[
      "message:0"
    ];
    if (typeof saved === "string" && saved.length <= 4000) setValue("message", saved);
  }, [guard?.pending, userId, draftId, getValues, setValue]);
  function review(values: z.infer<typeof supportReplySchema>) {
    if (disabled || guard?.disabled || (!guard && uncertain) || proposal) return;
    const visibility = staff ? values.visibility : "CUSTOMER";
    setMessage(undefined);
    (onReview ?? setProposal)({
      supportChange: staff
        ? { kind: "reply", body: { message: values.message, visibility } }
        : undefined,
      onConfirmed: () => {
        if (staff && onReview) {
          if (formElement.current) forgetThreadFormDraft(formElement.current);
          form.reset({ message: "", visibility: "CUSTOMER" });
          setMessage(
            visibility === "INTERNAL"
              ? "Internal note saved."
              : "Reply saved. Use Next to reach later messages.",
          );
        }
      },
      title: visibility === "INTERNAL" ? "Save an internal note?" : "Send this reply?",
      description:
        visibility === "INTERNAL"
          ? "Only authorized staff can read this note. It is not shown in the customer's conversation."
          : "This message is customer-visible. Guests receive the reply by email; linked customers receive an account notification and an email alert if enabled. Check Customer email delivery after saving. Avoid passwords, card details and private documents.",
      facts: [
        { label: "Conversation", value: record.subject },
        {
          label: "Visibility",
          value: visibility === "INTERNAL" ? "Staff only" : "Customer-visible",
        },
        { label: "Message", value: values.message },
      ],
      onUncertain: () => {
        if (!guard) setUncertain(true);
        onUncertain();
      },
      retryAfterRejection: false,
      submit: async () => {
        const controller = new AbortController();
        pending.current = controller;
        try {
          const prepare = async (signal: AbortSignal) => {
            if (guard && latestDisabled.current)
              throw new ApiError(409, { error: { code: "CONFLICT" } });
            let current: SupportRecord;
            try {
              const response = await apiRequest(base, {
                signal,
              });
              current = parseSupportRecord(record.kind, staff, response.data);
            } catch {
              throw new ApiError(409, {
                error: { code: "PRECONDITION_UNAVAILABLE" },
              });
            }
            if (current.id !== record.id || current.status === "CLOSED")
              throw new ApiError(409, { error: { code: "CONFLICT" } });
            if (guard && latestDisabled.current)
              throw new ApiError(409, { error: { code: "CONFLICT" } });
          };
          const write = async (signal: AbortSignal) => {
            const response = await apiRequest(`${base}/messages`, {
              method: "POST",
              csrf: true,
              body: { message: values.message, ...(staff ? { visibility } : {}) },
              signal,
            });
            const saved = supportMessageSchema.parse(response.data);
            if (
              saved.body !== values.message ||
              saved.visibility !== visibility ||
              saved.authorType !== (staff ? "STAFF" : "CUSTOMER")
            )
              throw new Error("Unconfirmed reply");
            return response;
          };
          if (staff && onReview) return await write(controller.signal);
          if (guard) await guard.run({ message: values.message }, prepare);
          else {
            await prepare(controller.signal);
            await write(controller.signal);
          }
          if (guard) {
            const owner = draftIdentity();
            if (owner) {
              const key = draftKey(owner, window.location.pathname, draftId);
              forgetDraft(key);
              window.dispatchEvent(new CustomEvent(DRAFT_SAVED, { detail: key }));
            }
          }
          form.reset({ message: "", visibility: "CUSTOMER" });
          setMessage(
            visibility === "INTERNAL"
              ? "Internal note saved."
              : "Reply saved. Messages are shown oldest first; use Next to reach later replies.",
          );
          onSaved();
        } finally {
          pending.current = null;
        }
      },
    });
  }
  return (
    <section
      className={guard ? "ct-reply ct-panel" : "detail-section"}
      aria-labelledby="support-reply-title"
    >
      <h2 id="support-reply-title">
        {staff ? "Reply or add a note" : "Reply to the team"}
      </h2>
      {guard && (
        <p className="ct-muted">
          Keep passwords, card details and private documents out of your message.
        </p>
      )}
      <Feedback message={message} tone="success" toast="Reply submitted." />
      {uncertain && !guard && (
        <p className="notice" role="status">
          This reply has an unknown outcome. Check the messages before composing another
          reply. This request will not be resent here.
        </p>
      )}
      {record.status === "CLOSED" ? (
        <p>This record is closed. The reply form is unavailable.</p>
      ) : (
        <form
          ref={formElement}
          data-draft-key={draftId}
          noValidate
          onSubmit={(event) => void form.handleSubmit(review)(event)}
        >
          <fieldset disabled={disabled || guard?.disabled || (!guard && uncertain)}>
            {staff && (
              <div className="field">
                <label htmlFor="support-reply-visibility">Message visibility</label>
                <select id="support-reply-visibility" {...form.register("visibility")}>
                  <option value="CUSTOMER">Customer-visible reply</option>
                  <option value="INTERNAL">Internal staff note</option>
                </select>
              </div>
            )}
            <div className="field">
              <label htmlFor="support-reply">Reply text</label>
              <textarea
                id="support-reply"
                rows={5}
                maxLength={4000}
                {...form.register("message")}
                aria-invalid={!!form.formState.errors.message}
                aria-describedby={
                  guard ? "support-reply-error support-reply-hint" : "support-reply-error"
                }
              />
              <p id="support-reply-error" className="field-error">
                {form.formState.errors.message?.message}
              </p>
            </div>
            {guard && (
              <p id="support-reply-hint" className="ct-character-hint">
                {messageText.length} / 4000 characters
              </p>
            )}
            <button type="submit" className="button">
              Review reply
            </button>
            {guard && <p className="ct-form-note">Review your message before sending.</p>}
          </fieldset>
        </form>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => setProposal(null)}
          onSuccess={() => {}}
          confirmLabel={guard ? "Send reply" : "Confirm change"}
        />
      )}
    </section>
  );
}
