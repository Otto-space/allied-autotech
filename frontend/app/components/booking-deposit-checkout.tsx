"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiRequest, newIdempotencyKey, SESSION_CHANGED } from "@/lib/api/client";
import type { CustomerBookingDetail } from "@/lib/api/customer-booking-detail-schema";
import { formatKobo } from "@/lib/format/money";
import { usePublicCapabilities } from "./public-capabilities";

/** An explicit, staging-gated agreement. The server calculates and validates the charge. */
export function BookingDepositCheckout({
  booking,
  fresh,
  onRefresh,
}: {
  booking: CustomerBookingDetail;
  fresh: boolean;
  onRefresh: () => void;
}) {
  const { bookingDepositsEnabled } = usePublicCapabilities();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [uncertain, setUncertain] = useState(false);
  const [paymentId, setPaymentId] = useState<string>();
  const key = useRef<string | undefined>(undefined);
  const pending = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const clear = () => {
      pending.current?.abort();
      pending.current = null;
      key.current = undefined;
      setAgreed(false);
      setPaymentId(undefined);
      setUncertain(false);
      setBusy(false);
    };
    window.addEventListener(SESSION_CHANGED, clear);
    return () => {
      mounted.current = false;
      pending.current?.abort();
      window.removeEventListener(SESSION_CHANGED, clear);
    };
  }, []);
  const quote = booking.quotes.reduce<(typeof booking.quotes)[number] | null>(
    (latest, item) => (!latest || item.version > latest.version ? item : latest),
    null,
  );
  if (
    booking.status !== "CONFIRMED" ||
    !booking.confirmedAt ||
    booking.depositPaidAt ||
    booking.depositPayment ||
    !quote ||
    quote.status !== "ACCEPTED" ||
    quote.originalInvoice ||
    !booking.scheduledAt
  )
    return null;

  const total = BigInt(quote.totalKobo);
  const deposit = (total * BigInt(2_000) + BigInt(5_000)) / BigInt(10_000);
  if (deposit <= BigInt(0)) return null;

  if (!bookingDepositsEnabled)
    return (
      <section
        className="booking-detail-surface"
        aria-labelledby="booking-deposit-unavailable-title"
      >
        <h2 id="booking-deposit-unavailable-title">Quotation accepted</h2>
        <p>
          Your quotation of {formatKobo(quote.totalKobo)} is accepted. Online
          booking-deposit payments are not available at the moment. No deposit has been
          requested or charged through this booking.
        </p>
        <p>
          Your appointment remains confirmed. Contact the workshop if you need help with
          payment arrangements; you can return here to check for updates.
        </p>
      </section>
    );

  async function requestDeposit() {
    if (!agreed || !fresh || busy || uncertain || paymentId || !quote) return;
    if (!key.current) key.current = newIdempotencyKey();
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError(undefined);
    try {
      const result = await apiRequest<{ payment: { id: string } }>(
        `/customers/payments/booking-deposits/${encodeURIComponent(booking.id)}`,
        {
          method: "POST",
          csrf: true,
          idempotencyKey: key.current,
          signal: controller.signal,
          body: {
            acceptedQuoteId: quote.id,
            acceptedQuoteVersion: quote.version,
            acceptDepositTerms: true,
          },
        },
      );
      if (!mounted.current || controller.signal.aborted) return;
      if (!result.data?.payment?.id) throw Error("Payment receipt was incomplete");
      setPaymentId(result.data.payment.id);
    } catch {
      if (!mounted.current || controller.signal.aborted) return;
      setUncertain(true);
      setError(
        "We could not confirm whether the deposit request was created. Refresh your booking before trying again; do not start another payment.",
      );
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        if (mounted.current) setBusy(false);
      }
    }
  }

  return (
    <section
      className="booking-detail-surface"
      aria-labelledby="booking-deposit-checkout-title"
    >
      <h2 id="booking-deposit-checkout-title">Pay your approved booking deposit</h2>
      <p>
        Quotation {quote.quoteNumber} has been accepted and your workshop appointment
        approved.
      </p>
      <dl className="booking-quote-totals">
        <div>
          <dt>Approved quotation</dt>
          <dd>{formatKobo(quote.totalKobo)}</dd>
        </div>
        <div>
          <dt>Online deposit (20%)</dt>
          <dd>{formatKobo(deposit.toString())}</dd>
        </div>
        <div>
          <dt>Remaining at the workshop (80%)</dt>
          <dd>{formatKobo((total - deposit).toString())}</dd>
        </div>
      </dl>
      <p>
        The remaining amount is handled in person by the workshop and its Zoho Books
        records. Returning from Paystack does not confirm payment; your account must show
        verified payment.
      </p>
      <p>
        One free reschedule is available with at least 24 hours’ notice. Cancellations at
        least 48 hours before your appointment qualify for a full deposit refund review.
        Later cancellations and exceptional cases require staff review; no fee is
        automatically deducted.
      </p>
      {!paymentId && (
        <label className="booking-deposit-agreement">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            disabled={busy || uncertain}
          />
          <span>
            I agree to pay exactly 20% of this accepted quotation under the booking
            deposit and cancellation terms.
          </span>
        </label>
      )}
      {error && <p role="alert">{error}</p>}
      {paymentId ? (
        <Link className="button" href={`/dashboard/payments/${paymentId}`}>
          Continue to Paystack checkout
        </Link>
      ) : (
        <button
          type="button"
          className="button"
          disabled={!agreed || !fresh || busy || uncertain}
          onClick={() => void requestDeposit()}
        >
          {busy ? "Preparing secure deposit…" : "Prepare 20% deposit checkout"}
        </button>
      )}
      {uncertain && (
        <button type="button" className="button secondary" onClick={onRefresh}>
          Refresh booking status
        </button>
      )}
      {!fresh && <p role="status">Refresh this booking before starting checkout.</p>}
    </section>
  );
}
