"use client";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
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
export function SupportReplyForm({
  record,
  staff,
  base,
  disabled,
  onSaved,
}: {
  record: SupportRecord;
  staff: boolean;
  base: string;
  disabled: boolean;
  onSaved: () => void;
}) {
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState<string>();
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const form = useForm<z.infer<typeof supportReplySchema>>({
    resolver: zodResolver(supportReplySchema),
    defaultValues: { message: "", visibility: "CUSTOMER" },
  });
  return (
    <section className="detail-section" aria-labelledby="support-reply-title">
      <h2 id="support-reply-title">
        {staff ? "Reply or add a note" : "Reply to the team"}
      </h2>
      <Feedback message={message} tone="success" />
      {uncertain && (
        <p className="notice" role="status">
          This reply has an unknown outcome. Check the messages before composing another
          reply. This request will not be resent here.
        </p>
      )}
      {record.status === "CLOSED" ? (
        <p>This record is closed and cannot receive further messages.</p>
      ) : (
        <form
          noValidate
          onSubmit={form.handleSubmit((values) => {
            if (disabled || uncertain || proposal) return;
            const visibility = staff ? values.visibility : "CUSTOMER";
            setMessage(undefined);
            setProposal({
              title:
                visibility === "INTERNAL" ? "Save an internal note?" : "Send this reply?",
              description:
                visibility === "INTERNAL"
                  ? "Only authorized staff can read this note. It is not shown in the customer's conversation."
                  : "This message is customer-visible. It may trigger an account notification and optional email delivery. Avoid passwords, card details and private documents.",
              facts: [
                { label: "Conversation", value: record.subject },
                {
                  label: "Visibility",
                  value: visibility === "INTERNAL" ? "Staff only" : "Customer-visible",
                },
                { label: "Message", value: values.message },
              ],
              onUncertain: () => setUncertain(true),
              retryAfterRejection: false,
              submit: async () => {
                const controller = new AbortController();
                pending.current = controller;
                try {
                  let current: SupportRecord;
                  try {
                    const response = await apiRequest(base, {
                      signal: controller.signal,
                    });
                    current = parseSupportRecord(record.kind, staff, response.data);
                  } catch {
                    throw new ApiError(409, {
                      error: { code: "PRECONDITION_UNAVAILABLE" },
                    });
                  }
                  if (current.id !== record.id || current.status === "CLOSED")
                    throw new ApiError(409, { error: { code: "CONFLICT" } });
                  const response = await apiRequest(`${base}/messages`, {
                    method: "POST",
                    csrf: true,
                    body: { message: values.message, ...(staff ? { visibility } : {}) },
                    signal: controller.signal,
                  });
                  const saved = supportMessageSchema.parse(response.data);
                  if (
                    saved.body !== values.message ||
                    saved.visibility !== visibility ||
                    saved.authorType !== (staff ? "STAFF" : "CUSTOMER")
                  )
                    throw new Error("Unconfirmed reply");
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
          })}
        >
          <fieldset disabled={disabled || uncertain}>
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
                aria-describedby="support-reply-error"
              />
              <p id="support-reply-error" className="field-error">
                {form.formState.errors.message?.message}
              </p>
            </div>
            <button type="submit" className="button">
              Review reply
            </button>
          </fieldset>
        </form>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => setProposal(null)}
          onSuccess={() => {}}
        />
      )}
    </section>
  );
}
