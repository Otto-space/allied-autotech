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
import { vehiclePresentation } from "@/lib/vehicle-presentation";
type VehicleListing = ReturnType<typeof parseListings>["items"][number];
export function PartCard({
  product,
  params = new URLSearchParams(),
  href,
  vehicleChoicesAvailable = false,
  wide = false,
}: {
  product: Product;
  params?: URLSearchParams;
  href?: string;
  vehicleChoicesAvailable?: boolean;
  wide?: boolean;
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
            width={photo?.width}
            height={photo?.height}
            alt={photo?.altText ?? product.name}
            fallbackIcon={<Package size={28} strokeWidth={1.4} />}
            sizes={
              wide
                ? "(max-width: 540px) 92vw, 400px"
                : "(max-width: 540px) 92vw, (max-width: 1100px) 50vw, 33vw"
            }
          />

          <div className="shop-product-identity">
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
            {product.manufacturerPartNumber && (
              <p className="shop-product-number">
                Part no. {product.manufacturerPartNumber}
              </p>
            )}
          </div>
        </div>
        <div className="product-copy">
          <strong>{formatKobo(product.priceKobo, { hideZeroDecimals: true })}</strong>
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
                    {vehicleChoicesAvailable
                      ? "Select your vehicle and technical details to confirm fitment."
                      : "Ask our team to confirm fitment for your vehicle and technical details."}
                  </span>
                </>
              ) : (
                <>
                  <p>Compatibility has not been confirmed.</p>
                  <span>Ask our team to check.</span>
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
  priority = false,
  wide = false,
}: {
  listing: VehicleListing;
  href?: string;
  priority?: boolean;
  wide?: boolean;
}) {
  const presentation = vehiclePresentation(listing.vehicle);
  const specs = [
    {
      label: "Mileage",
      value:
        listing.vehicle.mileageKm == null
          ? undefined
          : `${listing.vehicle.mileageKm.toLocaleString("en-NG")} km`,
      Icon: Gauge,
    },
    {
      label: "Transmission",
      value: listing.vehicle.transmission
        ? vehicleLabel(listing.vehicle.transmission)
        : undefined,
      Icon: Settings2,
    },
    {
      label: "Fuel",
      value: listing.vehicle.fuelType
        ? vehicleLabel(listing.vehicle.fuelType)
        : undefined,
      Icon: Fuel,
    },
  ].filter((spec) => spec.value);
  const photo =
    listing.vehicle.images.find((image) => image.isPrimary) ?? listing.vehicle.images[0];
  return (
    <article className="product-card vehicle-card">
      <Link href={href ?? `/vehicles/${listing.id}`}>
        <PublicMedia
          width={photo?.width}
          height={photo?.height}
          priority={priority}
          key={photo?.url ?? "missing"}
          src={photo?.url}
          alt={photo?.altText || presentation.title}
          fallbackIcon={<CarFront size={34} strokeWidth={1.4} />}
          sizes={
            wide
              ? "(max-width: 767px) 92vw, (max-width: 1023px) 80vw, 600px"
              : "(max-width: 767px) 92vw, (max-width: 1050px) 50vw, 33vw"
          }
        />

        <div className="product-copy">
          <span className="vehicle-card-meta">
            {vehicleLabel(listing.vehicle.condition)}
          </span>
          <h3>{presentation.title}</h3>
          {presentation.subtitle && (
            <p className="vehicle-card-variant">{presentation.subtitle}</p>
          )}
          <strong>{formatKobo(listing.priceKobo, { hideZeroDecimals: true })}</strong>
          {specs.length > 0 && (
            <dl className="vehicle-card-specs">
              {specs.map(({ label, value, Icon }) => (
                <div key={label}>
                  <dt>
                    <Icon size={15} aria-hidden="true" />
                    {label}
                  </dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
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
