"use client";
import { useEffect, useRef, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import { parseSupportRecord, type SupportRecord } from "@/lib/api/support-schemas";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";

export function ComplaintAcknowledgement({
  record,
  base,
  disabled,
  onSaved,
  onUncertain,
}: {
  record: SupportRecord;
  base: string;
  disabled: boolean;
  onSaved: () => void;
  onUncertain: () => void;
}) {
  const [message, setMessage] = useState("");
  const [validation, setValidation] = useState<string>();
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const pending = useRef<AbortController | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => () => pending.current?.abort(), []);
  if (record.kind !== "complaints" || record.acknowledgedAt !== null) return null;
  return (
    <section className="detail-section" aria-labelledby="complaint-acknowledgement-title">
      <h2 id="complaint-acknowledgement-title">Acknowledge this complaint</h2>
      <p>
        Record a customer-visible response in this conversation. Acknowledgement is
        separate from resolving the complaint.
      </p>
      <Feedback message={validation} />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (disabled || proposal) return;
          const response = message.trim();
          if (response.length < 10 || response.length > 2000) {
            setValidation("Enter an acknowledgement of 10–2,000 characters.");
            field.current?.focus();
            return;
          }
          setValidation(undefined);
          setProposal({
            title: "Acknowledge this complaint?",
            description:
              "This records the first acknowledgement and adds your response to the conversation. If another team member has already acknowledged it, the existing acknowledgement is retained and this response is not added. Review the saved messages afterward.",
            facts: [
              { label: "Complaint", value: record.subject },
              { label: "Customer-visible response", value: response },
              {
                label: "Resolution",
                value: "The complaint's status and resolution remain unchanged.",
              },
            ],
            retryAfterRejection: false,
            onUncertain,
            submit: async () => {
              const controller = new AbortController();
              pending.current = controller;
              try {
                let current: SupportRecord;
                try {
                  current = parseSupportRecord(
                    "complaints",
                    true,
                    (await apiRequest(base, { signal: controller.signal })).data,
                  );
                  if (
                    current.id !== record.id ||
                    current.kind !== "complaints" ||
                    current.acknowledgedAt === undefined
                  )
                    throw new Error("Unconfirmed complaint record");
                } catch {
                  throw new ApiError(409, {
                    error: { code: "PRECONDITION_UNAVAILABLE" },
                  });
                }
                if (current.acknowledgedAt) return;
                const body: RequestBody<
                  "/staff/support/complaints/{supportId}/acknowledge",
                  "post"
                > = { message: response };
                const saved = parseSupportRecord(
                  "complaints",
                  true,
                  (
                    await apiRequest(`${base}/acknowledge`, {
                      method: "POST",
                      csrf: true,
                      body,
                      signal: controller.signal,
                    })
                  ).data,
                );
                if (
                  saved.id !== record.id ||
                  saved.kind !== "complaints" ||
                  !saved.acknowledgedAt
                )
                  throw new Error("Unconfirmed complaint acknowledgement");
              } finally {
                pending.current = null;
              }
            },
          });
        }}
      >
        <fieldset disabled={disabled || !!proposal}>
          <div className="field">
            <label htmlFor="complaint-acknowledgement-message">
              Acknowledgement response
            </label>
            <textarea
              id="complaint-acknowledgement-message"
              ref={field}
              required
              maxLength={2000}
              rows={4}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              aria-describedby="complaint-acknowledgement-help"
            />
            <p id="complaint-acknowledgement-help">
              10–2,000 characters. Include only information suitable for the customer.
            </p>
          </div>
          <button className="button">Review acknowledgement</button>
        </fieldset>
      </form>
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel="Record acknowledgement"
          onClose={() => setProposal(null)}
          onSuccess={onSaved}
        />
      )}
    </section>
  );
}
