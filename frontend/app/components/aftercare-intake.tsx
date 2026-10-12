"use client";
import { useRef, useState } from "react";
import { ApiError, apiRequest } from "@/lib/api/client";
import type { useAftercareWrite } from "@/lib/orders/use-aftercare-write";
import {
  cancelDraftSubmission,
  draftIdentity,
  draftKey,
  forgetDraft,
} from "@/lib/forms/drafts";
import type { RequestBody } from "@/lib/api/contracts";
import {
  aftercareSchema,
  aftercareRequestSchema,
  aftercareKinds,
  matchesAftercareOrder,
  parseAftercareOrder,
  parseAftercareList,
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
        <span className="aftercare-product-name">
          {item.productName}
          <small>Ordered: {item.quantity}</small>
        </span>
      </label>
      <div className="field">
        <label className="sr-only" htmlFor={`quantity-${item.id}`}>
          Quantity for {item.productName}
        </label>
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
      </div>
    </div>
  );
}
export function AftercareIntake({
  order,
  disabled,
  onSaved,
  onUncertain,
  guard,
}: {
  order: AftercareOrder;
  disabled: boolean;
  onSaved: () => void;
  onUncertain: () => void;
  guard?: ReturnType<typeof useAftercareWrite>;
}) {
  const [kind, setKind] = useState("");
  const [scope, setScope] = useState("");
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [validation, setValidation] = useState<string>();
  const [message, setMessage] = useState<string>();
  const formRef = useRef<HTMLFormElement>(null);
  const attempted = useRef(false);
  const duplicate = useRef(false);
  const formKey = JSON.stringify(["aftercare-intake:1", order.id]);
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
        "This asks staff to review your request. It does not cancel products, authorize a return shipment, change stock or confirm a refund. A request of the same type that has not been rejected keeps its original details.",
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
        const write = async (signal?: AbortSignal) => {
          // HTTP success alone cannot clear a draft: validate the returned order
          // request first, then clear explicitly in onSuccess.
          cancelDraftSubmission();
          const saved = aftercareSchema.parse(
            (
              await apiRequest(
                `/customers/orders/${order.id}/${wholeReturn ? "returns" : "aftercare"}`,
                { method: "POST", csrf: true, body, signal },
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
        };
        if (guard) {
          await guard.run(async (signal) => {
            const [freshOrder, freshHistory] = await Promise.all([
              apiRequest(`/customers/orders/${order.id}`, { signal }),
              apiRequest(`/customers/orders/${order.id}/aftercare`, { signal }),
            ]);
            const checkedOrder = parseAftercareOrder(freshOrder.data);
            const checkedHistory = parseAftercareList(freshHistory.data);
            if (
              JSON.stringify(checkedOrder) !== JSON.stringify(order) ||
              new Set(checkedHistory.map((record) => record.id)).size !==
                checkedHistory.length ||
              !checkedHistory.every((record) =>
                matchesAftercareOrder(record, checkedOrder),
              )
            )
              throw new ApiError(409, { error: { code: "CONFLICT" } });
          }, write);
        } else await write();
      },
      onUncertain,
      retryAfterRejection: false,
    });
  }
  return (
    <section className={guard ? "ca-panel ca-intake" : "detail-section aftercare-record"}>
      <h2>Request a return or cancellation</h2>
      <p>
        Staff review timing, item condition and any applicable fee. A review decision is
        separate from a refund payment.
      </p>
      <Feedback message={validation} />
      <Feedback message={message} tone="success" toast="Order request recorded." />
      <form
        data-draft-key={formKey}
        ref={formRef}
        className="line-entry-form"
        onSubmit={(e) => {
          e.preventDefault();
          review(new FormData(e.currentTarget));
        }}
      >
        <fieldset disabled={guard ? guard.busy : disabled}>
          <legend>Products and reason</legend>
          <div className="aftercare-selects">
            <div className="field">
              <label htmlFor="aftercare-kind">Request type</label>
              <select
                id="aftercare-kind"
                name="kind"
                data-draft-context
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
                name="scope"
                data-draft-context
                required
                value={scope}
                onChange={(e) => setScope(e.target.value)}
              >
                <option value="">Choose products</option>
                <option value="ALL">All products</option>
                <option value="SELECTED">Selected products</option>
              </select>
            </div>
          </div>
          {scope === "ALL" && (
            <p className="field-hint">
              All ordered products and quantities will be included.
            </p>
          )}
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
              aria-describedby="aftercare-reason-hint"
            />
            <span className="field-hint" id="aftercare-reason-hint">
              10–2,000 characters.
            </span>
          </div>
          <button className="button" disabled={disabled}>
            Review order request
          </button>
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
            const owner = draftIdentity();
            if (owner) forgetDraft(draftKey(owner, location.pathname, formKey));
            setKind("");
            setScope("");
          }}
        />
      )}
    </section>
  );
}
