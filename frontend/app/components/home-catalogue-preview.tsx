"use client";
import type { PublicSeed } from "@/lib/api/public-seed";
import Link from "next/link";
import { ArrowUpRight, CarFront, Fuel, Gauge, MapPin, Settings2 } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import { parseProducts } from "@/lib/api/commerce-schemas";
import { parseListings } from "@/lib/api/vehicle-schemas";
import { formatKobo } from "@/lib/format/money";
import { PublicMedia } from "./public-media";
import { Feedback } from "./feedback";

function PreviewLoading({ vehicles = false }: { vehicles?: boolean }) {
  return (
    <div
      className={vehicles ? "home-vehicle-grid" : "home-product-grid"}
      aria-hidden="true"
    >
      {Array.from({ length: vehicles ? 2 : 4 }, (_, index) => (
        <div className="home-preview-loading" key={index}>
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}

export function HomePartsPreview({
  initial,
}: {
  initial?: PublicSeed<ReturnType<typeof parseProducts>>;
}) {
  const parts = useResource(
    "/public/catalog/products?limit=4",
    parseProducts,
    initial?.data,
    { initialError: initial?.error, revalidateOnMount: false },
  );
  return (
    <div className="home-catalogue-preview" aria-busy={parts.loading}>
      <Feedback message={parts.error} />
      {parts.error && (
        <button
          className="button secondary"
          onClick={parts.refresh}
          disabled={parts.loading}
        >
          Retry products
        </button>
      )}
      {parts.loading && <p role="status">Loading products…</p>}
      {parts.loading && !parts.data && <PreviewLoading />}
      <div className="home-product-grid">
        {(!parts.error ? parts.data : undefined)?.items.map((part) => {
          const media = part.images.find((item) => item.isPrimary) ?? part.images[0];
          const inStock = part.availability.some((branch) => branch.inStock);
          return (
            <article className="home-product-card" key={part.id}>
              <PublicMedia
                key={media?.url ?? "empty"}
                src={media?.url}
                alt={media?.altText ?? part.name}
                sizes="(max-width: 540px) 90vw, (max-width: 1000px) 45vw, 22vw"
              />
              <div className="home-card__body">
                <p className="home-card__meta">
                  {[part.brand, part.category.name].filter(Boolean).join(" · ")}
                </p>
                <h3>
                  <Link href={`/parts/${part.id}`}>{part.name}</Link>
                </h3>
                <p className="home-card__price">{formatKobo(part.priceKobo)}</p>
                <p className="home-card__stock">
                  {inStock ? "In stock at a branch" : "Currently out of stock"}
                </p>
                <Link
                  className="text-link home-card__link"
                  href={`/parts/${part.id}`}
                  aria-label={`View product: ${part.name}`}
                >
                  View product <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
      {!parts.loading && !parts.error && parts.data?.items.length === 0 && (
        <div className="home-preview-empty">
          <p>No products are published yet. Contact the team with what you need.</p>
          <Link className="text-link" href="/contact#enquiry">
            Ask about a product <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  );
}

export function HomeVehiclesPreview({
  initial,
}: {
  initial?: PublicSeed<ReturnType<typeof parseListings>>;
}) {
  const listings = useResource("/public/vehicles?limit=2", parseListings, initial?.data, {
    initialError: initial?.error,
    revalidateOnMount: false,
  });
  return (
    <div className="home-catalogue-preview" aria-busy={listings.loading}>
      <Feedback message={listings.error} />
      {listings.error && (
        <button
          className="button secondary"
          onClick={listings.refresh}
          disabled={listings.loading}
        >
          Retry vehicles
        </button>
      )}
      {listings.loading && <p role="status">Loading vehicle listings…</p>}
      {listings.loading && !listings.data && <PreviewLoading vehicles />}
      <div className="home-vehicle-grid">
        {(!listings.error ? listings.data : undefined)?.items.map((listing) => {
          const media =
            listing.vehicle.images.find((item) => item.isPrimary) ??
            listing.vehicle.images[0];
          return (
            <article className="home-vehicle-card" key={listing.id}>
              <PublicMedia
                key={media?.url ?? "empty"}
                src={media?.url}
                alt={media?.altText ?? listing.title}
                fallbackIcon={<CarFront size={32} strokeWidth={1.3} />}
                sizes="(max-width: 540px) 90vw, (max-width: 1000px) 45vw, 20vw"
              />
              <div className="home-card__body">
                <h3>
                  <Link href={`/vehicles/${listing.id}`}>{listing.title}</Link>
                </h3>
                <p className="home-card__meta">
                  {listing.vehicle.year} · {listing.vehicle.make} {listing.vehicle.model}
                </p>
                <p className="home-card__price">{formatKobo(listing.priceKobo)}</p>
                <ul className="home-vehicle-specs" aria-label="Vehicle specifications">
                  {listing.vehicle.mileageKm != null && (
                    <li>
                      <Gauge size={15} aria-hidden="true" />
                      <span>{listing.vehicle.mileageKm.toLocaleString("en-NG")} km</span>
                    </li>
                  )}
                  {listing.vehicle.transmission && (
                    <li>
                      <Settings2 size={15} aria-hidden="true" />
                      <span>{listing.vehicle.transmission}</span>
                    </li>
                  )}
                  {listing.vehicle.fuelType && (
                    <li>
                      <Fuel size={15} aria-hidden="true" />
                      <span>{listing.vehicle.fuelType}</span>
                    </li>
                  )}
                </ul>
                <p className="home-card__location">
                  <MapPin size={15} aria-hidden="true" />
                  <span>
                    {listing.branch.city}, {listing.branch.state}
                  </span>
                </p>
                <Link
                  className="text-link home-card__link"
                  href={`/vehicles/${listing.id}`}
                  aria-label={`View vehicle: ${listing.title}`}
                >
                  View vehicle <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
      {!listings.loading && !listings.error && listings.data?.items.length === 0 && (
        <div className="home-preview-empty">
          <p>
            No vehicles are published yet. Contact the team about your vehicle search.
          </p>
          <Link className="text-link" href="/contact#enquiry">
            Discuss your vehicle search <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  );
}
