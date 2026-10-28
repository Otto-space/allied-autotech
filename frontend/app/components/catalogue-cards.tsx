"use client";
import { VehicleOwnerDisclosure } from "./vehicle-owner-disclosure";
import Link from "next/link";
import {
  ArrowRight,
  CarFront,
  Package,
  CircleCheck,
  CircleMinus,
  Gauge,
  Settings2,
  Fuel,
  MapPin,
  ClipboardList,
} from "lucide-react";
import type { Product } from "@/lib/api/commerce-schemas";
import type { parseListings } from "@/lib/api/vehicle-schemas";
import { productFitmentHref } from "@/lib/parts-fitment";
import { vehicleLabel } from "@/lib/vehicle-discovery";
import { formatKobo } from "@/lib/format/money";
import { packVolumeLabel } from "@/lib/product-family";
import { PartFitmentSummary } from "./part-fitment-summary";
import { PublicMedia } from "./public-media";
import { productAvailability } from "@/lib/product-availability";
type VehicleListing = ReturnType<typeof parseListings>["items"][number];
export function PartCard({
  product,
  params = new URLSearchParams(),
  href,
}: {
  product: Product;
  params?: URLSearchParams;
  href?: string;
}) {
  const photo = product.images.find((image) => image.isPrimary) ?? product.images[0];
  const availability = productAvailability(product.availability);
  const available = availability.state === "available";
  const comparison =
    product.compareAtPriceKobo &&
    BigInt(product.compareAtPriceKobo) > BigInt(product.priceKobo)
      ? product.compareAtPriceKobo
      : null;
  const fitment = product.compatibilities[0];
  return (
    <article className="product-card shop-product-card">
      <Link href={href ?? productFitmentHref(product.id, params)}>
        <div className="shop-product-top">
          <PublicMedia
            key={photo?.url ?? "missing"}
            src={photo?.url}
            alt={photo?.altText ?? product.name}
            fallbackIcon={<Package size={28} strokeWidth={1.4} />}
            sizes="(max-width: 767px) 35vw, 150px"
          />

          <div className="shop-product-identity">
            <span className="product-card-meta">{product.category.name}</span>
            <h3>{product.name}</h3>
            {product.brand && <p className="shop-product-brand">{product.brand}</p>}
            {product.family === "ENGINE_OIL" && (
              <p className="shop-product-number">
                {product.oilViscosityGrade ?? "Grade not recorded"} ·{" "}
                {product.packVolumeMl
                  ? packVolumeLabel(product.packVolumeMl)
                  : "Pack volume not recorded"}
              </p>
            )}
            <p className="shop-product-number">
              {product.manufacturerPartNumber
                ? `Part no. ${product.manufacturerPartNumber}`
                : `SKU ${product.sku}`}
            </p>
          </div>
        </div>
        <div className="product-copy">
          <strong>{formatKobo(product.priceKobo)}</strong>
          {comparison && (
            <p className="shop-comparison-price">
              Compare at <s>{formatKobo(comparison)}</s>
            </p>
          )}
          <p className={`shop-stock-label${available ? " is-available" : ""}`}>
            {available ? (
              <CircleCheck size={14} aria-hidden="true" />
            ) : (
              <CircleMinus size={14} aria-hidden="true" />
            )}
            <span>{availability.label}</span>
          </p>
          <div className="shop-card-fitment">
            <CarFront size={16} aria-hidden="true" />
            <div>
              {product.family === "ENGINE_OIL" && !params.has("vehicleModelId") ? (
                <>
                  <p>Check the required specifications</p>
                  <span>
                    A recorded grade alone does not confirm vehicle suitability or
                    manufacturer approval.
                  </span>
                </>
              ) : params.has("vehicleModelId") ? (
                <PartFitmentSummary decision={product.fitment} />
              ) : fitment ? (
                <>
                  <span className="shop-fitment-label">Reviewed application listed</span>
                  <p>
                    {fitment.make}
                    {fitment.model ? ` ${fitment.model}` : ""}
                  </p>
                  <span>
                    Select your vehicle and technical details to confirm fitment.
                  </span>
                </>
              ) : (
                <>
                  <p>Fitment unknown</p>
                  <span>Choose your vehicle or ask our team to verify suitability.</span>
                </>
              )}
            </div>
          </div>
          <span className="product-detail-link">
            View product <ArrowRight size={17} aria-hidden="true" />
          </span>
        </div>
      </Link>
    </article>
  );
}

