"use client";
import { useEffect, useState } from "react";
import type { useSupportWrite } from "@/lib/support/use-support-write";
import { MutationReview, type MutationProposal } from "./mutation-review";

export function SupportReplyRecovery({
  guard,
  unavailable,
  frozen,
  subject,
  onReviewChange,
  onRecovered,
}: {
  guard: ReturnType<typeof useSupportWrite>;
  unavailable: boolean;
  frozen: boolean;
  subject: string;
  onReviewChange: (open: boolean) => void;
  onRecovered: () => void;
}) {
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  useEffect(() => {
    let active = true;
    if (unavailable)
      queueMicrotask(() => {
        if (active) setProposal(null);
      });
    return () => {
      active = false;
    };
  }, [unavailable]);
  useEffect(() => {
    onReviewChange(!!proposal);
    return () => onReviewChange(false);
  }, [proposal, onReviewChange]);
  function review() {
    const intent = guard.intent;
    if (!intent || unavailable || frozen || guard.remaining > 0) return;
    setProposal({
      title: "Send or recover this reply?",
      description:
        "This uses your original message. If it was received, its saved result is returned. Otherwise it is sent once if the conversation still accepts replies. Current draft edits will not replace the original message.",
      facts: [
        { label: "Conversation", value: subject },
        { label: "Message", value: intent.body.message },
      ],
      retryAfterRejection: false,
      submit: async () => {
        await guard.recover();
        setProposal(null);
        onRecovered();
      },
    });
  }
  return (
    <>
      {guard.pending && (
        <section className="ct-recovery" aria-labelledby="ct-recovery-title">
          <h2 id="ct-recovery-title">Reply needs checking</h2>
          <p role="status">
            This reply has an unknown outcome.{" "}
            {guard.intent
              ? "Review the original reply to send or recover it within 24 hours."
              : "Refresh messages and check all relevant pages before composing another reply."}{" "}
            Nothing is resent automatically.
          </p>
          <p>
            Replies are shown oldest first. Absence from the first page does not prove
            that your reply failed.
          </p>
          {guard.intent ? (
            <button
              className="button"
              disabled={unavailable || frozen || guard.remaining > 0}
              onClick={review}
            >
              Review original reply
            </button>
          ) : (
            <button
              className="button secondary"
              disabled={!guard.canAcknowledge || frozen}
              onClick={guard.acknowledge}
            >
              I have checked the conversation
            </button>
          )}
        </section>
      )}
      {proposal && !unavailable && (
        <MutationReview
          proposal={proposal}
          confirmLabel="Send or recover reply"
          onClose={() => setProposal(null)}
          onSuccess={() => {}}
        />
      )}
    </>
  );
}
