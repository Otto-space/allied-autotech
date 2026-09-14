"use client";
import Link from "next/link";
import { useRef, useState } from "react";
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
const checkoutSchema = z.object({
  attemptId: z.string().uuid(),
  authorizationUrl: z.string().url(),
  authorizationExpiresAt: z.string(),
});
export function PaymentDetail({ paymentId }: { paymentId: string }) {
  const payment = useResource(
    `/customers/payments/${encodeURIComponent(paymentId)}`,
    parsePayment,
  );
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [uncertain, setUncertain] = useState(false);
  const [providerAttempt, setProviderAttempt] = useState<"paystack" | "monnify">();
  const keys = useRef(new Map<string, string>());
  async function initialize(provider: "paystack" | "monnify") {
    if (busyRef.current || payment.data?.status !== "REQUIRES_PAYMENT") return;
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
      const verified = parsePayment(result.data);
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
      <Feedback message={message} tone="info" />
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
          <div className="actions">
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
                    disabled={busy}
                    onClick={() => void initialize("paystack")}
                  >
                    Continue with Paystack
                  </button>
                  <button
                    className="button secondary"
                    disabled={busy}
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
                disabled={busy || current.status !== "REQUIRES_PAYMENT"}
                onClick={() => void initialize(providerAttempt)}
              >
                Reopen the same checkout
              </button>
            </div>
          )}
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
                        disabled={busy}
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
