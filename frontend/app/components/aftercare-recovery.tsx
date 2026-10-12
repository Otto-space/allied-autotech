"use client";
import { useEffect, useState } from "react";
import type { useAftercareWrite } from "@/lib/orders/use-aftercare-write";
import {
  aftercareKinds,
  type Aftercare,
  type AftercareOrder,
} from "@/lib/api/aftercare-schemas";
import { MutationReview, type MutationProposal } from "./mutation-review";

export function AftercareRecovery({
  guard,
  unavailable,
  frozen,
  order,
  onRecovered,
}: {
  guard: ReturnType<typeof useAftercareWrite>;
  unavailable: boolean;
  frozen: boolean;
  order: AftercareOrder;
  onRecovered: (saved: Aftercare) => void;
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
  function review() {
    const intent = guard.intent;
    if (!intent || unavailable || frozen || guard.remaining > 0) return;
    setProposal({
      title: "Send or recover this order request?",
      description:
        "This uses the original products and explanation. If received, the request is returned with its current review status, including rejection. Otherwise it is submitted for staff review. It does not change stock, cancel an order or confirm a refund.",
      facts: [
        { label: "Order", value: order.orderNumber },
        {
          label: "Request",
          value: aftercareKinds["kind" in intent.body ? intent.body.kind : "RETURN"],
        },
        ...("items" in intent.body
          ? intent.body.items
          : order.items.map((i) => ({ orderItemId: i.id, quantity: i.quantity }))
        ).map((i, index) => ({
          label: `Product ${index + 1}`,
          value: `${order.items.find((o) => o.id === i.orderItemId)?.productName ?? "Order product"}, quantity ${i.quantity}`,
        })),
        { label: "Explanation", value: intent.body.reason },
      ],
      retryAfterRejection: false,
      submit: async () => {
        const saved = await guard.recover();
        setProposal(null);
        onRecovered(saved);
      },
    });
  }
  return (
    <>
      {guard.pending && (
        <section className="ca-recovery" aria-labelledby="ca-recovery-title">
          <h2 id="ca-recovery-title">Check before sending again</h2>
          <p role="status">
            This order request has an unknown outcome.{" "}
            {guard.intent
              ? "Review the original request to send or recover it within 24 hours."
              : "Refresh the order and check saved requests. If you cannot find the result, contact customer care before sending again."}{" "}
            Nothing is resent automatically.
          </p>
          <p>
            History shows the latest 100 requests. Absence from this list does not prove
            that the original request failed.
          </p>
          {guard.intent ? (
            <button
              className="button"
              disabled={unavailable || frozen || guard.remaining > 0}
              onClick={review}
            >
              Review original request
            </button>
          ) : (
            <button
              className="button secondary"
              disabled={!guard.canAcknowledge || frozen}
              onClick={guard.acknowledge}
            >
              I have checked the saved requests
            </button>
          )}
        </section>
      )}
      {proposal && !unavailable && (
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