export function VehicleCard({
  listing,
  href,
}: {
  listing: VehicleListing;
  href?: string;
}) {
  return (
    <article className="product-card vehicle-card">
      <Link href={href ?? `/vehicles/${listing.id}`}>
        <PublicMedia
          key={
            (
              listing.vehicle.images.find((image) => image.isPrimary) ??
              listing.vehicle.images[0]
            )?.url ?? "missing"
          }
          src={
            (
              listing.vehicle.images.find((image) => image.isPrimary) ??
              listing.vehicle.images[0]
            )?.url
          }
          alt={
            (
              listing.vehicle.images.find((image) => image.isPrimary) ??
              listing.vehicle.images[0]
            )?.altText || listing.title
          }
          fallbackIcon={<CarFront size={34} strokeWidth={1.4} />}
          sizes="(max-width: 767px) 100vw, (max-width: 1050px) 50vw, 33vw"
        />

        <div className="product-copy">
          <span className="vehicle-card-meta">
            {listing.vehicle.year} · {vehicleLabel(listing.vehicle.condition)}
          </span>
          <h3>{listing.title}</h3>
          <p className="vehicle-card-variant">
            {[listing.vehicle.make, listing.vehicle.model, listing.vehicle.trim]
              .filter(Boolean)
              .join(" ")}
          </p>
          <strong>{formatKobo(listing.priceKobo)}</strong>
          <dl className="vehicle-card-specs">
            <div>
              <dt>
                <Gauge size={15} aria-hidden="true" />
                Mileage
              </dt>
              <dd>
                {listing.vehicle.mileageKm === null
                  ? "Not listed"
                  : `${listing.vehicle.mileageKm.toLocaleString("en-NG")} km`}
              </dd>
            </div>
            <div>
              <dt>
                <Settings2 size={15} aria-hidden="true" />
                Transmission
              </dt>
              <dd>
                {listing.vehicle.transmission
                  ? vehicleLabel(listing.vehicle.transmission)
                  : "Not listed"}
              </dd>
            </div>
            <div>
              <dt>
                <Fuel size={15} aria-hidden="true" />
                Fuel
              </dt>
              <dd>
                {listing.vehicle.fuelType
                  ? vehicleLabel(listing.vehicle.fuelType)
                  : "Not listed"}
              </dd>
            </div>
          </dl>
          <p className="vehicle-card-specification">
            {vehicleLabel(listing.vehicle.condition)}
            {listing.vehicle.powertrain
              ? ` · ${vehicleLabel(listing.vehicle.powertrain)}`
              : ""}
            {listing.vehicle.manufactureCountryCode
              ? ` · Assembled in ${vehicleLabel(listing.vehicle.manufactureCountryCode)}`
              : ""}
          </p>
          <VehicleOwnerDisclosure vehicle={listing.vehicle} compact />
          <div className="vehicle-card-location">
            <MapPin size={15} aria-hidden="true" />
            <span>
              {[listing.branch.city, listing.branch.state].filter(Boolean).join(", ") ||
                listing.branch.name}
            </span>
          </div>
          {listing.vehicle.conditionReports.length > 0 && (
            <p className="vehicle-card-report">
              <ClipboardList size={15} aria-hidden="true" />
              Condition report available
            </p>
          )}
          <span className="vehicle-card-view">
            View vehicle <ArrowRight size={17} aria-hidden="true" />
          </span>
        </div>
      </Link>
    </article>
  );
}
