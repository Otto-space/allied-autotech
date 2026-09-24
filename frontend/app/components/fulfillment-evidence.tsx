"use client";
import { useRef, useState } from "react";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import type { AftercareOrder } from "@/lib/api/aftercare-schemas";
import { lagosDateTime } from "@/lib/forms/vehicle-condition";
import { formatBusinessDate } from "@/lib/format/date";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
export function FulfillmentEvidence({
  order,
  disabled,
  onSaved,
  onRefresh,
  onUncertain,
}: {
  order: AftercareOrder;
  disabled: boolean;
  onSaved: () => void;
  onRefresh: () => void;
  onUncertain: () => void;
}) {
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [validation, setValidation] = useState<string>();
  const attempted = useRef(false);
  function review(form: FormData, now: number) {
    if (disabled || proposal) return;
    setValidation(undefined);
    const value = String(form.get("at") ?? "");
    const timestamp = Date.parse(`${value}:00+01:00`);
    const reference = String(form.get("reference") ?? "").trim();
    if (
      !lagosDateTime.safeParse(value).success ||
      timestamp > now ||
      timestamp < Date.parse(order.createdAt)
    ) {
      setValidation(
        "Enter the actual delivery or collection time, after the order was created and not in the future.",
      );
      document.getElementById("fulfillment-at")?.focus();
      return;
    }
    if (reference.length < 5 || reference.length > 300) {
      setValidation("Provide the supporting evidence reference in 5–300 characters.");
      document.getElementById("fulfillment-reference")?.focus();
      return;
    }
    const body: RequestBody<"/staff/orders/{id}/fulfillment-evidence", "post"> = {
      at: new Date(timestamp).toISOString(),
      reference,
    };
    setProposal({
      title: "Record delivery or collection evidence?",
      description:
        "This records when fulfillment occurred and its supporting reference. The timestamp can only be recorded once. It does not change payment, stock or order status.",
      facts: [
        { label: "Order", value: order.orderNumber },
        {
          label: "Method",
          value: order.fulfillmentMethod === "COLLECTION" ? "Collection" : "Delivery",
        },
        { label: "Fulfilled", value: formatBusinessDate(body.at) },
        { label: "Evidence reference", value: reference },
      ],
      submit: async () => {
        attempted.current = true;
        const saved = z
          .object({
            id: z.uuid(),
            fulfillmentEvidenceAt: z.iso.datetime({ offset: true }),
            fulfillmentEvidenceReference: z.string(),
          })
          .parse(
            (
              await apiRequest(`/staff/orders/${order.id}/fulfillment-evidence`, {
                method: "POST",
                csrf: true,
                body,
              })
            ).data,
          );
        if (
          saved.id !== order.id ||
          Date.parse(saved.fulfillmentEvidenceAt) !== timestamp ||
          saved.fulfillmentEvidenceReference !== reference
        )
          throw new Error("Unexpected fulfillment evidence");
      },
      onUncertain,
      retryAfterRejection: false,
    });
  }
  return (
    <section className="detail-section aftercare-record">
      <h2>Delivery or collection evidence</h2>
      {order.fulfillmentEvidenceAt ? (
        <>
          <p>Recorded fulfillment: {formatBusinessDate(order.fulfillmentEvidenceAt)}</p>
          <p>
            Evidence reference: {order.fulfillmentEvidenceReference ?? "Not recorded"}
          </p>
          <p>The timestamp is already recorded and cannot be overwritten here.</p>
        </>
      ) : (
        <>
          <p>
            Use the actual event time and supporting evidence. Recording an order as
            completed does not supply this evidence.
          </p>
          <Feedback message={validation} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              review(new FormData(e.currentTarget), new Date().getTime());
            }}
          >
            <fieldset disabled={disabled}>
              <legend>Fulfillment evidence</legend>
              <div className="field">
                <label htmlFor="fulfillment-at">
                  Delivery or collection time (Lagos time)
                </label>
                <input
                  className="input"
                  id="fulfillment-at"
                  name="at"
                  type="datetime-local"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="fulfillment-reference">
                  Supporting evidence reference
                </label>
                <input
                  className="input"
                  id="fulfillment-reference"
                  name="reference"
                  required
                  minLength={5}
                  maxLength={300}
                />
              </div>
              <button className="button">Review fulfillment evidence</button>
            </fieldset>
          </form>
        </>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel="Record fulfillment evidence"
          onClose={() => {
            setProposal(null);
            if (attempted.current) onRefresh();
            attempted.current = false;
          }}
          onSuccess={onSaved}
        />
      )}
    </section>
  );
}
