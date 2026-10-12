"use client";
import { useState } from "react";
import type { usePreferenceWrite } from "@/lib/notifications/use-preference-write";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";

export function PreferenceRecovery({
  guard,
  onRecovered,
}: {
  guard: ReturnType<typeof usePreferenceWrite>;
  onRecovered: (superseded: boolean) => void;
}) {
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  function review() {
    const intent = guard.intent;
    if (!intent || guard.busy || proposal || guard.remaining) return;
    setProposal({
      title: "Send or recover this preference change?",
      description:
        "This uses the original change. If it was saved, its result is recovered without applying it again. A newer preference will be preserved. Nothing is sent automatically.",
      facts: [
        { label: "Category", value: intent.body.category.toLowerCase() },
        { label: "Channel", value: intent.body.channel },
        { label: "Original choice", value: intent.body.enabled ? "Enabled" : "Disabled" },
      ],
      retryAfterRejection: false,
      submit: async () => {
        const result = await guard.recover();
        onRecovered(result.preference.version > result.appliedVersion);
      },
    });
  }
  return (
    <>
      <Feedback message={guard.storageError} />
      {guard.remaining > 0 && (
        <p role="status">
          Please wait {guard.remaining} seconds before making another change.
        </p>
      )}
      {guard.pending && (
        <div className="cn-recovery" role="status">
          <strong>The preference change could not be confirmed.</strong>
          <p>
            {guard.intent
              ? "Review the original request to send or recover it within 24 hours. Later changes are preserved."
              : "Refresh preferences and check the current settings before making another change. The original request is unavailable or expired."}
          </p>
          {guard.intent ? (
            <button
              className="button secondary"
              disabled={guard.busy || !!proposal || guard.remaining > 0}
              onClick={review}
            >
              Review original preference change
            </button>
          ) : (
            <button
              className="button secondary"
              disabled={!guard.canAcknowledge}
              onClick={guard.acknowledge}
            >
              I&apos;ve checked preferences
            </button>
          )}
        </div>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel="Send or recover preference"
          onClose={() => setProposal(null)}
          onSuccess={() => {}}
        />
      )}
    </>
  );
}
