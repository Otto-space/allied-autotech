"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  orderPaymentAcceptedReview,
  orderPaymentUnavailable,
} from "@/lib/api/order-payment";
import { purchaseRequest } from "@/lib/purchase/client";
import { usePurchaseResource } from "@/lib/purchase/resource";
import {
  guestCheckoutKey,
  guestIntentKey,
  parseGuestOrder,
  parseGuestOrders,
  parseGuestPayment,
  type GuestOrder,
  type GuestPayment,
} from "@/lib/purchase/records";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import {
  paymentDeadlineUnavailable,
  newPaymentAttemptUnavailable,
  validatedCheckout,
  type CheckoutProvider,
} from "@/lib/api/payment-checkout";
import { paymentMessage } from "@/lib/api/payment-schemas";
import { Feedback } from "./feedback";
import { PurchaseSuitability } from "./purchase-suitability";
import { PurchaseAccess, EndPurchaseAccess } from "./purchase-access";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { StatusBadge } from "./status-progress";
import { BookingReference } from "./booking-reference";
import { usePublicCapabilities } from "./public-capabilities";
import { PurchaseQuotations } from "./purchase-quotations";
import { DocumentActions } from "./document-actions";

function usePurchaseClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

export function PurchaseHistory() {
  return (
    <>
      <p className="purchase-kicker">Private purchase access</p>
      <h1>Your purchases</h1>
      <PurchaseAccess>{(email) => <OrderHistory email={email} />}</PurchaseAccess>
    </>
  );
}
function OrderHistory({ email }: { email: string }) {
  const pagination = useCursorPage();
  const resource = usePurchaseResource(
    `/purchase/orders?limit=10${pagination.cursor ? `&cursor=${encodeURIComponent(pagination.cursor)}` : ""}`,
    parseGuestOrders,
  );
  return (
    <>
      <section className="purchase-panel">
        <p className="purchase-reference">Verified email: {email}</p>
        <p>
          These are purchases made with private purchase access. Account orders remain in
          your customer dashboard.
        </p>
        <Link className="purchase-link" href="/cart">
          Review cart
        </Link>
        <Link className="purchase-link" href="/dashboard/orders">
          Open account orders
        </Link>
      </section>
      <PurchaseQuotations />
      {resource.loading && <p role="status">Loading your purchases…</p>}
      {resource.failed && (
        <section className="purchase-panel">
          <Feedback message="Your purchases could not be loaded. No order or payment has been changed." />
          <button className="button secondary" onClick={resource.refresh}>
            Retry purchases
          </button>
        </section>
      )}
      {resource.data && (
        <section className="purchase-panel" aria-label="Purchase orders">
          {resource.data.items.length === 0 ? (
            <>
              <h2>No purchases yet</h2>
              <p>
                Choose products and review your cart, or use the email associated with an
                existing guest purchase.
              </p>
              <Link className="button" href="/parts">
                Browse parts
              </Link>
            </>
          ) : (
            resource.data.items.map((order) => (
              <article className="purchase-history-row" key={order.id}>
                <div>
                  <h2>{order.orderNumber}</h2>
                  <p>
                    {formatBusinessDate(order.createdAt)} · {order.branch.name}
                  </p>
                  <StatusBadge status={order.status} />
                  <p>
                    {order.status === "CANCELLED"
                      ? "Check payment outcome"
                      : order.paidAt
                        ? "Payment recorded"
                        : "Payment not recorded"}{" "}
                    · {formatKobo(order.totalKobo)}
                  </p>
                </div>
                <Link className="button secondary" href={`/purchase/orders/${order.id}`}>
                  View details<span className="sr-only"> for {order.orderNumber}</span>
                </Link>
              </article>
            ))
          )}
          <CursorPagination
            pagination={pagination}
            nextCursor={resource.data.nextCursor}
            disabled={resource.loading}
            label="Purchases"
          />
        </section>
      )}
      <EndPurchaseAccess />
    </>
  );
}
function OrderSummary({ order }: { order: GuestOrder }) {
  return (
    <section className="purchase-panel">
      <div className="purchase-actions">
        <h2>Order details</h2>
        <StatusBadge status={order.status} />
      </div>
      <BookingReference label="Order reference" id={order.orderNumber} />
      <p>{order.branch.name} · Collection only</p>
      <ul className="purchase-item-list">
        {order.items.map((item) => (
          <li key={item.id}>
            <span>
              {item.productName}
              <small>
                Quantity {item.quantity} · {formatKobo(item.unitPriceKobo)} each
              </small>
            </span>
            <strong>{formatKobo(item.subtotalKobo)}</strong>
          </li>
        ))}
      </ul>
      <dl className="purchase-summary">
        <div>
          <dt>Products</dt>
          <dd>{formatKobo(order.subtotalKobo)}</dd>
        </div>
        <div>
          <dt>Discount</dt>
          <dd>
            {BigInt(order.discountAmountKobo) > BigInt(0) ? "−" : ""}
            {formatKobo(order.discountAmountKobo)}
          </dd>
        </div>
        <div>
          <dt>Tax</dt>
          <dd>
            {order.taxKobo === undefined ? "Unavailable" : formatKobo(order.taxKobo)}
          </dd>
        </div>
        <div className="purchase-total">
          <dt>Total</dt>
          <dd>{formatKobo(order.totalKobo)}</dd>
        </div>
      </dl>
      <p className="purchase-note">
        {order.status === "READY"
          ? "Your order is marked ready. Follow the team's collection instructions."
          : order.status === "COMPLETED"
            ? "Collection is recorded as complete. Contact the team if you need help with this order."
            : order.status === "CANCELLED"
              ? "This order is cancelled. If you paid, check its payment status or contact the team about the outcome."
              : order.paidAt
                ? "Payment is recorded. Wait for a ready-for-collection confirmation before travelling."
                : "No payment is recorded. Suitability and availability must be confirmed before payment. Review the itemised total before continuing."}
      </p>
      {order.paymentDueAt && !order.paidAt && (
        <p>Payment deadline: {formatBusinessDate(order.paymentDueAt)}</p>
      )}
      {order.invoice && (
        <Link className="purchase-link" href={`/purchase/invoices/${order.invoice.id}`}>
          View invoice
        </Link>
      )}
    </section>
  );
}
export function PurchaseOrderPage({ orderId }: { orderId: string }) {
  return (
    <>
      <p className="purchase-kicker">Private purchase access</p>
      <h1>Review your order</h1>
      <PurchaseAccess>{() => <OrderDetail orderId={orderId} />}</PurchaseAccess>
    </>
  );
}
function OrderDetail({ orderId }: { orderId: string }) {
  const now = usePurchaseClock();
  const resource = usePurchaseResource(`/purchase/orders/${orderId}`, parseGuestOrder),
    router = useRouter();
  const { checkoutEnabled } = usePublicCapabilities();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string>();
  const locked = useRef(false);
  async function prepare(order: GuestOrder) {
    if (locked.current || !checkoutEnabled || !!orderPaymentUnavailable(order)) return;
    locked.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const result = await purchaseRequest("/purchase/payments", {
        method: "POST",
        idempotencyKey: guestIntentKey(order.id),
        body: { orderId: order.id, acceptedReview: orderPaymentAcceptedReview(order) },
      });
      const receipt = z
        .object({
          payment: z.object({
            id: z.uuid(),
            orderId: z.uuid(),
            amountKobo: z.string().regex(/^\d+$/),
            currency: z.literal("NGN"),
          }),
        })
        .parse(result.data);
      if (
        receipt.payment.orderId !== order.id ||
        receipt.payment.amountKobo !== order.totalKobo
      )
        throw Error("Payment does not match order");
      router.push(`/purchase/payments/${receipt.payment.id}`);
    } catch {
      setError(
        "The payment could not be prepared. Refresh the order before continuing. Repeating this action uses the same request and does not take payment.",
      );
      resource.refresh();
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      {resource.loading && <p role="status">Checking your order…</p>}
      {resource.failed && (
        <section className="purchase-panel">
          <Feedback message="This order could not be opened with the current purchase access. Check your email or try again." />
          <button className="button secondary" onClick={resource.refresh}>
            Retry order
          </button>
        </section>
      )}
      {resource.data && (
        <>
          <OrderSummary order={resource.data} />
          <PurchaseSuitability
            order={resource.data}
            guest
            disabled={
              !checkoutEnabled || busy || resource.loading || !!resource.data.paymentId
            }
            onSaved={resource.refresh}
            onBusyChange={setBusy}
          />
          <section className="purchase-panel">
            <h2>Changes and aftercare</h2>
            <Link
              className="purchase-link"
              href={`/purchase/orders/${resource.data.id}/aftercare`}
            >
              Review cancellation or return options
            </Link>
          </section>
          <section className="purchase-panel">
            <h2 id="purchase-next-step" tabIndex={-1}>
              Next step
            </h2>
            {resource.data.paymentId ? (
              <Link
                className="button"
                href={`/purchase/payments/${resource.data.paymentId}`}
              >
                View payment details
              </Link>
            ) : checkoutEnabled && !orderPaymentUnavailable(resource.data, now) ? (
              <>
                <p>
                  Continue to review the payment provider. Preparing a payment does not
                  charge you.
                </p>
                <button
                  className="button"
                  disabled={busy || resource.loading}
                  onClick={() => resource.data && void prepare(resource.data)}
                >
                  {busy ? "Preparing…" : "Review payment"}
                </button>
              </>
            ) : (
              <p>
                {orderPaymentUnavailable(resource.data, now) ??
                  "Contact the team if you need help with payment, changes or collection."}
              </p>
            )}
            <Feedback message={error} />
            <Link className="purchase-link" href="/contact#enquiry">
              Contact the team
            </Link>
          </section>
        </>
      )}
      <Link className="purchase-link" href="/purchase">
        All purchases
      </Link>
    </>
  );
}

