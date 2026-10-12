"use client";
import { useEffect, useState } from "react";
import type { useSupportCreateWrite } from "@/lib/support/use-support-create-write";
import type { SupportKind } from "@/lib/api/support-schemas";
import { MutationReview, type MutationProposal } from "./mutation-review";
export function SupportCreationRecovery({
  guard,
  kind,
  disabled,
  onReviewChange,
  onRecovered,
}: {
  guard: ReturnType<typeof useSupportCreateWrite>;
  kind: SupportKind;
  disabled: boolean;
  onReviewChange: (open: boolean) => void;
  onRecovered: (id: string) => void;
}) {
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  useEffect(() => {
    onReviewChange(!!proposal);
    return () => onReviewChange(false);
  }, [proposal, onReviewChange]);
  function review() {
    const intent = guard.intent;
    if (!intent || guard.busy || guard.remaining > 0 || proposal) return;
    setProposal({
      title: `Send or recover this ${kind === "enquiries" ? "enquiry" : "complaint"}?`,
      description:
        "This uses your original message, related record and branch. If it was received, its saved result is returned. Otherwise it is submitted once. Current form edits will not replace the original request.",
      facts: [
        { label: "Subject", value: intent.body.subject },
        {
          label: "Message",
          value:
            intent.kind === "enquiries" ? intent.body.message : intent.body.description,
        },
      ],
      retryAfterRejection: false,
      submit: async () => {
        const saved = await guard.recover();
        onRecovered(saved.id);
      },
    });
  }
  return (
    <>
      {guard.pending && (
        <section className="cc-recovery" aria-label="Submission recovery">
          <h2>Submission needs checking</h2>
          <p>
            {guard.intent
              ? "Your submission has an unknown outcome. Review the original request to send or recover it within 24 hours. Nothing is resent automatically."
              : "This submission has an unknown outcome. Refresh your records and check all relevant pages before starting another request. It will not be resent automatically."}
          </p>
          <p>
            A record missing from the first page does not prove that your request was not
            received.
          </p>
          <div className="actions">
            {guard.intent && (
              <button
                className="button"
                disabled={guard.busy || !!proposal || guard.remaining > 0}
                onClick={review}
              >
                Review original support request
              </button>
            )}
            <a className="button secondary" href="#support-list-heading">
              View your records
            </a>
            {!guard.intent && (
              <button
                className="button secondary"
                disabled={!guard.canAcknowledge || disabled}
                onClick={guard.acknowledge}
              >
                I have checked my records
              </button>
            )}
          </div>
        </section>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel="Send or recover request"
          onClose={() => setProposal(null)}
          onSuccess={() => {}}
        />
      )}
    </>
  );
}
