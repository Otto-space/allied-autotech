"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { apiRequest, ApiError, SESSION_CHANGED } from "@/lib/api/client";
import {
  parseStaffOrderDetail,
  type StaffOrderRecord,
} from "@/lib/admin/work-order-detail";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import type { RequestBody } from "@/lib/api/contracts";
import {
  fitmentLabels,
  fitmentQualifierKeys,
  parseFitmentModel,
} from "@/lib/parts-fitment";
import { useResource } from "@/lib/api/use-resource";
import type { PurchaseSelection } from "@/lib/purchase/suitability";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import styles from "./purchase-suitability.module.css";
type ReviewBody = RequestBody<"/admin/orders/{orderId}/purchase-review/decision", "post">;

function RequestedVehicle({ selection }: { selection: PurchaseSelection }) {
  const model = useResource(
    `/public/fitment/models/${selection.vehicleModelId}`,
    parseFitmentModel,
  );
  return (
    <div>
      <p>
        {model.data
          ? `${model.data.make.name} ${model.data.name} · ${selection.year}`
          : `Vehicle year ${selection.year}`}
      </p>
      {model.loading && <p role="status">Loading selected vehicle…</p>}
      {(model.error || model.refreshError) && (
        <>
          <Feedback message="The selected vehicle name could not be checked. Review the evidence before deciding." />
          <button type="button" className="button secondary" onClick={model.refresh}>
            Retry vehicle details
          </button>
        </>
      )}
    </div>
  );
}

