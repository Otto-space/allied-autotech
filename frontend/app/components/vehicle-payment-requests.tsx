"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  apiRequest,
  ApiError,
  newIdempotencyKey,
  SESSION_CHANGED,
} from "@/lib/api/client";
import { parseVehicleTransaction } from "@/lib/api/vehicle-schemas";
import { paymentSchema, type PaymentRecord } from "@/lib/api/payment-schemas";
import {
  allowedVehiclePurpose,
  readVehiclePayments,
  unresolvedVehiclePayment,
  vehiclePaymentPurposes,
  vehiclePaymentUnavailable,
  type CustomerVehicleSale,
  type VehiclePaymentPurpose,
} from "@/lib/api/vehicle-payment";
import { formatKobo } from "@/lib/format/money";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
type Attempt = {
  key: string;
  body: {
    targetType: "VEHICLE_TRANSACTION";
    targetId: string;
    purpose: VehiclePaymentPurpose;
  };
};
export function VehiclePaymentRequests({
  record,
  transactionId,
  disabled,
}: {
  record?: CustomerVehicleSale;
  transactionId: string;
  disabled: boolean;
}) {
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const [history, setHistory] = useState<{
    revision: number;
    items?: PaymentRecord[];
    error?: string;
  }>();
  const [purpose, setPurpose] = useState<VehiclePaymentPurpose | "">("");
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [attempt, setAttempt] = useState<Attempt>();
  const [uncertain, setUncertain] = useState(false);
  const [payment, setPayment] = useState<PaymentRecord>();
  const [now, setNow] = useState(() => Date.now());
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    void readVehiclePayments(transactionId, controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) setHistory({ revision, items });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setHistory({
            revision,
            error:
              "We could not check the complete payment history. Refresh before starting another request.",
          });
      });
    const discard = () => {
      controller.abort();
      pending.current?.abort();
      setHistory(undefined);
      setProposal(null);
      setAttempt(undefined);
      setPayment(undefined);
    };
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener(SESSION_CHANGED, discard);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      controller.abort();
      window.removeEventListener(SESSION_CHANGED, discard);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [transactionId, revision, refresh]);
  const deadline = record?.reservationExpiresAt;
  useEffect(() => {
    if (!deadline || !Number.isFinite(Date.parse(deadline))) return;
    if (Date.parse(deadline) <= now) return;
    const remaining = Math.max(0, Date.parse(deadline) - Date.now());
    const timer = setTimeout(() => setNow(Date.now()), Math.min(remaining, 2147483647));
    return () => clearTimeout(timer);
  }, [deadline, now]);
  const current = history?.revision === revision ? history : undefined;
  const items = current?.items;
  const unresolved = items?.filter(unresolvedVehiclePayment) ?? [];
  const unavailable = record ? vehiclePaymentUnavailable(record, now) : undefined;
  async function submit(request: Attempt, replay: boolean) {
    const controller = new AbortController();
    pending.current = controller;
    try {
      if (!replay) {
        try {
          const [response, latestPayments] = await Promise.all([
            apiRequest(`/customers/vehicle-transactions/${transactionId}`, {
              signal: controller.signal,
            }),
            readVehiclePayments(transactionId, controller.signal),
          ]);
          const latest = parseVehicleTransaction(response.data);
          if (
            !record ||
            latest.id !== transactionId ||
            latest.version !== record.version ||
            latest.agreedPriceKobo !== record.agreedPriceKobo ||
            latest.reservationRequiredKobo !== record.reservationRequiredKobo ||
            latest.reservationExpiresAt !== record.reservationExpiresAt ||
            latest.status !== record.status ||
            vehiclePaymentUnavailable(latest) ||
            latestPayments.some(unresolvedVehiclePayment) ||
            !allowedVehiclePurpose(latest, latestPayments, request.body.purpose)
          )
            throw new Error("Purchase changed");
        } catch {
          refresh();
          throw new ApiError(409, { error: { code: "PRECONDITION_UNAVAILABLE" } });
        }
      }
      setAttempt(request);
      try {
        const response = await apiRequest("/customers/payments", {
          method: "POST",
          body: request.body,
          csrf: true,
          idempotencyKey: request.key,
          signal: controller.signal,
        });
        const saved = z
          .object({ payment: paymentSchema, replayed: z.boolean() })
          .parse(response.data).payment;
        if (
          saved.vehicleTransactionId !== transactionId ||
          saved.purpose !== request.body.purpose ||
          saved.orderId !== null ||
          saved.invoiceId !== null ||
          saved.bookingId !== null ||
          (saved.expiresAt !== null &&
            !z.iso.datetime({ offset: true }).safeParse(saved.expiresAt).success) ||
          BigInt(saved.amountKobo) <= BigInt(0)
        )
          throw new Error("Unconfirmed payment request");
        setPayment(saved);
        setUncertain(false);
        refresh();
      } catch (error) {
        if (
          !replay &&
          error instanceof ApiError &&
          error.status >= 400 &&
          error.status < 500
        )
          setAttempt(undefined);
        throw error;
      }
    } finally {
      pending.current = null;
    }
  }
  if (!record) return null;
  return (
    <section className="detail-section" aria-labelledby="vehicle-payments-heading">
      <h2 id="vehicle-payments-heading">Payments for this purchase</h2>
      <p>
        A payment request confirms the amount to review before choosing a payment method.
        It does not charge you, accept reservation terms or extend a vehicle hold.
      </p>
      <button
        className="button secondary"
        disabled={!current || !!proposal || disabled}
        onClick={refresh}
      >
        Refresh purchase payments
      </button>
      {!current && <p role="status">Checking all payment-history pages…</p>}
      <Feedback message={current?.error} />
      {!disabled && items && (
        <>
          {items.length === 0 ? (
            <p>No payment requests for this purchase were found.</p>
          ) : (
            <div className="list">
              {items.map((item) => (
                <article className="list-item" key={item.id}>
                  <div>
                    <h3>
                      <Link className="text-link" href={`/dashboard/payments/${item.id}`}>
                        {item.paymentNumber}
                      </Link>
                    </h3>
                    <p>
                      {vehiclePaymentPurposes[item.purpose as VehiclePaymentPurpose] ??
                        item.purpose.replaceAll("_", " ")}
                    </p>
                    <span className="status">{item.status.replaceAll("_", " ")}</span>
                  </div>
                  <strong>{formatKobo(item.amountKobo)}</strong>
                </article>
              ))}
            </div>
          )}
          {unresolved.length > 0 && (
            <p className="notice">
              Review the existing request before starting another. Processing,
              review-pending or unconfirmed attempts must be resolved first.
            </p>
          )}
        </>
      )}
      {payment ? (
        <div className="notice success">
          <p>
            Payment request confirmed: {formatKobo(payment.amountKobo)}. No payment has
            been confirmed by this request.
          </p>
          <Link className="button" href={`/dashboard/payments/${payment.id}`}>
            Review payment & checkout options
          </Link>
        </div>
      ) : uncertain && attempt ? (
        <div className="notice">
          <p>
            This payment request has an unknown outcome. Check the original request or
            review payment history. Do not start another request.
          </p>
          <button
            className="button"
            disabled={!!proposal || disabled}
            onClick={() =>
              setProposal({
                title: "Check the original payment request?",
                description:
                  "This reuses the original reference and purpose. If the purchase changed or the deadline passed, recovery may need the team to reconcile the saved request.",
                facts: [
                  {
                    label: "Purpose",
                    value: vehiclePaymentPurposes[attempt.body.purpose],
                  },
                ],
                retryAfterRejection: false,
                submit: () => submit(attempt, true),
              })
            }
          >
            Check the same payment request
          </button>
        </div>
      ) : (
        <>
          {unavailable && <p className="notice">{unavailable}</p>}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (
                !purpose ||
                disabled ||
                proposal ||
                unavailable ||
                !items ||
                unresolved.length ||
                !allowedVehiclePurpose(record, items, purpose)
              )
                return;
              const request: Attempt = {
                key: newIdempotencyKey(),
                body: {
                  targetType: "VEHICLE_TRANSACTION",
                  targetId: transactionId,
                  purpose,
                },
              };
              setProposal({
                title: "Request this payment amount?",
                description:
                  "The server will calculate the payable amount from the agreed price and confirmed payments. You will review that amount before choosing how to pay. This does not accept reservation terms or extend the deadline.",
                facts: [
                  { label: "Purchase", value: record.transactionNumber },
                  { label: "Vehicle", value: record.vehicleListing.title },
                  { label: "Purpose", value: vehiclePaymentPurposes[purpose] },
                  { label: "Agreed price", value: formatKobo(record.agreedPriceKobo!) },
                ],
                retryAfterRejection: false,
                onUncertain: () => setUncertain(true),
                submit: () => submit(request, false),
              });
            }}
          >
            <fieldset
              disabled={disabled || !!unavailable || !items || !!unresolved.length}
            >
              <div className="field">
                <label htmlFor="vehicle-payment-purpose">Payment purpose</label>
                <select
                  id="vehicle-payment-purpose"
                  required
                  value={purpose}
                  onChange={(event) =>
                    setPurpose(event.target.value as VehiclePaymentPurpose | "")
                  }
                >
                  <option value="">Choose a payment purpose</option>
                  {Object.entries(vehiclePaymentPurposes).map(([value, label]) => (
                    <option
                      value={value}
                      key={value}
                      disabled={
                        !items ||
                        !allowedVehiclePurpose(
                          record,
                          items,
                          value as VehiclePaymentPurpose,
                        )
                      }
                    >
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <p>
                Reservation and partial requests use the amount set by the team. Balance
                requests use the server-calculated remainder. Full payment is unavailable
                after a confirmed partial payment.
              </p>
              <button className="button">Review payment request</button>
            </fieldset>
          </form>
        </>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => setProposal(null)}
          onSuccess={() => {}}
          confirmLabel="Request payment amount"
        />
      )}
    </section>
  );
}
