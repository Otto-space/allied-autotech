"use client";
import { NotificationRecordContext } from "./notification-record-context";
import { WorkflowProgress } from "./status-progress";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CreditCard,
  FileText,
  MapPin,
  Package,
  RefreshCw,
} from "lucide-react";
import { z } from "zod";
import {
  apiRequest,
  ApiError,
  newIdempotencyKey,
  SESSION_CHANGED,
} from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import { useResource } from "@/lib/api/use-resource";
import { parseOrder } from "@/lib/api/commerce-schemas";
import { aftercareSchema } from "@/lib/api/aftercare-schemas";
import { paymentMessages, type PaymentRecord } from "@/lib/api/payment-schemas";
import {
  blockingOrderPayment,
  orderPaymentSnapshot,
  orderPaymentUnavailable,
  parseOrderPayment,
  readOrderPayments,
  type CustomerOrder,
} from "@/lib/api/order-payment";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { useScrollToMessage } from "@/lib/use-scroll-to-message";
import { Feedback } from "./feedback";
import { CopyControl } from "./copy-control";
import "./order-detail.css";

const statusLabels: Record<CustomerOrder["status"], string> = {
  PENDING: "Pending order",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  READY: "Ready",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};
const paymentLabels: Record<PaymentRecord["status"], string> = {
  REQUIRES_PAYMENT: "Awaiting payment",
  PROCESSING: "Processing",
  REQUIRES_REVIEW: "Needs review",
  SUCCEEDED: "Confirmed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

export function OrderDetail({ orderId }: { orderId: string }) {
  const parse = useCallback(
    (value: unknown) => {
      const result = parseOrder(value);
      if (result.id !== orderId) throw new Error("Unexpected order");
      return result;
    },
    [orderId],
  );
  const order = useResource(`/customers/orders/${encodeURIComponent(orderId)}`, parse);
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [uncertain, setUncertain] = useState<"cancel" | "payment">();
  const [review, setReview] = useState<CustomerOrder>();
  const [cancelReview, setCancelReview] = useState<CustomerOrder>();
  const [payment, setPayment] = useState<PaymentRecord>();
  const [now, setNow] = useState(() => Date.now());
  const active = useRef(true);
  const busyRef = useRef(false);
  const pending = useRef<AbortController | null>(null);
  const key = useRef<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelForm = useRef<HTMLFormElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const paymentHeading = useRef<HTMLHeadingElement>(null);
  const orderHeading = useRef<HTMLHeadingElement>(null);
  const messageRef = useScrollToMessage(error ?? notice);

  useEffect(() => {
    active.current = true;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const discard = () => {
      active.current = false;
      pending.current?.abort();
      cancelForm.current?.reset();
      dialog.current?.close();
      setReview(undefined);
      setCancelReview(undefined);
      setPayment(undefined);
      setError(undefined);
      setNotice(undefined);
    };
    window.addEventListener(SESSION_CHANGED, discard);
    return () => {
      active.current = false;
      pending.current?.abort();
      clearInterval(timer);
      window.removeEventListener(SESSION_CHANGED, discard);
    };
  }, []);

  const current = !order.error && order.data?.id === orderId ? order.data : undefined;
  const disabled =
    busy ||
    !!uncertain ||
    order.loading ||
    order.refreshing ||
    !!order.error ||
    !!order.refreshError;
  const unavailable = current ? orderPaymentUnavailable(current, now) : undefined;
  const reviewChanged =
    !!review &&
    !!current &&
    orderPaymentSnapshot(review) !== orderPaymentSnapshot(current);
  const reviewUnavailable = review ? orderPaymentUnavailable(review, now) : undefined;

  function begin() {
    if (!active.current || busyRef.current) return;
    const controller = new AbortController();
    pending.current = controller;
    busyRef.current = true;
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    return controller;
  }
  function live(controller: AbortController) {
    return active.current && !controller.signal.aborted;
  }
  function finish(controller: AbortController) {
    if (pending.current === controller) {
      busyRef.current = false;
      pending.current = null;
      if (live(controller)) setBusy(false);
    }
  }
  function focusPayment() {
    requestAnimationFrame(() => {
      if (!active.current) return;
      paymentHeading.current?.focus({ preventScroll: true });
      paymentHeading.current?.scrollIntoView({ block: "center", behavior: "instant" });
    });
  }
  async function freshContext(signal: AbortSignal) {
    const [response, payments] = await Promise.all([
      apiRequest(`/customers/orders/${encodeURIComponent(orderId)}`, { signal }),
      readOrderPayments(orderId, signal),
    ]);
    return {
      latest: parse(response.data),
      existing: payments.find(blockingOrderPayment),
    };
  }
  async function reviewPayment() {
    if (disabled || !current || orderPaymentUnavailable(current)) return;
    const controller = begin();
    if (!controller) return;
    try {
      const { latest, existing } = await freshContext(controller.signal);
      if (!live(controller)) return;
      if (existing) {
        setPayment(existing);
        setReview(undefined);
      } else {
        const reason = orderPaymentUnavailable(latest);
        if (reason) {
          setError(reason);
          order.refresh();
          return;
        }
        setReview(latest);
        if (orderPaymentSnapshot(latest) !== orderPaymentSnapshot(current))
          order.refresh();
      }
      focusPayment();
    } catch (value) {
      if (live(controller))
        setError(
          value instanceof ApiError
            ? value.message
            : "We could not check the order and its full payment history. Try again before creating a payment request.",
        );
    } finally {
      finish(controller);
    }
  }
  async function preparePayment(recover = false) {
    if (!active.current || busyRef.current || uncertain === "cancel") return;
    if (
      recover
        ? uncertain !== "payment" || !key.current
        : disabled || !review || reviewChanged || !!reviewUnavailable
    )
      return;
    const controller = begin();
    if (!controller) return;
    let sent = false;
    try {
      if (!recover && review) {
        const { latest, existing } = await freshContext(controller.signal);
        if (!live(controller)) return;
        if (existing) {
          setPayment(existing);
          setReview(undefined);
          focusPayment();
          return;
        }
        const reason = orderPaymentUnavailable(latest);
        if (reason || orderPaymentSnapshot(latest) !== orderPaymentSnapshot(review)) {
          setReview(undefined);
          setError(
            reason ??
              "The order changed. Refresh and review its current total before continuing.",
          );
          order.refresh();
          return;
        }
      }
      if (!live(controller)) return;
      key.current ??= newIdempotencyKey();
      const body: RequestBody<"/customers/payments", "post"> = {
        targetType: "ORDER",
        targetId: orderId,
        purpose: "ORDER_PAYMENT",
      };
      sent = true;
      const response = await apiRequest("/customers/payments", {
        method: "POST",
        csrf: true,
        idempotencyKey: key.current,
        body,
        signal: controller.signal,
      });
      if (!live(controller)) return;
      const receipt = z.object({ payment: z.unknown() }).parse(response.data);
      setPayment(parseOrderPayment(receipt.payment, orderId));
      setReview(undefined);
      setUncertain(undefined);
      focusPayment();
    } catch (value) {
      if (!live(controller)) return;
      const known =
        value instanceof ApiError && value.status >= 400 && value.status < 500;
      if (sent && (!known || recover)) setUncertain("payment");
      else if (known) {
        key.current = null;
        setReview(undefined);
        order.refresh();
      }
      setError(
        value instanceof ApiError
          ? value.message
          : sent
            ? "Payment preparation could not be confirmed. Recover the same request or check your payment history before starting again."
            : "We could not recheck the order and payment history. No new payment request was sent.",
      );
    } finally {
      finish(controller);
    }
  }
  function closeCancel() {
    if (busyRef.current) return;
    dialog.current?.close();
    cancelButton.current?.focus();
  }
  async function cancel(reason: string) {
    if (disabled || !current || !cancelReview || current.version !== cancelReview.version)
      return;
    const trimmed = reason.trim();
    if (
      !trimmed ||
      trimmed.length > 500 ||
      Array.from(trimmed).some(
        (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
      )
    ) {
      setError(
        "Enter a reason of 1–500 characters without line breaks or control characters.",
      );
      cancelForm.current?.querySelector("textarea")?.focus();
      return;
    }
    const controller = begin();
    if (!controller) return;
    try {
      const body: RequestBody<"/customers/orders/{orderId}/cancel", "post"> = {
        expectedVersion: cancelReview.version,
        reason: trimmed,
      };
      const response = await apiRequest(
        `/customers/orders/${encodeURIComponent(orderId)}/cancel`,
        {
          method: "POST",
          csrf: true,
          body,
          signal: controller.signal,
        },
      );
      if (!live(controller)) return;
      const saved = parse(response.data);
      const request = z
        .object({ cancellationRequest: aftercareSchema.optional() })
        .parse(response.data).cancellationRequest;
      if (
        saved.status !== "CANCELLED" &&
        (!request || request.orderId !== orderId || request.kind !== "CANCELLATION")
      )
        throw new Error("Unexpected cancellation outcome");
      setNotice(
        saved.status === "CANCELLED"
          ? "Order cancelled. Check payment records for any refund status."
          : "A cancellation request was recorded for staff review. Your order has not been cancelled.",
      );
      cancelForm.current?.reset();
      dialog.current?.close();
      setReview(undefined);
      setPayment(undefined);
      order.refresh();
      requestAnimationFrame(() => {
        if (active.current) orderHeading.current?.focus({ preventScroll: true });
      });
    } catch (value) {
      if (!live(controller)) return;
      if (!(value instanceof ApiError && value.status >= 400 && value.status < 500))
        setUncertain("cancel");
      setError(
        value instanceof ApiError
          ? value.message
          : "Cancellation is unconfirmed. Refresh your order to check its status.",
      );
    } finally {
      finish(controller);
    }
  }

  return (
    <div className="customer-order">
      <nav className="order-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/dashboard">Overview</Link>
        <span aria-hidden="true">/</span>
        <Link href="/dashboard/orders">Orders</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{current?.orderNumber ?? "Order details"}</span>
      </nav>
      <header className="order-heading">
        <div>
          <p className="order-eyebrow">Your purchases</p>
          <h1 ref={orderHeading} tabIndex={-1}>
            Order details
          </h1>
        </div>
        <button
          className="button secondary"
          onClick={() => {
            setReview(undefined);
            setPayment(undefined);
            order.refresh();
          }}
          disabled={busy || order.loading}
        >
          <RefreshCw size={16} aria-hidden="true" /> Refresh order
        </button>
      </header>
      <div ref={messageRef}>
        <Feedback
          message={cancelOpen ? undefined : (error ?? order.error ?? order.refreshError)}
        />
        <Feedback
          message={notice}
          tone="success"
          toast="Cancellation outcome recorded."
        />
        {uncertain && (
          <Feedback
            tone="warning"
            message={
              uncertain === "cancel"
                ? "The cancellation outcome is uncertain. Review refreshed order and request history before reloading to make another change."
                : "The payment request outcome is uncertain. Recover the same request or check your payments. Do not start a second request."
            }
          />
        )}
      </div>
      {order.loading && (
        <p className="order-loading" role="status">
          Checking order…
        </p>
      )}
      {current &&
        !order.loading &&
        !order.refreshing &&
        !order.error &&
        !order.refreshError && (
          <NotificationRecordContext resourceType="ORDER" resourceId={current.id} />
        )}
      {current && (
        <>
          <WorkflowProgress workflow="order" status={current.status} />
          <section className="order-identity" aria-label="Order reference and status">
            <div className="order-reference">
              <h2>{current.orderNumber}</h2>
              <label className="sr-only" htmlFor="order-reference">
                Order reference
              </label>
              <input id="order-reference" readOnly value={current.orderNumber} />
              <CopyControl
                value={current.orderNumber}
                label="Copy order reference"
                fieldId="order-reference"
              />
            </div>
            <dl className="order-facts">
              <div>
                <dt>Status</dt>
                <dd>
                  <span
                    className={`order-status order-status-${current.status.toLowerCase()}`}
                    data-status={current.status}
                  >
                    {statusLabels[current.status]}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{formatBusinessDate(current.createdAt)}</dd>
              </div>
              <div>
                <dt>Handling branch</dt>
                <dd>{current.branch.name}</dd>
              </div>
              <div>
                <dt>Fulfilment</dt>
                <dd>
                  {current.fulfillmentMethod === "DELIVERY" ? "Delivery" : "Collection"}
                </dd>
              </div>
            </dl>
          </section>
          <div className="order-layout">
            <div className="order-commerce">
              <section className="order-amount" aria-labelledby="order-summary-title">
                <div className="order-section-heading">
                  <FileText size={19} aria-hidden="true" />
                  <h2 id="order-summary-title">Order summary</h2>
                </div>
                <dl className="checkout-summary">
                  <dt>Products subtotal</dt>
                  <dd>{formatKobo(current.subtotalKobo)}</dd>
                  <dt>Discount</dt>
                  <dd>{formatKobo(current.discountAmountKobo)}</dd>
                  <dt>Delivery fee</dt>
                  <dd>{formatKobo(current.deliveryFeeKobo)}</dd>
                  <dt>Tax</dt>
                  <dd>
                    {current.taxKobo === undefined
                      ? "Not available on this record"
                      : formatKobo(current.taxKobo)}
                  </dd>
                  <dt className="order-total">Order total</dt>
                  <dd className="order-total">{formatKobo(current.totalKobo)}</dd>
                </dl>
              </section>
              <section
                className="order-card order-payment"
                aria-labelledby="order-payment-title"
              >
                <div className="order-section-heading">
                  <CreditCard size={19} aria-hidden="true" />
                  <h2 id="order-payment-title" ref={paymentHeading} tabIndex={-1}>
                    {payment
                      ? "Payment request"
                      : review
                        ? "Review payment request"
                        : "Payment"}
                  </h2>
                </div>
                {payment ? (
                  <>
                    <p>{paymentMessages[payment.status]}</p>
                    <dl className="order-payment-facts">
                      <div>
                        <dt>Payment reference</dt>
                        <dd>{payment.paymentNumber}</dd>
                      </div>
                      <div>
                        <dt>Amount</dt>
                        <dd>{formatKobo(payment.amountKobo)}</dd>
                      </div>
                      <div>
                        <dt>Status</dt>
                        <dd>{paymentLabels[payment.status]}</dd>
                      </div>
                    </dl>
                    <Link className="button" href={`/dashboard/payments/${payment.id}`}>
                      View payment <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </>
                ) : review ? (
                  <>
                    <p>
                      Review the amount below. Creating a request does not take a payment.
                    </p>
                    <div className="order-review-amount">
                      <span>Order total</span>
                      <strong>{formatKobo(review.totalKobo)}</strong>
                    </div>
                    {review.paymentDueAt && (
                      <p className="order-deadline">
                        Payment deadline: {formatBusinessDate(review.paymentDueAt)}
                      </p>
                    )}
                    <Feedback
                      tone="warning"
                      message={
                        reviewChanged
                          ? "The order changed. Go back and review its current details."
                          : reviewUnavailable
                      }
                    />
                    <button
                      className="button"
                      disabled={disabled || reviewChanged || !!reviewUnavailable}
                      onClick={() => void preparePayment()}
                    >
                      {busy ? "Checking…" : "Create payment request"}
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                    <button
                      className="button secondary"
                      disabled={busy || !!uncertain}
                      onClick={() => {
                        setReview(undefined);
                        setError(undefined);
                      }}
                    >
                      Back to order
                    </button>
                  </>
                ) : (
                  <>
                    <p className="order-payment-state">
                      {current.paidAt ? "Payment recorded" : "Payment not recorded"}
                    </p>
                    {current.paidAt ? (
                      <p>
                        {current.status === "CANCELLED"
                          ? "Payment was received, but this order is cancelled. Contact customer care for help resolving the payment."
                          : "Payment is recorded for this order."}
                      </p>
                    ) : (
                      <>
                        {current.paymentDueAt && current.status !== "CANCELLED" && (
                          <p className="order-deadline">
                            Payment deadline: {formatBusinessDate(current.paymentDueAt)}
                          </p>
                        )}
                        {unavailable ? (
                          <p>{unavailable}</p>
                        ) : (
                          <p>Check any existing payment before starting another.</p>
                        )}
                        {["PENDING", "CONFIRMED"].includes(current.status) && (
                          <button
                            className="button"
                            disabled={disabled || !!unavailable}
                            onClick={() => void reviewPayment()}
                          >
                            {busy ? "Checking…" : "Review payment options"}
                            <ArrowRight size={16} aria-hidden="true" />
                          </button>
                        )}
                      </>
                    )}
                  </>
                )}
                {uncertain === "payment" && (
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => void preparePayment(true)}
                  >
                    {busy ? "Recovering…" : "Recover payment request"}
                  </button>
                )}
                <Link className="text-link order-full-link" href="/dashboard/payments">
                  Check all your payments <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </section>
            </div>
            <div className="order-main">
              <section
                className="order-card order-items"
                aria-labelledby="order-items-title"
              >
                <div className="order-section-heading">
                  <Package size={19} aria-hidden="true" />
                  <h2 id="order-items-title">
                    Order items <span>({current.items.length})</span>
                  </h2>
                </div>
                <p className="order-caption">
                  Products and prices recorded when you ordered.
                </p>
                <div className="order-lines">
                  {current.items.map((item) => (
                    <article className="order-line" key={item.id}>
                      <div className="order-product-icon" aria-hidden="true">
                        <Package size={24} strokeWidth={1.4} />
                      </div>
                      <div className="order-product">
                        <h3>
                          <Link href={`/parts/${item.productId}`}>
                            {item.productName}
                          </Link>
                        </h3>
                        <p>SKU: {item.sku}</p>
                        <p>
                          {item.quantity} × {formatKobo(item.unitPriceKobo)}
                        </p>
                      </div>
                      <div className="order-line-amount">
                        <span>Line subtotal</span>
                        <strong>{formatKobo(item.subtotalKobo)}</strong>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
              <section
                className="order-fulfilment"
                aria-labelledby="order-fulfilment-title"
              >
                <div className="order-section-heading">
                  <MapPin size={19} aria-hidden="true" />
                  <h2 id="order-fulfilment-title">
                    {current.fulfillmentMethod === "DELIVERY"
                      ? "Delivery details"
                      : "Collection details"}
                  </h2>
                </div>
                {current.fulfillmentMethod === "DELIVERY" ? (
                  current.deliveryAddress ? (
                    <div className="order-address">
                      <div>
                        {current.deliveryName && (
                          <p>
                            <strong>{current.deliveryName}</strong>
                          </p>
                        )}
                        {current.deliveryPhone && <p>{current.deliveryPhone}</p>}
                      </div>
                      <div>
                        <p>{current.deliveryAddress}</p>
                        <p>
                          {[
                            current.deliveryCity,
                            current.deliveryState,
                            current.deliveryCountry,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p>
                      Delivery details are unavailable for this record. Contact customer
                      care before proceeding.
                    </p>
                  )
                ) : (
                  <>
                    <p>
                      <strong>{current.branch.name}</strong>
                    </p>
                    <p>
                      Check the order status and confirm collection arrangements with the
                      team before travelling.
                    </p>
                  </>
                )}
              </section>
              <section
                className="order-card order-help"
                aria-labelledby="order-help-title"
              >
                <h2 id="order-help-title">Documents &amp; help</h2>
                {current.invoice ? (
                  <Link
                    className="order-document"
                    href={`/dashboard/invoices/${current.invoice.id}`}
                  >
                    <FileText size={20} aria-hidden="true" />
                    <span>
                      <strong>View invoice</strong>
                      <small>
                        {current.invoice.invoiceNumber} ·{" "}
                        {current.invoice.status.replaceAll("_", " ").toLowerCase()}
                      </small>
                    </span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                ) : (
                  <p className="order-caption">
                    An invoice is not available on this record.
                  </p>
                )}
                <Link
                  className="text-link order-full-link"
                  href={`/dashboard/orders/${orderId}/aftercare`}
                >
                  Returns and cancellation requests{" "}
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
                <Link className="text-link order-full-link" href="/dashboard/support">
                  Contact customer care <ArrowRight size={15} aria-hidden="true" />
                </Link>
                {current.status === "PENDING" && !current.paidAt && (
                  <button
                    ref={cancelButton}
                    className="button secondary order-cancel"
                    disabled={disabled}
                    onClick={() => {
                      setCancelReview(current);
                      setCancelOpen(true);
                      setError(undefined);
                      dialog.current?.showModal();
                    }}
                  >
                    Cancel order
                  </button>
                )}
              </section>
            </div>
          </div>
        </>
      )}
      <dialog
        ref={dialog}
        className="support-dialog order-cancel-dialog"
        aria-labelledby="cancel-order-title"
        onClose={() => setCancelOpen(false)}
        onCancel={(event) => {
          if (busyRef.current) event.preventDefault();
        }}
      >
        <p className="order-eyebrow">Cancellation request</p>
        <h2 id="cancel-order-title">Cancel this order?</h2>
        <p>
          Pending orders can be cancelled immediately. If processing has advanced, your
          request goes to staff for review. Check any pending payment before cancelling.
        </p>
        {cancelReview && (
          <div className="order-cancel-facts">
            <strong>{cancelReview.orderNumber}</strong>
            <span>{formatKobo(cancelReview.totalKobo)}</span>
          </div>
        )}
        <Feedback
          message={cancelOpen ? (error ?? order.error ?? order.refreshError) : undefined}
        />
        {cancelReview && current && current.version !== cancelReview.version && (
          <Feedback
            message="The order changed. Close this dialog and review its current details."
            tone="warning"
          />
        )}
        <form
          ref={cancelForm}
          data-draft-key={JSON.stringify(["order-detail:1", orderId])}
          onSubmit={(event) => {
            event.preventDefault();
            void cancel(String(new FormData(event.currentTarget).get("reason")));
          }}
        >
          <div className="field">
            <label htmlFor="cancel-reason">Reason for cancellation</label>
            <textarea
              name="reason"
              id="cancel-reason"
              required
              maxLength={500}
              disabled={busy}
              aria-describedby="cancel-reason-hint"
            />
            <p id="cancel-reason-hint">Up to 500 characters. Use a single paragraph.</p>
          </div>
          <div className="actions">
            <button
              className="button secondary"
              type="button"
              disabled={busy}
              onClick={closeCancel}
            >
              Keep order
            </button>
            <button
              className="button danger"
              disabled={
                disabled ||
                !current ||
                !cancelReview ||
                current.version !== cancelReview.version
              }
            >
              {busy ? "Submitting…" : "Confirm cancellation"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
