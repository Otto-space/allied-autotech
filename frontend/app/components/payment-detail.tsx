"use client";
import { NotificationRecordContext } from "./notification-record-context";
import { WorkflowProgress } from "./status-progress";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Clock3,
  CreditCard,
  FileText,
  History,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  apiRequest,
  ApiError,
  newIdempotencyKey,
  openTrustedCheckout,
  SESSION_CHANGED,
} from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import {
  parsePayment,
  paymentMessages,
  type PaymentRecord,
} from "@/lib/api/payment-schemas";
import {
  hasPendingPaymentAttempt,
  newPaymentAttemptUnavailable,
  paymentDeadlineUnavailable,
  paymentIdentity,
  validatedCheckout,
  type CheckoutProvider,
} from "@/lib/api/payment-checkout";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { Feedback } from "./feedback";
import { CopyControl } from "./copy-control";
import { ManualPaymentForm } from "./manual-payment-form";
import "./payment-detail.css";

const statusLabels: Record<PaymentRecord["status"], string> = {
  REQUIRES_PAYMENT: "Awaiting payment",
  PROCESSING: "Processing",
  REQUIRES_REVIEW: "Needs review",
  SUCCEEDED: "Confirmed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};
const purposeLabels: Record<string, string> = {
  SERVICE_INVOICE: "Service invoice payment",
  ORDER_PAYMENT: "Order payment",
  SERVICE_INVOICE_PAYMENT: "Service invoice payment",
  INVOICE_PAYMENT: "Invoice payment",
  VEHICLE_RESERVATION: "Vehicle reservation",
  VEHICLE_PARTIAL_PAYMENT: "Vehicle part payment",
  VEHICLE_BALANCE_PAYMENT: "Vehicle balance",
  VEHICLE_FULL_PAYMENT: "Vehicle purchase",
  BOOKING_DEPOSIT: "Booking payment",
};
function readable(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

export function PaymentDetail({ paymentId }: { paymentId: string }) {
  const parse = useCallback(
    (value: unknown) => {
      const record = parsePayment(value);
      if (record.id !== paymentId) throw new Error("Mismatched payment");
      if (
        new Set(record.attempts.map((attempt) => attempt.id)).size !==
        record.attempts.length
      )
        throw new Error("Duplicate payment attempt");
      return record;
    },
    [paymentId],
  );
  const payment = useResource(
    `/customers/payments/${encodeURIComponent(paymentId)}`,
    parse,
  );
  const [busy, setBusy] = useState(false);
  const [manualActive, setManualActive] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [uncertain, setUncertain] = useState(false);
  const [providerAttempt, setProviderAttempt] = useState<CheckoutProvider>();
  const [now, setNow] = useState(() => Date.now());
  const busyRef = useRef(false);
  const active = useRef(true);
  const pending = useRef<AbortController | null>(null);
  const keys = useRef(new Map<CheckoutProvider, string>());
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    active.current = true;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const discard = () => {
      active.current = false;
      pending.current?.abort();
      keys.current.clear();
      setError(undefined);
      setMessage(undefined);
      setProviderAttempt(undefined);
    };
    window.addEventListener(SESSION_CHANGED, discard);
    return () => {
      active.current = false;
      pending.current?.abort();
      clearInterval(timer);
      window.removeEventListener(SESSION_CHANGED, discard);
    };
  }, []);
  const current = payment.data;
  const readBlocked =
    payment.loading || payment.refreshing || !!payment.error || !!payment.refreshError;
  const disabled = busy || manualActive || readBlocked;
  const pendingAttempt = !!current && hasPendingPaymentAttempt(current);
  const unavailable = current ? newPaymentAttemptUnavailable(current, now) : undefined;
  const deadlineUnavailable = current
    ? paymentDeadlineUnavailable(current, now)
    : undefined;
  const providers = current?.checkoutProviders ?? [];
  function live(controller: AbortController) {
    return active.current && !controller.signal.aborted;
  }
  function begin() {
    if (!active.current || busyRef.current) return;
    const controller = new AbortController();
    pending.current = controller;
    busyRef.current = true;
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    return controller;
  }
  function finish(controller: AbortController) {
    if (pending.current !== controller) return;
    pending.current = null;
    busyRef.current = false;
    if (live(controller)) setBusy(false);
    controller.abort();
  }
  async function initialize(provider: CheckoutProvider, recover = false) {
    if (disabled || !current || !providers.includes(provider)) return;
    if (
      recover
        ? !uncertain ||
          providerAttempt !== provider ||
          !keys.current.has(provider) ||
          current.status !== "REQUIRES_PAYMENT" ||
          !!paymentDeadlineUnavailable(current)
        : uncertain || !!newPaymentAttemptUnavailable(current)
    )
      return;
    const controller = begin();
    if (!controller) return;
    let sent = false,
      leaving = false;
    try {
      if (!recover) {
        const response = await apiRequest(
          `/customers/payments/${encodeURIComponent(paymentId)}`,
          { signal: controller.signal },
        );
        if (!live(controller)) return;
        const latest = parse(response.data);
        if (
          paymentIdentity(latest) !== paymentIdentity(current) ||
          newPaymentAttemptUnavailable(latest) ||
          !(latest.checkoutProviders ?? []).includes(provider)
        ) {
          setError(
            "Payment options changed. Review the refreshed status before continuing.",
          );
          payment.refresh();
          return;
        }
      }
      if (!live(controller)) return;
      if (!keys.current.has(provider)) keys.current.set(provider, newIdempotencyKey());
      setProviderAttempt(provider);
      sent = true;
      const result = await apiRequest(
        `/customers/payments/${encodeURIComponent(paymentId)}/${provider.toLowerCase()}`,
        {
          method: "POST",
          csrf: true,
          body: {},
          idempotencyKey: keys.current.get(provider),
          signal: controller.signal,
        },
      );
      if (!live(controller)) return;
      const checkout = validatedCheckout(result.data, provider);
      setMessage(
        "Opening the payment provider. Payment is confirmed only after server verification.",
      );
      openTrustedCheckout(checkout.authorizationUrl);
      leaving = true;
    } catch (value) {
      if (!live(controller)) return;
      const known =
        value instanceof ApiError && value.status >= 400 && value.status < 500;
      if (sent && (!known || recover)) setUncertain(true);
      else if (known) {
        keys.current.delete(provider);
        payment.refresh();
      }
      setError(
        value instanceof ApiError
          ? value.message
          : sent
            ? "Checkout could not be confirmed. Check your payment status before trying again."
            : "The payment could not be rechecked. No checkout request was sent.",
      );
    } finally {
      if (!leaving) finish(controller);
    }
  }
  async function verify(attemptId: string) {
    if (disabled || !current) return;
    const attempt = current.attempts.find((entry) => entry.id === attemptId);
    if (
      !attempt ||
      attempt.provider === "MANUAL" ||
      !providers.includes(attempt.provider)
    )
      return;
    const controller = begin();
    if (!controller) return;
    try {
      const result = await apiRequest(
        `/customers/payments/${encodeURIComponent(paymentId)}/attempts/${encodeURIComponent(attemptId)}/verify`,
        {
          method: "POST",
          csrf: true,
          body: {},
          signal: controller.signal,
        },
      );
      if (!live(controller)) return;
      const verified = parse(result.data);
      if (
        paymentIdentity(verified) !== paymentIdentity(current) ||
        !verified.attempts.some(
          (entry) => entry.id === attemptId && entry.provider === attempt.provider,
        )
      )
        throw new Error("Unexpected verification receipt");
      setMessage(paymentMessages[verified.status]);
      payment.refresh();
    } catch (value) {
      if (live(controller))
        setError(
          value instanceof ApiError
            ? value.message
            : "We couldn’t confirm your payment yet. Check the payment status before trying again. Please avoid another payment while confirmation is pending.",
        );
    } finally {
      finish(controller);
    }
  }
  function focusHeading() {
    requestAnimationFrame(() => {
      if (active.current) heading.current?.focus({ preventScroll: true });
    });
  }
  return (
    <div className="customer-payment">
      <nav className="payment-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/dashboard">Overview</Link>
        <span aria-hidden="true">/</span>
        <Link href="/dashboard/payments">Payments</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{current?.paymentNumber ?? "Payment details"}</span>
      </nav>
      <header className="payment-heading">
        <div>
          <p className="payment-eyebrow">Payments &amp; invoices</p>
          <h1 ref={heading} tabIndex={-1}>
            Payment status
          </h1>
          <p>Review your payment and its latest recorded status.</p>
        </div>
        <button
          className="button secondary"
          onClick={payment.refresh}
          disabled={payment.loading || busy}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Refresh payment status
        </button>
      </header>
      <Feedback message={error ?? payment.error ?? payment.refreshError} />
      <Feedback message={message} tone="info" />
      {payment.loading && (
        <p className="payment-loading" role="status">
          Checking payment status…
        </p>
      )}
      {current &&
        !payment.loading &&
        !payment.refreshing &&
        !payment.error &&
        !payment.refreshError && (
          <NotificationRecordContext resourceType="PAYMENT" resourceId={current.id} />
        )}
      {current && (
        <div className="payment-layout" data-compact={!!unavailable || uncertain}>
          <div className="payment-overview">
            <WorkflowProgress workflow="payment" status={current.status} />
            <section
              className="payment-summary"
              aria-labelledby="payment-reference-title"
            >
              <p className="payment-eyebrow">Payment reference</p>
              <h2 id="payment-reference-title">{current.paymentNumber}</h2>
              <div className="payment-copy">
                <label className="sr-only" htmlFor="payment-reference">
                  Payment reference
                </label>
                <input id="payment-reference" readOnly value={current.paymentNumber} />
                <CopyControl
                  value={current.paymentNumber}
                  label="Copy payment reference"
                  fieldId="payment-reference"
                />
              </div>
              <div className="payment-amount">
                <span>
                  {current.status === "SUCCEEDED"
                    ? "Confirmed amount"
                    : "Requested amount"}
                </span>
                <strong>{formatKobo(current.amountKobo)}</strong>
                <span>{purposeLabels[current.purpose] ?? readable(current.purpose)}</span>
              </div>
              <div className="payment-state">
                {current.status === "SUCCEEDED" ? (
                  <Check size={20} aria-hidden="true" />
                ) : (
                  <Clock3 size={20} aria-hidden="true" />
                )}
                <span className="status" data-status={current.status}>
                  {statusLabels[current.status]}
                </span>
              </div>
              <p className="payment-status-message">{paymentMessages[current.status]}</p>
              {current.expiresAt !== null && (
                <div className="payment-deadline">
                  <span>
                    {current.status === "SUCCEEDED"
                      ? "Original payment deadline"
                      : "Payment deadline"}
                  </span>
                  <strong>{formatBusinessDate(current.expiresAt)}</strong>
                </div>
              )}
            </section>
            <section className="payment-related" aria-labelledby="payment-related-title">
              <h2 id="payment-related-title">Related records &amp; help</h2>
              {current.orderId && (
                <Link href={`/dashboard/orders/${current.orderId}`}>
                  <FileText size={17} aria-hidden="true" />
                  <span>View order</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              )}
              {current.invoiceId && (
                <Link href={`/dashboard/invoices/${current.invoiceId}`}>
                  <FileText size={17} aria-hidden="true" />
                  <span>View invoice</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              )}
              {current.vehicleTransactionId && (
                <Link
                  href={`/dashboard/vehicle-transactions/${current.vehicleTransactionId}`}
                >
                  <FileText size={17} aria-hidden="true" />
                  <span>View vehicle purchase</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              )}
              {current.bookingId && (
                <Link href={`/dashboard/bookings/${current.bookingId}`}>
                  <FileText size={17} aria-hidden="true" />
                  <span>View booking</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              )}
              <Link href="/dashboard/support">
                <ShieldCheck size={17} aria-hidden="true" />
                <span>Contact customer care</span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </section>
          </div>
          <div className="payment-workspace">
            {current.status === "REQUIRES_PAYMENT" && (
              <section
                className="payment-checkout"
                aria-labelledby="payment-checkout-title"
              >
                <div className="payment-section-heading">
                  <CreditCard size={20} aria-hidden="true" />
                  <h2 id="payment-checkout-title">Choose secure checkout</h2>
                </div>
                {unavailable ? (
                  <p className="payment-guidance">{unavailable}</p>
                ) : uncertain ? (
                  <p className="payment-guidance">
                    Checkout initiation is unconfirmed. Check your payment status first.
                    Reopening below checks the same checkout request.
                  </p>
                ) : providers.length ? (
                  <>
                    <p>
                      Your payment details are entered on the payment provider’s website.
                    </p>
                    <div className="payment-provider-actions">
                      {providers.includes("PAYSTACK") && (
                        <button
                          className="button"
                          disabled={disabled}
                          onClick={() => void initialize("PAYSTACK")}
                        >
                          Continue with Paystack
                          <ArrowRight size={16} aria-hidden="true" />
                        </button>
                      )}
                      {providers.includes("MONNIFY") && (
                        <button
                          className="button secondary"
                          disabled={disabled}
                          onClick={() => void initialize("MONNIFY")}
                        >
                          Pay by bank with Monnify
                          <ArrowRight size={16} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    <p className="payment-provider-note">
                      <ShieldCheck size={17} aria-hidden="true" />
                      Returning from checkout does not confirm payment. Check the recorded
                      status here.
                    </p>
                  </>
                ) : (
                  <p className="payment-guidance">
                    Online checkout is currently unavailable. Contact customer care for
                    payment instructions.
                  </p>
                )}
                {uncertain && providerAttempt && (
                  <div className="payment-recovery">
                    <p>Use the original request to avoid starting another checkout.</p>
                    <button
                      className="button secondary"
                      disabled={
                        disabled ||
                        !!deadlineUnavailable ||
                        !providers.includes(providerAttempt)
                      }
                      onClick={() => void initialize(providerAttempt, true)}
                    >
                      Reopen the same checkout
                    </button>
                  </div>
                )}
              </section>
            )}
            {current.status !== "REQUIRES_PAYMENT" && (
              <section
                className="payment-outcome"
                aria-labelledby="payment-outcome-title"
              >
                <div className="payment-section-heading">
                  <ShieldCheck size={22} aria-hidden="true" />
                  <h2 id="payment-outcome-title">
                    {current.status === "SUCCEEDED"
                      ? "Payment confirmed"
                      : "Review your payment status"}
                  </h2>
                </div>
                <p>
                  Use the related record to check fulfilment, or contact customer care if
                  you need help.
                </p>
              </section>
            )}
            <ManualPaymentForm
              key={current.id}
              payment={current}
              eligible={!unavailable && !uncertain}
              disabled={busy || readBlocked}
              onActivity={setManualActive}
              onRefresh={payment.refresh}
              onRecorded={() => {
                setMessage(
                  "Payment details submitted for review. Do not pay again while confirmation is pending.",
                );
                payment.refresh();
                focusHeading();
              }}
            />
          </div>
          <section className="payment-attempts" aria-labelledby="payment-attempts-title">
            <div className="payment-section-heading">
              <History size={20} aria-hidden="true" />
              <h2 id="payment-attempts-title">
                Payment attempts <span>({current.attempts.length})</span>
              </h2>
            </div>
            <p className="payment-attempts-caption">
              Recorded attempts for this payment reference.
            </p>
            {current.attempts.length ? (
              <div className="payment-attempt-list">
                {current.attempts.map((attempt, index) => (
                  <article className="payment-attempt" key={attempt.id}>
                    <div className="payment-attempt-number" aria-hidden="true">
                      {index + 1}
                    </div>
                    <div className="payment-attempt-info">
                      <h3>
                        {attempt.provider === "MANUAL"
                          ? "Direct payment"
                          : attempt.provider === "PAYSTACK"
                            ? "Paystack"
                            : "Monnify"}
                      </h3>
                      <p>{formatBusinessDate(attempt.initiatedAt)}</p>
                      <p>
                        <strong>{readable(attempt.status)}</strong> ·{" "}
                        {readable(attempt.verificationStatus)}
                      </p>
                      {attempt.paidAt && (
                        <p>Paid at: {formatBusinessDate(attempt.paidAt)}</p>
                      )}
                    </div>
                    {attempt.provider !== "MANUAL" && (
                      <div className="payment-attempt-action">
                        <button
                          className="button secondary"
                          disabled={disabled || !providers.includes(attempt.provider)}
                          onClick={() => void verify(attempt.id)}
                        >
                          Check with provider
                        </button>
                        {!providers.includes(attempt.provider) && (
                          <p>Provider checking is unavailable. Contact customer care.</p>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="payment-empty">
                <History size={24} aria-hidden="true" />
                <div>
                  <h3>No payment attempts yet</h3>
                  <p>Recorded online and direct-payment submissions will appear here.</p>
                </div>
              </div>
            )}
            {pendingAttempt && current.status !== "SUCCEEDED" && (
              <p className="payment-attempts-note">
                An unresolved attempt is not proof that a payment failed. Check its status
                before paying again.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