export function PurchaseReviewDecision({
  order,
  disabled,
  onSaved,
  onBusyChange,
}: {
  order: StaffOrderRecord;
  disabled: boolean;
  onSaved: (message?: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const id = useId(),
    review = order.purchaseReviews[0];
  const [supplier, setSupplier] = useState<Record<string, boolean>>({});
  const [decision, setDecision] = useState<ReviewBody["decision"]>("APPROVED");
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [error, setError] = useState<string>();
  const [changed, setChanged] = useState(false);
  const pending = useRef<AbortController | null>(null),
    active = useRef(true);
  const outcomeUncertain = useRef(false);
  useEffect(() => {
    active.current = true;
    const discard = () => {
      active.current = false;
      pending.current?.abort();
      setProposal(null);
      setChanged(true);
    };
    window.addEventListener(SESSION_CHANGED, discard);
    return () => {
      active.current = false;
      pending.current?.abort();
      window.removeEventListener(SESSION_CHANGED, discard);
    };
  }, []);
  if (order.paidAt || order.status !== "PENDING" || review?.status !== "REQUESTED")
    return null;
  if (changed)
    return (
      <Feedback message="Your account changed. Refresh before reviewing this order." />
    );
  function reviewDecision(form: FormData) {
    if (disabled || proposal || !review) return;
    setError(undefined);
    try {
      const reason = String(form.get("reason") ?? "").trim();
      if (
        reason.length < 10 ||
        reason.length > 2000 ||
        /[\u0000-\u001f\u007f]/.test(reason)
      )
        throw Error(
          "Enter a clear reason using one paragraph of 10 to 2,000 characters.",
        );
      const body: ReviewBody = {
        expectedVersion: order.version,
        expectedRevision: review.revision,
        decision,
        reason,
        availability:
          decision === "DECLINED"
            ? []
            : order.items.map((item) => ({
                orderItemId: item.id,
                evidence: supplier[item.id]
                  ? {
                      kind: "SUPPLIER",
                      sourceReference: String(form.get(`${item.id}-source`) ?? "").trim(),
                      availableUntil: new Date(
                        `${form.get(`${item.id}-until`)}:00+01:00`,
                      ).toISOString(),
                      expectedFrom: new Date(
                        `${form.get(`${item.id}-from`)}T08:00:00+01:00`,
                      ).toISOString(),
                      expectedTo: new Date(
                        `${form.get(`${item.id}-to`)}T18:00:00+01:00`,
                      ).toISOString(),
                    }
                  : { kind: "BRANCH_STOCK" },
              })),
      };
      outcomeUncertain.current = false;
      setProposal({
        title:
          decision === "APPROVED"
            ? "Confirm this purchase offer?"
            : "Decline this purchase offer?",
        description:
          decision === "APPROVED"
            ? "Checks current approved suitability evidence and reserves branch stock, or validates the supplier confirmation against an accepted quotation. This makes payment available; it does not take payment or mark parts ready."
            : "Payment will remain unavailable. Record why the offer cannot be confirmed and arrange the next step with the customer.",
        facts: [
          { label: "Order", value: order.orderNumber },
          { label: "Review", value: String(review.revision) },
          { label: "Total", value: formatKobo(order.totalKobo) },
          ...order.items.map((item, index) => ({
            label: `Part ${index + 1}: ${item.productName} · ${item.quantity}`,
            value:
              decision === "DECLINED"
                ? "Not offered"
                : supplier[item.id]
                  ? "Confirmed supplier supply"
                  : "Current branch stock",
          })),
          ...body.availability.flatMap((line, index) =>
            line.evidence.kind === "SUPPLIER"
              ? [
                  {
                    label: `Part ${index + 1}: supplier confirmation`,
                    value: line.evidence.sourceReference,
                  },
                  {
                    label: `Part ${index + 1}: confirmation valid until`,
                    value: formatBusinessDate(line.evidence.availableUntil),
                  },
                  {
                    label: `Part ${index + 1}: arrival estimate`,
                    value: `${formatBusinessDate(line.evidence.expectedFrom)} to ${formatBusinessDate(line.evidence.expectedTo)}`,
                  },
                ]
              : [],
          ),
          { label: "Reason", value: reason },
        ],
        retrySafely: true,
        onUncertain: () => {
          outcomeUncertain.current = true;
        },
        submit: async () => {
          const controller = new AbortController();
          pending.current = controller;
          const latest = parseStaffOrderDetail(
            (await apiRequest(`/staff/orders/${order.id}`, { signal: controller.signal }))
              .data,
          );
          const latestReview = latest.purchaseReviews[0];
          if (!active.current || controller.signal.aborted)
            throw Error("Account changed");
          if (latest.id !== order.id) throw Error("Unexpected order");
          if (
            latestReview?.revision === review.revision &&
            latestReview.status === decision
          )
            return latest;
          if (
            latest.version !== order.version ||
            latestReview?.revision !== review.revision ||
            latestReview.status !== "REQUESTED"
          )
            throw new ApiError(409, { error: { code: "CONFLICT" } });
          const result = await apiRequest(
            `/admin/orders/${order.id}/purchase-review/decision`,
            { method: "POST", csrf: true, signal: controller.signal, body },
          );
          const saved = parseStaffOrderDetail(result.data);
          if (
            saved.id !== order.id ||
            saved.purchaseReviews[0]?.revision !== review.revision ||
            saved.purchaseReviews[0]?.status !== decision
          )
            throw Error("Decision requires recovery");
          return saved;
        },
      });
      onBusyChange(true);
    } catch (failure) {
      setError(
        failure instanceof RangeError
          ? "Check the supplier confirmation expiry and estimated arrival dates."
          : failure instanceof Error
            ? failure.message
            : "Review the availability dates and reason.",
      );
    }
  }
  return (
    <section className={styles.panel} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>Purchase review needed</h2>
      <p>
        Resolve the missing suitability or availability information. Orders that match
        approved evidence and current stock are checked automatically.
      </p>
      <Link href="/admin/fitment">View fitment evidence and review</Link>
      <Feedback message={error} scrollToMessage />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          reviewDecision(new FormData(event.currentTarget));
        }}
      >
        <fieldset className={styles.form} disabled={disabled || !!proposal}>
          <legend className={styles.srOnly}>Review the current purchase offer</legend>
          {order.items.map((item) => {
            const selection = review.requirements.lines.find(
              (line) => line.orderItemId === item.id,
            )?.selection;
            return (
              <fieldset className={styles.item} key={item.id}>
                <legend>
                  {item.productName} · Quantity {item.quantity}
                </legend>
                <p>
                  {selection
                    ? "Confirm the selected model and required technical details against the evidence."
                    : "No vehicle configuration supplied. Only an evidenced universal accessory can be approved without one; otherwise request the missing details."}
                </p>
                {selection && <RequestedVehicle selection={selection} />}
                {selection && (
                  <dl>
                    {fitmentQualifierKeys
                      .filter((key) => selection[key])
                      .map((key) => (
                        <div key={key}>
                          <dt>{fitmentLabels[key]}</dt>
                          <dd>{String(selection[key])}</dd>
                        </div>
                      ))}
                  </dl>
                )}
                {decision === "APPROVED" && (
                  <>
                    <div className="field">
                      <label htmlFor={`${id}-${item.id}-availability`}>
                        Availability
                      </label>
                      <select
                        id={`${id}-${item.id}-availability`}
                        value={supplier[item.id] ? "supplier" : "stock"}
                        onChange={(event) =>
                          setSupplier((old) => ({
                            ...old,
                            [item.id]: event.target.value === "supplier",
                          }))
                        }
                      >
                        <option value="stock">Reserve available branch stock</option>
                        <option value="supplier" disabled={!order.partsQuote}>
                          Supplier confirmed · accepted quotation required
                        </option>
                      </select>
                    </div>
                    {supplier[item.id] && (
                      <div className={styles.fields}>
                        <div className="field">
                          <label htmlFor={`${id}-${item.id}-source`}>
                            Supplier confirmation reference
                          </label>
                          <input
                            id={`${id}-${item.id}-source`}
                            name={`${item.id}-source`}
                            required
                            minLength={10}
                            maxLength={2000}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`${id}-${item.id}-until`}>
                            Confirmation valid until · Lagos time
                          </label>
                          <input
                            id={`${id}-${item.id}-until`}
                            name={`${item.id}-until`}
                            type="datetime-local"
                            required
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`${id}-${item.id}-from`}>
                            Estimated arrival from
                          </label>
                          <input
                            id={`${id}-${item.id}-from`}
                            name={`${item.id}-from`}
                            type="date"
                            required
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`${id}-${item.id}-to`}>
                            Estimated arrival to
                          </label>
                          <input
                            id={`${id}-${item.id}-to`}
                            name={`${item.id}-to`}
                            type="date"
                            required
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </fieldset>
            );
          })}
          <div className="field">
            <label htmlFor={`${id}-decision`}>Outcome</label>
            <select
              id={`${id}-decision`}
              value={decision}
              onChange={(event) =>
                setDecision(event.target.value === "DECLINED" ? "DECLINED" : "APPROVED")
              }
            >
              <option value="APPROVED">Confirm suitability and availability</option>
              <option value="DECLINED">Unable to confirm this offer</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${id}-reason`}>Reason and next step</label>
            <textarea
              id={`${id}-reason`}
              name="reason"
              required
              minLength={10}
              maxLength={2000}
              rows={3}
            />
          </div>
          <button className="button" type="submit">
            Review decision
          </button>
        </fieldset>
      </form>
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => {
            setProposal(null);
            onBusyChange(false);
            if (outcomeUncertain.current) onSaved();
          }}
          onSuccess={() => {
            setProposal(null);
            onBusyChange(false);
            onSaved(
              "Purchase review recorded. Check the saved payment and fulfilment status for the next step.",
            );
          }}
        />
      )}
    </section>
  );
}
