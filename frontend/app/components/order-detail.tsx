"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { z } from "zod";
import { apiRequest, ApiError, newIdempotencyKey } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import { useResource } from "@/lib/api/use-resource";
import { parseOrder } from "@/lib/api/commerce-schemas";
import { paymentSchema } from "@/lib/api/payment-schemas";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { Feedback } from "./feedback";
import { PaymentDetail } from "./payment-detail";
export function OrderDetail({ orderId }: { orderId: string }) {
  const order = useResource(
    `/customers/orders/${encodeURIComponent(orderId)}`,
    parseOrder,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [paymentId, setPaymentId] = useState<string>();
  const key = useRef<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  async function preparePayment() {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    key.current ??= newIdempotencyKey();
    try {
      const body: RequestBody<"/customers/payments", "post"> = {
        targetType: "ORDER",
        targetId: orderId,
        purpose: "ORDER_PAYMENT",
      };
      const result = await apiRequest("/customers/payments", {
        method: "POST",
        csrf: true,
        idempotencyKey: key.current,
        body,
      });
      const parsed = z.object({ payment: paymentSchema }).parse(result.data);
      setPaymentId(parsed.payment.id);
    } catch (value) {
      setError(
        value instanceof ApiError
          ? value.message
          : "Payment preparation could not be confirmed. Check your payments before starting again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function cancel(reason: string) {
    if (busy || !order.data) return;
    setBusy(true);
    setError(undefined);
    try {
      const body: RequestBody<"/customers/orders/{orderId}/cancel", "post"> = {
        expectedVersion: order.data.version,
        reason,
      };
      await apiRequest(`/customers/orders/${orderId}/cancel`, {
        method: "POST",
        csrf: true,
        body,
      });
      dialog.current?.close();
      order.refresh();
    } catch (value) {
      setError(
        value instanceof ApiError
          ? value.message
          : "Cancellation is unconfirmed. Refresh your order to check its status.",
      );
    } finally {
      setBusy(false);
    }
  }
  const current = order.data;
  return (
    <>
      <Link className="text-link" href="/dashboard/orders">
        ← Your orders
      </Link>
      <h1>Order details</h1>
      <Feedback message={error ?? order.error} />
      {order.loading && <p role="status">Checking order…</p>}
      <button
        className="button secondary"
        onClick={order.refresh}
        disabled={order.loading}
      >
        Refresh order
      </button>
      {current && (
        <>
          <section className="detail-section">
            <h2>{current.orderNumber}</h2>
            <span className="status">{current.status}</span>
            <p>
              {current.branch.name} · {current.fulfillmentMethod.toLowerCase()}
            </p>
            <p>Created {formatBusinessDate(current.createdAt)}</p>
            {current.paymentDueAt && (
              <p>Payment deadline: {formatBusinessDate(current.paymentDueAt)}</p>
            )}
            {current.paidAt ? (
              <Feedback
                message={
                  current.status === "CANCELLED"
                    ? "Payment was received, but this order is cancelled. Contact customer care for help resolving the payment."
                    : "Payment is recorded for this order."
                }
                tone="info"
              />
            ) : (
              <p className="muted">Payment has not been recorded for this order.</p>
            )}
            <div className="list">
              {current.items.map((item) => (
                <article className="list-item" key={item.id}>
                  <div>
                    <h3>{item.productName}</h3>
                    <p>
                      {item.quantity} × {formatKobo(item.unitPriceKobo)}
                    </p>
                  </div>
                  <strong>{formatKobo(item.subtotalKobo)}</strong>
                </article>
              ))}
            </div>
            <dl className="totals checkout-summary">
              <dt>Parts subtotal</dt>
              <dd>{formatKobo(current.subtotalKobo)}</dd>
              <dt>Discount</dt>
              <dd>{formatKobo(current.discountAmountKobo)}</dd>
              <dt>Delivery fee</dt>
              <dd>{formatKobo(current.deliveryFeeKobo)}</dd>
              <dt>Order total</dt>
              <dd>{formatKobo(current.totalKobo)}</dd>
            </dl>
            {current.status === "PENDING" &&
              !current.paidAt &&
              !order.error &&
              !order.loading && (
                <div className="actions">
                  {!paymentId && (
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => void preparePayment()}
                    >
                      {busy ? "Checking…" : "Review payment options"}
                    </button>
                  )}
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => dialog.current?.showModal()}
                  >
                    Cancel order
                  </button>
                </div>
              )}
            <p>
              <Link className="text-link" href="/dashboard/payments">
                Check all your payments →
              </Link>
            </p>
          </section>
          {paymentId && <PaymentDetail paymentId={paymentId} />}
        </>
      )}
      <dialog
        ref={dialog}
        className="support-dialog"
        aria-labelledby="cancel-order-title"
      >
        <h2 id="cancel-order-title">Cancel this order?</h2>
        <p>
          This releases its stock reservation. Check any pending payment before
          cancelling.
        </p>
        <Feedback message={error} />
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void cancel(String(new FormData(event.currentTarget).get("reason")));
          }}
        >
          <div className="field">
            <label htmlFor="cancel-reason">Reason for cancellation</label>
            <textarea name="reason" id="cancel-reason" required maxLength={500} />
          </div>
          <div className="actions">
            <button className="button danger" disabled={busy}>
              Confirm cancellation
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={() => dialog.current?.close()}
            >
              Keep order
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
