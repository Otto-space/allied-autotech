"use client";
import Link from "next/link";
import { useCallback } from "react";
import { useResource } from "@/lib/api/use-resource";
import { parseVehicleTransaction } from "@/lib/api/vehicle-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import { formatKobo } from "@/lib/format/money";
import { Feedback } from "./feedback";
import { VehiclePaymentRequests } from "./vehicle-payment-requests";

export function VehicleTransactionDetail({ transactionId }: { transactionId: string }) {
  const parse = useCallback(
    (value: unknown) => {
      const record = parseVehicleTransaction(value);
      if (record.id !== transactionId) throw new Error("Mismatched purchase");
      return record;
    },
    [transactionId],
  );
  const transaction = useResource(
    `/customers/vehicle-transactions/${encodeURIComponent(transactionId)}`,
    parse,
  );
  const current = transaction.error ? undefined : transaction.data;
  return (
    <>
      <Link className="text-link" href="/dashboard/vehicle-transactions">
        ← Vehicle enquiries & purchases
      </Link>
      <h1>Vehicle purchase progress</h1>
      <Feedback message={transaction.error} />
      <button
        className="button secondary"
        disabled={transaction.loading}
        onClick={transaction.refresh}
      >
        Refresh purchase progress
      </button>
      {transaction.loading && <p role="status">Checking purchase progress…</p>}
      {current && (
        <>
          <section className="detail-section">
            <p className="muted">{current.transactionNumber}</p>
            <h2>{current.vehicleListing.title}</h2>
            <span className="status">{current.status.replaceAll("_", " ")}</span>
            <dl className="totals">
              <dt>Asking price</dt>
              <dd>{formatKobo(current.askingPriceKobo)}</dd>
              <dt>Agreed price</dt>
              <dd>
                {current.agreedPriceKobo === null
                  ? "Not agreed yet"
                  : formatKobo(current.agreedPriceKobo)}
              </dd>
              {current.reservationRequiredKobo !== null && (
                <>
                  <dt>Reservation payment requested</dt>
                  <dd>{formatKobo(current.reservationRequiredKobo)}</dd>
                </>
              )}
            </dl>
            {current.reservationExpiresAt && (
              <p>
                Recorded reservation deadline:{" "}
                {formatBusinessDate(current.reservationExpiresAt)}. Refresh to check its
                current status.
              </p>
            )}
            {current.termsAcceptedAt && (
              <p>
                Terms version {current.termsVersion} accepted{" "}
                {formatBusinessDate(current.termsAcceptedAt)}.
              </p>
            )}
            {current.paidAt && (
              <p>Full payment recorded {formatBusinessDate(current.paidAt)}.</p>
            )}
            {current.cancellationReason && (
              <p>Cancellation reason: {current.cancellationReason}</p>
            )}
            {current.status === "NEGOTIATING" && current.agreedPriceKobo !== null && (
              <div className="notice">
                <h3>Reservation terms are not available online</h3>
                <p>
                  Contact our team to review the approved terms before reserving this
                  vehicle. Contacting us does not reserve or extend a hold.
                </p>
              </div>
            )}
            <div className="actions">
              <Link className="button" href="/dashboard/payments">
                Review your payment requests
              </Link>
              <Link className="button secondary" href="/dashboard/support">
                Contact customer care
              </Link>
            </div>
          </section>
          <section className="detail-section">
            <h2>Progress history</h2>
            <ol className="history-list">
              {current.statusHistory.map((item) => (
                <li key={item.id}>
                  <strong>{item.toStatus.replaceAll("_", " ")}</strong>
                  <p className="muted">{formatBusinessDate(item.createdAt)}</p>
                  {item.reason && <p>{item.reason}</p>}
                </li>
              ))}
            </ol>
            {current.statusHistory.length === 0 && (
              <p>No progress entries are available.</p>
            )}
          </section>
          {current.handover && (
            <section className="detail-section">
              <h2>Vehicle handover</h2>
              <span className="status">
                {current.handover.status.replaceAll("_", " ")}
              </span>
              <dl className="totals">
                <dt>Recipient</dt>
                <dd>{current.handover.recipientName ?? "Not recorded"}</dd>
                <dt>Recorded odometer</dt>
                <dd>
                  {current.handover.odometerKm === null
                    ? "Not recorded"
                    : `${current.handover.odometerKm.toLocaleString("en-NG")} km`}
                </dd>
                <dt>Keys recorded</dt>
                <dd>{current.handover.keysDelivered}</dd>
              </dl>
              {current.handover.completedAt && (
                <p>Completed {formatBusinessDate(current.handover.completedAt)}</p>
              )}
            </section>
          )}
        </>
      )}
      <VehiclePaymentRequests
        key={transactionId}
        transactionId={transactionId}
        record={current}
        disabled={transaction.loading || !!transaction.error}
      />
    </>
  );
}
