"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  apiRequest,
  ApiError,
  newIdempotencyKey,
  openTrustedCheckout,
} from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { parsePayment, paymentMessages } from "@/lib/api/payment-schemas";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { Feedback } from "./feedback";
import { ManualPaymentForm } from "./manual-payment-form";
const checkoutSchema = z.object({
  attemptId: z.string().uuid(),
  authorizationUrl: z.string().url(),
  authorizationExpiresAt: z.string(),
});
export function PaymentDetail({ paymentId }: { paymentId: string }) {
  const parse = useCallback(
    (value: unknown) => {
      const record = parsePayment(value);
      if (record.id !== paymentId) throw new Error("Mismatched payment");
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
  const busyRef = useRef(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [uncertain, setUncertain] = useState(false);
  const [providerAttempt, setProviderAttempt] = useState<"paystack" | "monnify">();
  const keys = useRef(new Map<string, string>());
  const [now, setNow] = useState(() => Date.now());
  const deadline = payment.data?.expiresAt;
  const refreshPayment = payment.refresh;
  useEffect(() => {
    if (!deadline) return;
    const remaining = Date.parse(deadline) - Date.now();
    if (remaining <= 0) return;
    const timer = setTimeout(
      () => {
        setNow(Date.now());
        if (Date.parse(deadline) <= Date.now()) refreshPayment();
      },
      Math.min(remaining, 2147483647),
    );
    return () => clearTimeout(timer);
  }, [deadline, now, refreshPayment]);
  async function initialize(provider: "paystack" | "monnify") {
    if (
      busyRef.current ||
      manualActive ||
      payment.data?.status !== "REQUIRES_PAYMENT" ||
      (payment.data.expiresAt && Date.parse(payment.data.expiresAt) <= Date.now())
    )
      return;
    busyRef.current = true;
    setBusy(true);
    setError(undefined);
    setProviderAttempt(provider);
    if (!keys.current.has(provider)) keys.current.set(provider, newIdempotencyKey());
    try {
      const result = await apiRequest(`/customers/payments/${paymentId}/${provider}`, {
        method: "POST",
        csrf: true,
        body: {},
        idempotencyKey: keys.current.get(provider),
      });
      const checkout = checkoutSchema.parse(result.data);
      if (Date.parse(checkout.authorizationExpiresAt) <= Date.now()) {
        setError(
          "This checkout link has expired. Refresh the payment status before continuing.",
        );
        payment.refresh();
        return;
      }
      openTrustedCheckout(checkout.authorizationUrl);
    } catch (value) {
      setUncertain(
        !(value instanceof ApiError && value.status >= 400 && value.status < 500),
      );
      setError(
        value instanceof ApiError
          ? value.message
          : "Checkout could not be confirmed. Check your payment status before trying again.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function verify(attemptId: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    try {
      const result = await apiRequest(
        `/customers/payments/${paymentId}/attempts/${attemptId}/verify`,
        { method: "POST", csrf: true, body: {} },
      );
      const verified = parse(result.data);
      setMessage(paymentMessages[verified.status]);
      payment.refresh();
    } catch {
      setError(
        "We couldn’t confirm your payment yet. Check the payment status before trying again. Please avoid another payment while confirmation is pending.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  const current = payment.data;
  const pendingAttempt = current?.attempts.some(
    (attempt) => !["FAILED", "CANCELLED", "ABANDONED"].includes(attempt.status),
  );
  return (
    <>
      <Feedback message={error ?? payment.error} />
      <Feedback
        message={message}
        tone="info"
        toast="Payment status checked. Review the result."
      />
      {payment.loading && <p role="status">Checking payment status…</p>}
      <button
        className="button secondary"
        onClick={payment.refresh}
        disabled={payment.loading || busy}
      >
        Refresh payment status
      </button>
      {current && (
        <section className="detail-section">
          <h2>{current.paymentNumber}</h2>
          <p className="price">{formatKobo(current.amountKobo)}</p>
          <span className="status">{current.status.replaceAll("_", " ")}</span>
          <Feedback
            message={paymentMessages[current.status]}
            tone={current.status === "SUCCEEDED" ? "success" : "info"}
          />
          {current.expiresAt && (
            <p>Payment deadline: {formatBusinessDate(current.expiresAt)}</p>
          )}
          {current.status === "REQUIRES_PAYMENT" &&
            current.expiresAt &&
            Date.parse(current.expiresAt) <= now && (
              <p className="notice">
                The payment deadline has passed. Refresh its status and contact customer
                care if you already paid.
              </p>
            )}
          <div className="actions">
            {current.vehicleTransactionId && (
              <Link
                className="text-link"
                href={`/dashboard/vehicle-transactions/${current.vehicleTransactionId}`}
              >
                View vehicle purchase
              </Link>
            )}
            {current.orderId && (
              <Link className="text-link" href={`/dashboard/orders/${current.orderId}`}>
                View order →
              </Link>
            )}
            {current.bookingId && (
              <Link className="text-link" href="/dashboard/bookings">
                View booking →
              </Link>
            )}
            <Link className="text-link" href="/dashboard/support">
              Contact customer care →
            </Link>
          </div>
          {current.status === "REQUIRES_PAYMENT" &&
            (!current.expiresAt || Date.parse(current.expiresAt) > now) &&
            !pendingAttempt &&
            !payment.error &&
            !payment.loading &&
            !uncertain && (
              <div className="checkout-summary">
                <h3>Choose secure checkout</h3>
                <p>Your payment details are entered on the payment provider’s website.</p>
                <div className="actions">
                  <button
                    className="button"
                    disabled={busy || manualActive}
                    onClick={() => void initialize("paystack")}
                  >
                    Continue with Paystack
                  </button>
                  <button
                    className="button secondary"
                    disabled={busy || manualActive}
                    onClick={() => void initialize("monnify")}
                  >
                    Pay by bank with Monnify
                  </button>
                </div>
              </div>
            )}
          {uncertain && providerAttempt && (
            <div className="notice">
              <p>
                Checkout initiation is unconfirmed. Check your payment status first.
                Reopening below checks the same checkout request.
              </p>
              <button
                className="button secondary"
                disabled={busy || manualActive || current.status !== "REQUIRES_PAYMENT"}
                onClick={() => void initialize(providerAttempt)}
              >
                Reopen the same checkout
              </button>
            </div>
          )}
          <ManualPaymentForm
            payment={current}
            eligible={
              current.status === "REQUIRES_PAYMENT" &&
              !pendingAttempt &&
              !uncertain &&
              (!current.expiresAt || Date.parse(current.expiresAt) > now)
            }
            disabled={busy || !!payment.error || payment.loading}
            onActivity={setManualActive}
            onRefresh={payment.refresh}
            onRecorded={() => {
              setMessage(
                "Payment details submitted for review. Do not pay again while confirmation is pending.",
              );
              payment.refresh();
            }}
          />
          {current.attempts.length > 0 && (
            <section className="detail-section">
              <h3>Payment attempts</h3>
              <div className="list">
                {current.attempts.map((attempt) => (
                  <article className="list-item" key={attempt.id}>
                    <div>
                      <strong>{attempt.provider}</strong>
                      <p>
                        {attempt.status.replaceAll("_", " ")} ·{" "}
                        {attempt.verificationStatus.replaceAll("_", " ")}
                      </p>
                      <p className="muted">{formatBusinessDate(attempt.initiatedAt)}</p>
                    </div>
                    {attempt.provider !== "MANUAL" && (
                      <button
                        className="button secondary"
                        disabled={busy || manualActive}
                        onClick={() => void verify(attempt.id)}
                      >
                        Check with provider
                      </button>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}
        </section>
      )}
    </>
  );
}
