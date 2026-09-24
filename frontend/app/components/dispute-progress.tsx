"use client";
import { useState } from "react";
import { disputeProposal, type DisputeWork } from "@/lib/api/dispute-workflow";
import { lagosDateTime } from "@/lib/forms/vehicle-condition";
import { formatBusinessDate } from "@/lib/format/date";
import { Feedback } from "./feedback";
import type { MutationProposal } from "./mutation-review";
export function DisputeProgress({
  record,
  actorId,
  disabled,
  onReview,
}: {
  record: DisputeWork;
  actorId: string;
  disabled: boolean;
  onReview: (proposal: MutationProposal) => void;
}) {
  const [error, setError] = useState<string>();
  const prefix = `dispute-${record.id}`;
  return (
    <section className="detail-section aftercare-record">
      <h3>Acknowledgement and provider submission</h3>
      <Feedback message={error} />
      {!record.acknowledgedAt && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (disabled) return;
            const note = String(
              new FormData(event.currentTarget).get("note") ?? "",
            ).trim();
            if (note.length < 10 || note.length > 2000) {
              setError("Explain the acknowledgement in 10-2,000 characters.");
              return;
            }
            setError(undefined);
            onReview(
              disputeProposal(
                record,
                { action: "acknowledge", body: { note } },
                {
                  title: "Acknowledge this dispute?",
                  description:
                    "This records that an authorized operator has seen the dispute. It does not submit evidence, extend a deadline or resolve the dispute.",
                  facts: [{ label: "Acknowledgement note", value: note }],
                },
                (saved) =>
                  !!saved.acknowledgedAt && saved.acknowledgedByUserId === actorId,
              ),
            );
          }}
        >
          <fieldset disabled={disabled}>
            <legend>Acknowledge receipt</legend>
            <div className="field">
              <label htmlFor={`${prefix}-ack`}>Acknowledgement note</label>
              <textarea
                id={`${prefix}-ack`}
                name="note"
                required
                minLength={10}
                maxLength={2000}
              />
            </div>
            <button className="button secondary">Review acknowledgement</button>
          </fieldset>
        </form>
      )}
      {!record.respondedAt &&
        (record.hasEvidence ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (disabled) return;
              const form = new FormData(event.currentTarget),
                local = String(form.get("at") ?? ""),
                note = String(form.get("note") ?? "").trim(),
                reference = String(form.get("reference") ?? "").trim(),
                at = Date.parse(`${local}:00+01:00`);
              if (
                !lagosDateTime.safeParse(local).success ||
                at > Date.now() ||
                at < Date.parse(record.openedAt)
              ) {
                setError(
                  "Enter the actual submission time in Lagos, after the dispute opened and not in the future.",
                );
                document.getElementById(`${prefix}-at`)?.focus();
                return;
              }
              if (
                note.length < 10 ||
                note.length > 2000 ||
                reference.length < 3 ||
                reference.length > 200
              ) {
                setError(
                  "Check the provider receipt reference and explain the submission in 10-2,000 characters.",
                );
                return;
              }
              const submittedAt = new Date(at).toISOString();
              setError(undefined);
              onReview(
                disputeProposal(
                  record,
                  {
                    action: "submission",
                    body: { note, providerSubmissionReference: reference, submittedAt },
                  },
                  {
                    title: "Record this provider submission?",
                    description:
                      "Record the receipt for evidence already submitted through the payment provider's dashboard. This application does not submit evidence to the provider or confirm its acceptance, recover funds or resolve the dispute.",
                    facts: [
                      { label: "Provider receipt", value: reference },
                      { label: "Submitted", value: formatBusinessDate(submittedAt) },
                      { label: "Submission note", value: note },
                    ],
                  },
                  (saved) =>
                    saved.providerSubmissionReference === reference &&
                    Date.parse(saved.respondedAt ?? "") === at,
                ),
              );
            }}
          >
            <fieldset disabled={disabled}>
              <legend>Submission already made to the provider</legend>
              <div className="field">
                <label htmlFor={`${prefix}-reference`}>
                  Provider submission reference
                </label>
                <input
                  className="input"
                  id={`${prefix}-reference`}
                  name="reference"
                  required
                  minLength={3}
                  maxLength={200}
                />
              </div>
              <div className="field">
                <label htmlFor={`${prefix}-at`}>Submission time (Lagos time)</label>
                <input
                  className="input"
                  id={`${prefix}-at`}
                  name="at"
                  type="datetime-local"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor={`${prefix}-submission-note`}>Submission note</label>
                <textarea
                  id={`${prefix}-submission-note`}
                  name="note"
                  required
                  minLength={10}
                  maxLength={2000}
                />
              </div>
              <button className="button secondary">Review provider receipt</button>
            </fieldset>
          </form>
        ) : (
          <p>
            Record the complete evidence bundle before recording a provider submission
            receipt.
          </p>
        ))}
    </section>
  );
}
