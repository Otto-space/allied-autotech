"use client";
import { useRef, useState } from "react";
import { apiRequest } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import {
  aftercareSchema,
  aftercareRequestSchema,
  aftercareKinds,
  matchesAftercareOrder,
  type AftercareOrder,
} from "@/lib/api/aftercare-schemas";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
function RequestedItem({ item }: { item: AftercareOrder["items"][number] }) {
  const [included, setIncluded] = useState(false);
  return (
    <div className="aftercare-item">
      <label className="check-label" htmlFor={`include-${item.id}`}>
        <input
          type="checkbox"
          id={`include-${item.id}`}
          name={`include-${item.id}`}
          checked={included}
          onChange={(event) => setIncluded(event.target.checked)}
        />
        {item.productName}
      </label>
      <div className="field">
        <label htmlFor={`quantity-${item.id}`}>Quantity for {item.productName}</label>
        <input
          className="input"
          id={`quantity-${item.id}`}
          name={`quantity-${item.id}`}
          type="number"
          min={1}
          max={item.quantity}
          step={1}
          defaultValue={item.quantity}
          disabled={!included}
          required={included}
        />
        <span className="field-hint">Ordered: {item.quantity}</span>
      </div>
    </div>
  );
}
export function AftercareIntake({
  order,
  disabled,
  onSaved,
  onUncertain,
}: {
  order: AftercareOrder;
  disabled: boolean;
  onSaved: () => void;
  onUncertain: () => void;
}) {
  const [kind, setKind] = useState("");
  const [scope, setScope] = useState("");
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [validation, setValidation] = useState<string>();
  const [message, setMessage] = useState<string>();
  const formRef = useRef<HTMLFormElement>(null);
  const attempted = useRef(false);
  const duplicate = useRef(false);
  function review(form: FormData) {
    if (disabled || proposal) return;
    setValidation(undefined);
    setMessage(undefined);
    const items =
      scope === "ALL"
        ? order.items.map((i) => ({ orderItemId: i.id, quantity: i.quantity }))
        : order.items
            .filter((i) => form.get(`include-${i.id}`) === "on")
            .map((i) => ({
              orderItemId: i.id,
              quantity: Number(form.get(`quantity-${i.id}`)),
            }));
    const parsed = aftercareRequestSchema.safeParse({
      kind,
      reason: form.get("reason"),
      items,
    });
    if (
      !parsed.success ||
      !items.every(
        (i) => i.quantity <= order.items.find((o) => o.id === i.orderItemId)!.quantity,
      )
    ) {
      setValidation(
        "Choose a request type and at least one product with a valid quantity, then explain your request in 10–2,000 characters.",
      );
      const field = parsed.success ? "items" : String(parsed.error.issues[0]?.path[0]);
      document
        .getElementById(
          field === "kind"
            ? "aftercare-kind"
            : field === "reason"
              ? "aftercare-reason"
              : "aftercare-scope",
        )
        ?.focus();
      return;
    }
    const input = parsed.data;
    setProposal({
      title: "Send this order request?",
      description:
        "This asks staff to review your request. It does not cancel products, authorize a return shipment, change stock or confirm a refund. If an active request of the same type exists, its original details will be kept.",
      facts: [
        { label: "Order", value: order.orderNumber },
        { label: "Request", value: aftercareKinds[input.kind] },
        ...input.items.map((i, index) => ({
          label: `Product ${index + 1}`,
          value: `${order.items.find((o) => o.id === i.orderItemId)!.productName}, quantity ${i.quantity}`,
        })),
        { label: "Explanation", value: input.reason },
      ],
      submit: async () => {
        attempted.current = true;
        const wholeReturn = input.kind === "RETURN" && scope === "ALL";
        const body:
          | RequestBody<"/customers/orders/{id}/aftercare", "post">
          | RequestBody<"/customers/orders/{id}/returns", "post"> = wholeReturn
          ? { reason: input.reason }
          : input;
        const saved = aftercareSchema.parse(
          (
            await apiRequest(
              `/customers/orders/${order.id}/${wholeReturn ? "returns" : "aftercare"}`,
              { method: "POST", csrf: true, body },
            )
          ).data,
        );
        if (
          !matchesAftercareOrder(saved, order) ||
          saved.kind !== input.kind ||
          saved.status === "REJECTED"
        )
          throw new Error("Unexpected order request");
        const canonical = (values: typeof input.items) =>
          values
            .map((i) => `${i.orderItemId}:${i.quantity}`)
            .sort()
            .join("|");
        duplicate.current =
          saved.reason !== input.reason ||
          canonical(saved.items) !== canonical(input.items) ||
          saved.status !== "REQUESTED";
      },
      onUncertain,
      retryAfterRejection: false,
    });
  }
  return (
    <section className="detail-section aftercare-record">
      <h2>Request a return or cancellation</h2>
      <p>
        Staff review timing, item condition and any applicable fee. A review decision is
        separate from a refund payment.
      </p>
      <Feedback message={validation} />
      <Feedback message={message} tone="success" toast="Order request recorded." />
      <form
        ref={formRef}
        className="line-entry-form"
        onSubmit={(e) => {
          e.preventDefault();
          review(new FormData(e.currentTarget));
        }}
      >
        <fieldset disabled={disabled}>
          <legend>Products and reason</legend>
          <div className="field">
            <label htmlFor="aftercare-kind">Request type</label>
            <select
              id="aftercare-kind"
              required
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="">Choose a request</option>
              {Object.entries(aftercareKinds).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="aftercare-scope">Products to review</label>
            <select
              id="aftercare-scope"
              required
              value={scope}
              onChange={(e) => setScope(e.target.value)}
            >
              <option value="">Choose products</option>
              <option value="ALL">All products and quantities</option>
              <option value="SELECTED">Selected products and quantities</option>
            </select>
          </div>
          {scope === "SELECTED" &&
            order.items.map((item) => <RequestedItem item={item} key={item.id} />)}
          <div className="field">
            <label htmlFor="aftercare-reason">Reason for your request</label>
            <textarea
              id="aftercare-reason"
              name="reason"
              required
              minLength={10}
              maxLength={2000}
            />
          </div>
          <button className="button">Review order request</button>
        </fieldset>
      </form>
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel="Send order request"
          onClose={() => {
            setProposal(null);
            if (attempted.current) onSaved();
            attempted.current = false;
          }}
          onSuccess={() => {
            setMessage(
              duplicate.current
                ? "An existing request was returned. Its original products and explanation remain unchanged; review the history below."
                : "Order request recorded for staff review. Check its status below before making another request.",
            );
            formRef.current?.reset();
            setKind("");
            setScope("");
          }}
        />
      )}
    </section>
  );
}
