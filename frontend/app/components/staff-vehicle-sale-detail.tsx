"use client";
import Link from "next/link";
import { useState } from "react";
import { useResource } from "@/lib/api/use-resource";
import { parseStaffVehicleSale } from "@/lib/api/staff-vehicle-sales-schemas";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { VehicleNegotiationForm, VehicleSaleStatusForm } from "./vehicle-sale-forms";
import { VehicleHandoverCreate, VehicleHandoverRecord } from "./vehicle-handover";
export function StaffVehicleSaleDetail({ transactionId }: { transactionId: string }) {
  const sale = useResource(
    `/staff/vehicle-transactions/${transactionId}`,
    parseStaffVehicleSale,
  );
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [message, setMessage] = useState<string>();
  const current = sale.data;
  const disabled = sale.loading || !!sale.error || !!proposal;
  function review(value: MutationProposal) {
    if (disabled) return;
    setMessage(undefined);
    setProposal(value);
  }
  return (
    <>
      <Link className="text-link" href="/admin/vehicle-sales">
        Back to vehicle sales
      </Link>
      <h1>Manage vehicle purchase</h1>
      <Feedback message={sale.error} />
      <Feedback message={message} tone="success" toast="Vehicle sale change recorded." />
      <button
        className="button secondary"
        disabled={sale.loading || !!proposal}
        onClick={sale.refresh}
      >
        Refresh vehicle purchase
      </button>
      {sale.loading && <p role="status">Checking purchase details…</p>}
      {current && (
        <>
          <section className="detail-section">
            <p className="muted">{current.transactionNumber}</p>
            <h2>{current.vehicleListing.title}</h2>
            <p className="status">{current.status.replaceAll("_", " ")}</p>
            <dl className="totals">
              <dt>Stock number</dt>
              <dd>
                <Link
                  className="text-link"
                  href={`/admin/vehicles/${current.vehicleListing.vehicle.id}`}
                >
                  {current.vehicleListing.vehicle.stockNumber}
                </Link>
              </dd>
              <dt>Customer</dt>
              <dd>{current.customerName}</dd>
              <dt>Customer profile reference</dt>
              <dd>{current.customerId ?? "No linked account"}</dd>
              <dt>Asking price</dt>
              <dd>{formatKobo(current.askingPriceKobo)}</dd>
              <dt>Agreed price</dt>
              <dd>
                {current.agreedPriceKobo === null
                  ? "Not agreed"
                  : formatKobo(current.agreedPriceKobo)}
              </dd>
              <dt>Reservation amount requested</dt>
              <dd>
                {current.reservationRequiredKobo === null
                  ? "Not set"
                  : formatKobo(current.reservationRequiredKobo)}
              </dd>
              <dt>Full payment</dt>
              <dd>
                {current.paidAt
                  ? `Recorded ${formatBusinessDate(current.paidAt)}`
                  : "Not recorded"}
              </dd>
            </dl>
            {current.reservationExpiresAt && (
              <p>
                Recorded reservation deadline:{" "}
                {formatBusinessDate(current.reservationExpiresAt)}. Refresh to check the
                current status; this deadline is not extended by contacting the team.
              </p>
            )}
            {current.termsAcceptedAt && (
              <p>
                Terms version {current.termsVersion} accepted{" "}
                {formatBusinessDate(current.termsAcceptedAt)}.
              </p>
            )}
            {current.cancellationReason && (
              <p>Cancellation reason: {current.cancellationReason}</p>
            )}
            {current.status === "NEGOTIATING" && (
              <p className="notice">
                Reservation requires the customer to accept approved terms. Published
                terms are still required before online reservation can be enabled.
              </p>
            )}
            {current.customerId === null && (
              <p className="notice">
                This enquiry has no linked customer account. Account-based reservation and
                invoicing require a customer profile.
              </p>
            )}
          </section>
          {["ENQUIRY", "INSPECTION_COMPLETED", "NEGOTIATING"].includes(
            current.status,
          ) && (
            <VehicleNegotiationForm
              key={`negotiation-${current.version}`}
              sale={current}
              disabled={disabled}
              onReview={review}
            />
          )}
          <VehicleSaleStatusForm
            key={`status-${current.version}`}
            sale={current}
            disabled={disabled}
            onReview={review}
          />
          <section className="detail-section">
            <h2>Purchase history</h2>
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
              <p>No progress entries are recorded.</p>
            )}
          </section>
          {current.status === "PAID" && !current.handover && (
            <VehicleHandoverCreate sale={current} disabled={disabled} onReview={review} />
          )}
          {current.handover && (
            <VehicleHandoverRecord
              key={`handover-${current.handover.id}-${current.handover.version}`}
              sale={current}
              disabled={disabled}
              onReview={review}
            />
          )}
        </>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => {
            setProposal(null);
            sale.refresh();
          }}
          onSuccess={() =>
            setMessage(
              "Purchase change recorded. Review the refreshed details and history.",
            )
          }
        />
      )}
    </>
  );
}
