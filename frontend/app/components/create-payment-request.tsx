"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { z } from "zod";
import { apiRequest, ApiError, newIdempotencyKey } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import { paymentSchema } from "@/lib/api/payment-schemas";
import { formatKobo } from "@/lib/format/money";
import { Feedback } from "./feedback";

export function CreatePaymentRequest({
  target,
  label,
}: {
  target: RequestBody<"/customers/payments", "post">;
  label: string;
}) {
  const attempt = useRef<{ key: string; body: typeof target } | null>(null);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [uncertain, setUncertain] = useState(false);
  const [existingRequest, setExistingRequest] = useState(false);
  const [payment, setPayment] = useState<z.infer<typeof paymentSchema>>();
  async function create() {
    if (busyRef.current || payment || existingRequest) return;
    busyRef.current = true;
    setBusy(true);
    setError(undefined);
    attempt.current ??= { key: newIdempotencyKey(), body: target };
    try {
      const response = await apiRequest("/customers/payments", {
        method: "POST",
        csrf: true,
        idempotencyKey: attempt.current.key,
        body: attempt.current.body,
      });
      const data = z.object({ payment: paymentSchema }).parse(response.data);
      setPayment(data.payment);
      setUncertain(false);
    } catch (value) {
      const rejected =
        value instanceof ApiError && value.status >= 400 && value.status < 500;
      setUncertain(!rejected);
      setExistingRequest(rejected && value.code === "PAYMENT_TARGET_PENDING");
      setError(
        rejected
          ? value.message
          : "The payment request could not be confirmed. Check the same request or your payments before starting another.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="notice">
      <Feedback message={error} />
      {error && (
        <p>
          <Link className="button secondary" href="/dashboard/payments">
            View existing payments
          </Link>
        </p>
      )}
      {payment ? (
        <>
          <p>
            Payment request: {payment.paymentNumber} · {formatKobo(payment.amountKobo)}
          </p>
          <p>This request does not confirm a payment. Review its status before paying.</p>
          <Link className="button" href={`/dashboard/payments/${payment.id}`}>
            Review payment & checkout options
          </Link>
        </>
      ) : existingRequest ? (
        <p>Continue from the existing payment request, or refresh this invoice.</p>
      ) : (
        <>
          <p>
            The server will confirm the amount due before you choose a payment method.
          </p>
          <button className="button" disabled={busy} onClick={() => void create()}>
            {busy
              ? "Checking amount due…"
              : uncertain
                ? "Check the same payment request"
                : label}
          </button>
        </>
      )}
    </div>
  );
}
