"use client";

import type { StaffListing, StaffVehicle } from "@/lib/api/staff-vehicle-schemas";
import { formatKobo } from "@/lib/format/money";
import { mileageLabel } from "@/lib/vehicle-detail";
import { vehicleLabel } from "@/lib/vehicle-discovery";
import { PublicMedia } from "./public-media";
import { VehicleOwnerDisclosure } from "./vehicle-owner-disclosure";

export function VehicleListingPreview({
  vehicle,
  listing,
}: {
  vehicle: StaffVehicle;
  listing: StaffListing;
}) {
  const cover = vehicle.images.find((image) => image.isPrimary) ?? vehicle.images[0];
  return (
    <details className="detail-section">
      <summary>Preview listing content</summary>
      <p>
        Staff preview of saved content. Status: {listing.status}. This does not publish or
        reserve the vehicle.
      </p>
      <h3>{listing.title}</h3>
      <PublicMedia
        stockPreview
        src={cover?.url}
        alt={cover?.altText || "Vehicle cover photo"}
        sizes="(max-width: 767px) 100vw, 640px"
      />
      <p>
        {formatKobo(listing.priceKobo)} · {vehicle.branch.name}
      </p>
      <p>
        {vehicle.year} {vehicle.make} {vehicle.model} · {mileageLabel(vehicle.mileageKm)}{" "}
        ·{" "}
        {vehicle.transmission
          ? vehicleLabel(vehicle.transmission)
          : "Transmission not listed"}
      </p>
      <VehicleOwnerDisclosure vehicle={vehicle} />
      <p className="preserve-lines">
        {listing.description || "No description recorded."}
      </p>
      <p>
        {vehicle.conditionReports.length
          ? "A recorded inspection report is attached; review its date and findings separately."
          : "No inspection report is recorded. Owner statements do not certify condition."}
      </p>
      <p>
        Review all photos in Vehicle photos below. Confirm that number plates, faces and
        private documents are protected before publication.
      </p>
    </details>
  );
}
