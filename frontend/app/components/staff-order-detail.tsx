"use client";
import Link from "next/link";
import { useState } from "react";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { orderSchema } from "@/lib/api/commerce-schemas";
import type { RequestBody } from "@/lib/api/contracts";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { Feedback } from "./feedback";
const parseStaffOrder = (value: unknown) =>
  orderSchema
    .extend({
      customerName: z.string(),
      customerEmail: z.string(),
      customerPhone: z.string().nullable(),
      cancellationReason: z.string().nullable(),
    })
    .parse(value);
const transitions = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["READY", "CANCELLED"],
  READY: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
} as const;
export function StaffOrderDetail({ orderId }: { orderId: string }) {
  const order = useResource(
    `/staff/orders/${encodeURIComponent(orderId)}`,
    parseStaffOrder,
  );
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [message, setMessage] = useState<string>();
  const [validation, setValidation] = useState<string>();
  const current = order.data;
  function review(form: FormData) {
    setValidation(undefined);
    if (!current || order.error || order.loading) return;
    const status = String(form.get("status"));
    const parsed = z
      .enum(["CONFIRMED", "PROCESSING", "READY", "COMPLETED", "CANCELLED"])
      .safeParse(status);
    if (
      !parsed.success ||
      !(transitions[current.status] as readonly string[]).includes(parsed.data)
    )
      return;
    const reason = String(form.get("reason") ?? "").trim();
    if (parsed.data === "CANCELLED" && !reason) {
      setValidation("Enter a cancellation reason before continuing.");
      document.getElementById("fulfilment-reason")?.focus();
      return;
    }
    const body: RequestBody<"/staff/orders/{orderId}/status", "post"> = {
      status: parsed.data,
      expectedVersion: current.version,
      ...(reason ? { reason } : {}),
    };
    setProposal({
      title: "Update order fulfilment?",
      description:
        parsed.data === "CANCELLED"
          ? "Cancellation affects stock reservations. It does not by itself confirm a refund."
          : "Confirm that the required workshop or collection step has actually occurred. This action does not record a payment.",
      facts: [
        { label: "Order", value: current.orderNumber },
        { label: "From", value: current.status },
        { label: "To", value: parsed.data },
        { label: "Payment", value: current.paidAt ? "Recorded" : "Not recorded" },
        ...(reason ? [{ label: "Reason", value: reason }] : []),
      ],
      submit: () =>
        apiRequest(`/staff/orders/${current.id}/status`, {
          method: "POST",
          csrf: true,
          body,
        }),
    });
  }
  return (
    <>
      <Link className="text-link" href="/admin/orders">
        ← Order fulfilment
      </Link>
      <h1>Manage order</h1>
      <Feedback message={order.error} />
      <Feedback message={validation} />
      <Feedback message={message} tone="success" />
      <button
        className="button secondary"
        disabled={order.loading}
        onClick={order.refresh}
      >
        Refresh order
      </button>
      {order.loading && <p role="status">Checking order…</p>}
      {current && (
        <>
          <section className="detail-section">
            <h2>{current.orderNumber}</h2>
            <span className="status">{current.status}</span>
            <p>
              {current.branch.name} · {current.fulfillmentMethod}
            </p>
            <p>
              {current.customerName} · {current.customerEmail}
            </p>
            {current.customerPhone && <p>{current.customerPhone}</p>}
            <p>
              {current.paidAt
                ? `Payment recorded ${formatBusinessDate(current.paidAt)}`
                : "Payment has not been recorded."}
            </p>
            {current.paymentDueAt && (
              <p>Payment deadline: {formatBusinessDate(current.paymentDueAt)}</p>
            )}
            {current.cancellationReason && (
              <p>Cancellation reason: {current.cancellationReason}</p>
            )}
            <div
              className="table-region"
              role="region"
              aria-label="Order items"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th>Part</th>
                    <th>Quantity</th>
                    <th>Unit price</th>
                    <th>Line subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {current.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.productName}
                        <p className="muted">{item.sku}</p>
                      </td>
                      <td>{item.quantity}</td>
                      <td>{formatKobo(item.unitPriceKobo)}</td>
                      <td>{formatKobo(item.subtotalKobo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="totals">
              <dt>Parts subtotal</dt>
              <dd>{formatKobo(current.subtotalKobo)}</dd>
              <dt>Discount</dt>
              <dd>{formatKobo(current.discountAmountKobo)}</dd>
              <dt>Delivery</dt>
              <dd>{formatKobo(current.deliveryFeeKobo)}</dd>
              <dt>Total order value</dt>
              <dd>{formatKobo(current.totalKobo)}</dd>
            </dl>
          </section>
          {transitions[current.status].length > 0 && (
            <section className="detail-section">
              <h2>Update fulfilment</h2>
              <form
                key={current.version}
                onSubmit={(event) => {
                  event.preventDefault();
                  review(new FormData(event.currentTarget));
                }}
              >
                <div className="field">
                  <label htmlFor="fulfilment-status">Next status</label>
                  <select id="fulfilment-status" name="status" required>
                    <option value="">Choose next status</option>
                    {transitions[current.status].map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="fulfilment-reason">
                    Reason (required for cancellation)
                  </label>
                  <textarea id="fulfilment-reason" name="reason" maxLength={500} />
                </div>
                <button className="button" disabled={order.loading || !!order.error}>
                  Review fulfilment change
                </button>
              </form>
            </section>
          )}
        </>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => setProposal(null)}
          onSuccess={() => {
            setMessage("Order change recorded. Review the refreshed status.");
            order.refresh();
          }}
        />
      )}
    </>
  );
}
