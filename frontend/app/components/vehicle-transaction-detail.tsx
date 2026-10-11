"use client";
import Link from "next/link";
import { useCallback } from "react";
import { CarFront, ChevronRight, MessageCircle, RefreshCw } from "lucide-react";
import { z } from "zod";
import { useResource } from "@/lib/api/use-resource";
import { parseCustomerPurchaseDetail } from "@/lib/api/customer-purchase-detail-schema";
import { purchaseLabels } from "@/lib/customer-purchase-query";
import { formatBusinessDate } from "@/lib/format/date";
import { formatKobo } from "@/lib/format/money";
import { PublicMedia } from "./public-media";
import { VehiclePaymentRequests } from "./vehicle-payment-requests";

function RecordedDate({ value }: { value: string }) {
  return <time dateTime={value}>{formatBusinessDate(value)}</time>;
}
const handoverLabels = {
  PENDING: "Pending",
  READY: "Ready",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};
export function VehicleTransactionDetail({ transactionId }: { transactionId: string }) {
  const validId = z.uuid().safeParse(transactionId).success;
  const parse = useCallback(
    (value: unknown) => {
      const record = parseCustomerPurchaseDetail(value);
      if (record.id !== transactionId) throw new Error("Mismatched purchase");
      return record;
    },
    [transactionId],
  );
  const transaction = useResource(
    validId
      ? `/customers/vehicle-transactions/${encodeURIComponent(transactionId)}`
      : null,
    parse,
  );
  const current =
    !transaction.error && !transaction.loading ? transaction.data : undefined;
  const stale = !!transaction.refreshError;
  const busy = transaction.loading || transaction.refreshing;
  const images = current?.vehicleListing.vehicle?.images ?? [];
  const photo = images.find((image) => image.isPrimary) ?? images[0];
  return (
    <div className="purchase-detail-page">
      <nav aria-label="Breadcrumb" className="pd-breadcrumb">
        <Link href="/dashboard">Overview</Link>
        <ChevronRight aria-hidden="true" size={14} />
        <Link href="/dashboard/vehicle-transactions">Vehicle purchases</Link>
        <ChevronRight aria-hidden="true" size={14} />
        <span aria-current="page">{current?.transactionNumber ?? "Purchase detail"}</span>
      </nav>
      <header className="pd-heading">
        <h1>Vehicle purchase progress</h1>
        {validId && (
          <button
            className="button secondary"
            disabled={busy}
            onClick={transaction.refresh}
          >
            <RefreshCw size={16} aria-hidden="true" /> Refresh purchase progress
          </button>
        )}
      </header>
      {stale && (
        <div className="pd-alert" role="status">
          <strong>These details may be out of date.</strong>
          <p>
            We could not refresh this purchase. Refresh purchase progress before
            requesting a payment.
          </p>
        </div>
      )}
      {transaction.refreshing && (
        <p className="pd-refreshing" role="status">
          Checking the latest purchase details… Payment actions are paused.
        </p>
      )}
      {transaction.loading && (
        <div className="pd-loading" role="status">
          <span>Checking purchase progress…</span>
          <div className="pd-skeleton" aria-hidden="true" />
          <div className="pd-skeleton short" aria-hidden="true" />
        </div>
      )}
      {(!validId || transaction.error) && (
        <section className="pd-error" aria-labelledby="pd-error-heading">
          <CarFront size={30} aria-hidden="true" />
          <h2 id="pd-error-heading">Purchase details unavailable</h2>
          <p>
            {validId
              ? transaction.error
              : "This purchase link is not valid. Open a purchase from your list."}
          </p>
          <Link href="/dashboard/vehicle-transactions" className="button secondary">
            Back to vehicle purchases
          </Link>
        </section>
      )}
      {current && (
        <>
          <section className="pd-summary" aria-labelledby="pd-vehicle-title">
            <div className="pd-identity-row">
              <div className="pd-photo">
                <PublicMedia
                  key={photo?.url ?? "missing"}
                  src={photo?.url}
                  alt={photo?.altText || current.vehicleListing.title}
                  sizes="(max-width: 600px) 100vw, 32vw"
                  fallbackIcon={<CarFront size={32} strokeWidth={1.5} />}
                />
              </div>
              <div className="pd-identity">
                <div className="pd-reference">
                  <span>{current.transactionNumber}</span>
                  <span className="pd-status">{purchaseLabels[current.status]}</span>
                </div>
                <h2 id="pd-vehicle-title">{current.vehicleListing.title}</h2>
                <p>
                  Started <RecordedDate value={current.createdAt} />
                </p>
              </div>
            </div>
            <dl className="pd-prices">
              <div>
                <dt>Asking price</dt>
                <dd>{formatKobo(current.askingPriceKobo)}</dd>
              </div>
              <div>
                <dt>Agreed price</dt>
                <dd>
                  {current.agreedPriceKobo === null
                    ? "Not agreed yet"
                    : formatKobo(current.agreedPriceKobo)}
                </dd>
              </div>
              <div>
                <dt>Reservation payment requested</dt>
                <dd>
                  {current.reservationRequiredKobo === null
                    ? "Not recorded"
                    : formatKobo(current.reservationRequiredKobo)}
                </dd>
              </div>
            </dl>
          </section>
          {current.reservationExpiresAt && (
            <div className="pd-alert">
              <strong>
                Recorded reservation deadline:{" "}
                <RecordedDate value={current.reservationExpiresAt} />
              </strong>
              <p>
                Refresh to check the current status. If this deadline has passed, contact
                the team before making another payment.
              </p>
            </div>
          )}
          {current.cancellationReason && (
            <div className="pd-alert">
              <strong>Cancellation reason</strong>
              <p>{current.cancellationReason}</p>
            </div>
          )}
          {current.status === "NEGOTIATING" && current.agreedPriceKobo !== null && (
            <div className="pd-alert">
              <h2>Reservation terms are not available online</h2>
              <p>
                Contact our team to review the approved terms before reserving this
                vehicle. Contacting us does not reserve or extend a hold.
              </p>
            </div>
          )}
        </>
      )}
      <div className="pd-columns">
        <div className="pd-payments">
          <VehiclePaymentRequests
            key={transactionId}
            transactionId={transactionId}
            record={current}
            disabled={busy || stale || !!transaction.error}
          />
          {current && (
            <Link className="pd-all-payments" href="/dashboard/payments">
              Review your payment requests <ChevronRight size={16} aria-hidden="true" />
            </Link>
          )}
        </div>
        {current && (
          <aside className="pd-records" aria-label="Purchase records">
            <section aria-labelledby="pd-history-heading">
              <h2 id="pd-history-heading">Progress history</h2>
              {current.statusHistory.length ? (
                <ol className="pd-timeline">
                  {current.statusHistory.map((item) => (
                    <li key={item.id}>
                      <strong>{purchaseLabels[item.toStatus]}</strong>
                      <RecordedDate value={item.createdAt} />
                      {item.reason && <p>{item.reason}</p>}
                    </li>
                  ))}
                </ol>
              ) : (
                <p>No progress entries are available.</p>
              )}
            </section>
            {(current.termsAcceptedAt ||
              current.paidAt ||
              current.paidHoldStartsAt ||
              current.paidHoldExpiresAt) && (
              <section className="pd-record" aria-labelledby="pd-record-heading">
                <h2 id="pd-record-heading">Recorded agreements & dates</h2>
                {current.termsAcceptedAt && (
                  <p>
                    Terms version {current.termsVersion ?? "not recorded"} accepted{" "}
                    <RecordedDate value={current.termsAcceptedAt} />.
                  </p>
                )}
                {current.paidAt && (
                  <p>
                    Full payment recorded <RecordedDate value={current.paidAt} />.
                  </p>
                )}
                {current.paidHoldStartsAt && (
                  <p>
                    Recorded paid hold starts{" "}
                    <RecordedDate value={current.paidHoldStartsAt} />.
                  </p>
                )}
                {current.paidHoldExpiresAt && (
                  <p>
                    Recorded paid hold ends{" "}
                    <RecordedDate value={current.paidHoldExpiresAt} />. Contact the team
                    to confirm collection arrangements.
                  </p>
                )}
              </section>
            )}
            {current.handover && (
              <section className="pd-handover" aria-labelledby="pd-handover-heading">
                <div className="pd-section-heading">
                  <h2 id="pd-handover-heading">Vehicle handover</h2>
                  <span className="pd-status">
                    {handoverLabels[current.handover.status]}
                  </span>
                </div>
                <dl>
                  <div>
                    <dt>Recipient</dt>
                    <dd>{current.handover.recipientName ?? "Not recorded"}</dd>
                  </div>
                  <div>
                    <dt>Recorded odometer</dt>
                    <dd>
                      {current.handover.odometerKm === null
                        ? "Not recorded"
                        : `${current.handover.odometerKm.toLocaleString("en-NG")} km`}
                    </dd>
                  </div>
                  <div>
                    <dt>Keys recorded</dt>
                    <dd>{current.handover.keysDelivered}</dd>
                  </div>
                </dl>
                {current.handover.readyAt && (
                  <p>
                    Ready recorded <RecordedDate value={current.handover.readyAt} />.
                  </p>
                )}
                {current.handover.completedAt && (
                  <p>
                    Completed <RecordedDate value={current.handover.completedAt} />.
                  </p>
                )}
                <p>Contact the team to confirm collection arrangements.</p>
              </section>
            )}
            <Link className="pd-support" href="/dashboard/support">
              <MessageCircle size={18} aria-hidden="true" /> Contact customer care{" "}
              <ChevronRight size={16} aria-hidden="true" />
            </Link>
          </aside>
        )}
      </div>
    </div>
  );
}
