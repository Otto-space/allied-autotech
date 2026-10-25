"use client";
import Link from "next/link";
import Image from "next/image";
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
import { PartFitmentSummary } from "./part-fitment-summary";
import { PublicMedia } from "./public-media";
type VehicleListing = ReturnType<typeof parseListings>["items"][number];
export function PartCard({
  product,
  params = new URLSearchParams(),
  href,
  demo = false,
}: {
  product: Product;
  params?: URLSearchParams;
  href?: string;
  demo?: boolean;
}) {
  const photo = product.images.find((image) => image.isPrimary) ?? product.images[0];
  const available = product.availability.some((item) => item.inStock);
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
          {demo ? (
            <DemoMedia kind="part" />
          ) : (
            <PublicMedia
              key={photo?.url ?? "missing"}
              src={photo?.url}
              alt={photo?.altText ?? product.name}
              fallbackIcon={<Package size={28} strokeWidth={1.4} />}
              sizes="(max-width: 767px) 35vw, 150px"
            />
          )}

          <div className="shop-product-identity">
            <span className="product-card-meta">{product.category.name}</span>
            <h3>{product.name}</h3>
            {product.brand && <p className="shop-product-brand">{product.brand}</p>}
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
            <span>
              {demo
                ? "Demo availability — not real stock"
                : available
                  ? "Available at a listed branch"
                  : "Currently unavailable"}
            </span>
          </p>
          <div className="shop-card-fitment">
            <CarFront size={16} aria-hidden="true" />
            <div>
              {params.has("vehicleModelId") ? (
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
            {demo ? "View sample details" : "View product"}{" "}
            <ArrowRight size={17} aria-hidden="true" />
          </span>
        </div>
      </Link>
    </article>
  );
}

export function VehicleCard({
  listing,
  href,
  demo = false,
}: {
  listing: VehicleListing;
  href?: string;
  demo?: boolean;
}) {
  return (
    <article className="product-card vehicle-card">
      <Link href={href ?? `/vehicles/${listing.id}`}>
        {demo ? (
          <DemoMedia kind="vehicle" />
        ) : (
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
            alt={listing.title}
            fallbackIcon={<CarFront size={34} strokeWidth={1.4} />}
            sizes="(max-width: 767px) 100vw, (max-width: 1050px) 50vw, 33vw"
          />
        )}

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
            {demo ? "View sample details" : "View vehicle"}{" "}
            <ArrowRight size={17} aria-hidden="true" />
          </span>
        </div>
      </Link>
    </article>
  );
}

function DemoMedia({ kind }: { kind: "part" | "vehicle" }) {
  return (
    <div className="product-media">
      <Image
        src={
          kind === "part"
            ? "/images/allied-autotech/parts-editorial.webp"
            : "/images/allied-autotech/showroom-editorial.webp"
        }
        alt="Editorial illustration for the sample layout, not a photograph of this fictional item"
        fill
        sizes="(max-width: 767px) 90vw, 33vw"
      />
      <span className="demo-image-label">Illustration: demo item</span>
    </div>
  );
}
