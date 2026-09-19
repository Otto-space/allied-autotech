"use client";
import Link from "next/link";
import { useState } from "react";
import { useResource } from "@/lib/api/use-resource";
import { parseStaffVehicle, parseAdminVehicle } from "@/lib/api/staff-vehicle-schemas";
import { useAccountSession } from "./dashboard-shell";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { VehicleRecordForm } from "./vehicle-record-form";
import { VehicleEvidence } from "./vehicle-evidence";
import {
  VehicleListingForm,
  VehicleListingPrice,
  VehicleListingStatus,
} from "./vehicle-listing-forms";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
export function StaffVehicleDetail({ vehicleId }: { vehicleId: string }) {
  const session = useAccountSession();
  const includeAcquisition =
    session?.user.role === "ADMIN" || session?.user.role === "SUPER_ADMIN";
  const vehicle = useResource(
    `/staff/vehicles/${vehicleId}`,
    includeAcquisition ? parseAdminVehicle : parseStaffVehicle,
  );
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [message, setMessage] = useState<string>();
  const current = vehicle.data;
  const disabled = vehicle.loading || !!vehicle.error || !!proposal;
  function review(proposal: MutationProposal) {
    if (disabled) return;
    setMessage(undefined);
    setProposal(proposal);
  }
  return (
    <>
      <Link className="text-link" href="/admin/vehicles">
        Back to vehicle stock
      </Link>
      <h1>Manage vehicle stock</h1>
      <Feedback message={vehicle.error} />
      <Feedback message={message} tone="success" />
      <button
        className="button secondary"
        disabled={vehicle.loading || !!proposal}
        onClick={vehicle.refresh}
      >
        Refresh stock record
      </button>
      {vehicle.loading && <p role="status">Checking vehicle record…</p>}
      {current && (
        <>
          <section className="detail-section">
            <p className="muted">{current.stockNumber}</p>
            <h2>
              {current.year} {current.make} {current.model}
            </h2>
            <dl className="totals">
              <dt>Branch</dt>
              <dd>
                {current.branch.name}
                {current.branch.isActive ? "" : " (inactive)"}
              </dd>
              <dt>Condition</dt>
              <dd>{current.condition}</dd>
              <dt>Mileage</dt>
              <dd>
                {current.mileageKm === null
                  ? "Not recorded"
                  : `${current.mileageKm.toLocaleString("en-NG")} km`}
              </dd>
              <dt>VIN</dt>
              <dd>{current.vin ?? "Not recorded"}</dd>
              {includeAcquisition && (
                <>
                  <dt>Internal acquisition cost</dt>
                  <dd>
                    {current.acquisitionCostKobo == null
                      ? "Not recorded"
                      : formatKobo(current.acquisitionCostKobo)}
                  </dd>
                </>
              )}
              <dt>Acquired at</dt>
              <dd>
                {current.acquiredAt
                  ? formatBusinessDate(current.acquiredAt)
                  : "Not recorded"}
              </dd>
            </dl>
          </section>
          <details className="detail-section">
            <summary>Edit vehicle specifications</summary>
            <VehicleRecordForm
              key={current.id}
              vehicle={current}
              disabled={disabled}
              onSaved={vehicle.refresh}
            />
          </details>
          <section className="detail-section">
            <h2>Sale listings</h2>
            <p>
              Each listing has its own price, content and publication status. New listings
              start as drafts.
            </p>
            {current.listings.length === 0 && (
              <p>No listings have been created for this vehicle.</p>
            )}
            {current.listings.map((listing) => (
              <section
                className="detail-section"
                key={listing.id}
                aria-labelledby={`listing-heading-${listing.id}`}
              >
                <h3 id={`listing-heading-${listing.id}`}>{listing.title}</h3>
                <p className="status">{listing.status}</p>
                <p>{formatKobo(listing.priceKobo)}</p>
                <p>{listing.description ?? "No public description recorded."}</p>
                {listing.status === "AVAILABLE" && current.branch.isActive && (
                  <Link className="text-link" href={`/vehicles/${listing.id}`}>
                    View public listing
                  </Link>
                )}
                {listing.publishedAt && (
                  <p>First published {formatBusinessDate(listing.publishedAt)}</p>
                )}
                <details>
                  <summary>Edit listing content</summary>
                  <VehicleListingForm
                    listing={listing}
                    vehicleId={current.id}
                    disabled={disabled}
                    onReview={review}
                  />
                </details>
                <details>
                  <summary>Manage asking price</summary>
                  <VehicleListingPrice
                    listing={listing}
                    disabled={disabled}
                    onReview={review}
                  />
                </details>
                <VehicleListingStatus
                  key={listing.version}
                  listing={listing}
                  disabled={disabled}
                  onReview={review}
                />
              </section>
            ))}
          </section>
          <details className="detail-section">
            <summary>Create a draft listing</summary>
            <VehicleListingForm
              key={`new-${current.listings.length}`}
              vehicleId={current.id}
              disabled={disabled}
              onReview={review}
            />
          </details>
          <VehicleEvidence vehicle={current} disabled={disabled} onReview={review} />
        </>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => {
            setProposal(null);
            vehicle.refresh();
          }}
          onSuccess={() =>
            setMessage("Vehicle change recorded. Review the refreshed details.")
          }
        />
      )}
    </>
  );
}