export function PurchasePaymentPage({
  paymentId,
  returnedAttemptId,
}: {
  paymentId: string;
  returnedAttemptId?: string;
}) {
  return (
    <>
      <p className="purchase-kicker">Private purchase access</p>
      <h1>{returnedAttemptId ? "Check your payment" : "Review payment"}</h1>
      <PurchaseAccess>
        {() => (
          <PaymentDetail paymentId={paymentId} returnedAttemptId={returnedAttemptId} />
        )}
      </PurchaseAccess>
    </>
  );
}
function PaymentDetail({
  paymentId,
  returnedAttemptId,
}: {
  paymentId: string;
  returnedAttemptId?: string;
}) {
  const resource = usePurchaseResource(
    `/purchase/payments/${paymentId}`,
    parseGuestPayment,
  );
  if (resource.loading) return <p role="status">Checking the recorded payment status…</p>;
  if (!resource.data)
    return (
      <section className="purchase-panel">
        <Feedback message="This payment could not be opened with the current purchase access. Nothing in the return address proves payment." />
        <button className="button secondary" onClick={resource.refresh}>
          Retry payment
        </button>
        <Link className="purchase-link" href="/purchase">
          View purchases
        </Link>
      </section>
    );
  return (
    <PaymentOrder
      key={resource.data.id}
      payment={resource.data}
      returnedAttemptId={returnedAttemptId}
      refresh={resource.refresh}
    />
  );
}
function PaymentOrder({
  payment,
  returnedAttemptId,
  refresh,
}: {
  payment: GuestPayment;
  returnedAttemptId?: string;
  refresh: () => void;
}) {
  const source = usePurchaseResource(
    `/purchase/orders/${payment.orderId}`,
    parseGuestOrder,
  );
  if (source.loading)
    return <p role="status">Checking the source order and exact total…</p>;
  if (
    !source.data ||
    source.data.id !== payment.orderId ||
    source.data.totalKobo !== payment.amountKobo ||
    payment.currency !== source.data.currency
  )
    return (
      <section className="purchase-panel">
        <Feedback message="The payment and order could not be matched. Contact the team before paying." />
        <button className="button secondary" onClick={source.refresh}>
          Retry order check
        </button>
      </section>
    );
  return (
    <div className="purchase-grid">
      <OrderSummary order={source.data} />
      {payment.status === "SUCCEEDED" && (
        <section className="purchase-panel">
          <h2>Payment receipt</h2>
          <p>
            Download or share the receipt for the verified payment. It does not confirm
            collection readiness.
          </p>
          <DocumentActions purchase kind="receipt" id={payment.id} />
        </section>
      )}
      <GatewayPayment
        payment={payment}
        returnedAttemptId={returnedAttemptId}
        refresh={refresh}
      />
    </div>
  );
}
function GatewayPayment({
  payment,
  returnedAttemptId,
  refresh,
}: {
  payment: GuestPayment;
  returnedAttemptId?: string;
  refresh: () => void;
}) {
  const now = usePurchaseClock();
  const { checkoutEnabled } = usePublicCapabilities();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string>(),
    [checkout, setCheckout] = useState<ReturnType<typeof validatedCheckout>>(),
    [provider, setProvider] = useState<CheckoutProvider>(),
    [uncertain, setUncertain] = useState(false);
  const lock = useRef(false);
  const unresolved = payment.attempts.find(
    (attempt) => !["FAILED", "CANCELLED", "ABANDONED"].includes(attempt.status),
  );
  const deadline = paymentDeadlineUnavailable(payment, now);
  const checkoutExpired =
    !!checkout && Date.parse(checkout.authorizationExpiresAt) <= now;
  const unavailable = newPaymentAttemptUnavailable(payment, now);
  const currentAttempt = returnedAttemptId
    ? payment.attempts.find((v) => v.id === returnedAttemptId)
    : undefined;
  async function initialize(selected: CheckoutProvider, attemptNumber: number) {
    if (
      lock.current ||
      !checkoutEnabled ||
      deadline ||
      payment.reversalReported ||
      ["SUCCEEDED", "REQUIRES_REVIEW", "EXPIRED", "CANCELLED"].includes(payment.status)
    )
      return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    setCheckout(undefined);
    setProvider(selected);
    try {
      const response = await purchaseRequest(
        `/purchase/payments/${payment.id}/checkout`,
        {
          method: "POST",
          body: { provider: selected },
          idempotencyKey: guestCheckoutKey(payment.id, selected, attemptNumber),
        },
      );
      setCheckout(validatedCheckout(response.data, selected));
    } catch {
      setUncertain(true);
      setError(
        "Checkout could not be confirmed. Check the payment status before trying again. The same attempt will be recovered when available.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function verify(attemptId: string) {
    if (lock.current || !checkoutEnabled) return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    setCheckout(undefined);
    try {
      await purchaseRequest(
        `/purchase/payments/${payment.id}/attempts/${attemptId}/verify`,
        { method: "POST", body: {} },
      );
      refresh();
    } catch {
      setError(
        "The provider's result could not be confirmed. Do not pay again while it is uncertain. Refresh or contact the team.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="purchase-panel">
      <h2>Payment</h2>
      <StatusBadge status={payment.status} />
      <BookingReference label="Payment reference" id={payment.paymentNumber} />
      <p>
        <strong>{formatKobo(payment.amountKobo)}</strong>
      </p>
      <p>{paymentMessage(payment)}</p>
      {returnedAttemptId && !currentAttempt && (
        <Feedback message="The returned attempt does not match this payment. Only the recorded payment status is shown." />
      )}
      {deadline && <Feedback message={deadline} tone="info" />}
      {checkoutExpired && (
        <Feedback
          message="This checkout link expired. Refresh the recorded payment status before continuing."
          tone="info"
        />
      )}
      {!checkoutEnabled && (
        <p>
          Online payment actions are currently unavailable. Your recorded payment and
          order remain available here.
        </p>
      )}
      {checkout && checkoutEnabled && !checkoutExpired ? (
        <>
          <p>
            Review the total above. Continue to{" "}
            {provider === "PAYSTACK" ? "Paystack" : "Monnify"} to choose a payment method.
          </p>
          <a
            className="button"
            href={checkout.authorizationUrl}
            onClick={(event) => {
              if (
                !checkoutEnabled ||
                Date.parse(checkout.authorizationExpiresAt) <= Date.now()
              ) {
                event.preventDefault();
                setCheckout(undefined);
                setError(
                  "Checkout availability changed or the link expired. Refresh its status before continuing.",
                );
              }
            }}
          >
            Continue to {provider === "PAYSTACK" ? "Paystack" : "Monnify"}
          </a>
          <p className="purchase-secondary">
            This link expires at {formatBusinessDate(checkout.authorizationExpiresAt)}.
          </p>
        </>
      ) : (
        checkoutEnabled && (
          <>
            {unresolved &&
              unresolved.provider !== "MANUAL" &&
              payment.status !== "SUCCEEDED" && (
                <div className="purchase-actions">
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => void verify(unresolved.id)}
                  >
                    Check payment with provider
                  </button>
                  {!deadline &&
                    !payment.reversalReported &&
                    ["INITIALIZED", "PENDING", "PROCESSING"].includes(
                      unresolved.status,
                    ) && (
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={() =>
                          void initialize(
                            unresolved.provider as CheckoutProvider,
                            unresolved.attemptNumber,
                          )
                        }
                      >
                        Recover{" "}
                        {unresolved.provider === "PAYSTACK" ? "Paystack" : "Monnify"}{" "}
                        checkout
                      </button>
                    )}
                </div>
              )}
            {!unavailable && !uncertain && !checkoutExpired && (
              <div className="purchase-actions">
                {(payment.checkoutProviders ?? []).map((selected) => (
                  <button
                    key={selected}
                    className="button"
                    disabled={busy}
                    onClick={() =>
                      void initialize(
                        selected,
                        Math.max(0, ...payment.attempts.map((v) => v.attemptNumber)) + 1,
                      )
                    }
                  >
                    Prepare {selected === "PAYSTACK" ? "Paystack" : "Monnify"} checkout
                  </button>
                ))}
              </div>
            )}
            {!unavailable && !payment.checkoutProviders?.length && (
              <p>
                No online payment provider is currently available. Contact the team before
                making a transfer.
              </p>
            )}
          </>
        )
      )}
      <Feedback message={error} />
      <div className="purchase-actions">
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => {
            setCheckout(undefined);
            refresh();
          }}
        >
          Refresh recorded status
        </button>
        <Link className="purchase-link" href={`/purchase/orders/${payment.orderId}`}>
          View order
        </Link>
      </div>
      <Link className="purchase-link" href="/contact#enquiry">
        Contact customer care
      </Link>
    </section>
  );
}
