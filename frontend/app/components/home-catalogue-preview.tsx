"use client";
import { VehicleOwnerDisclosure } from "./vehicle-owner-disclosure";
import type { PublicSeed } from "@/lib/api/public-seed";
import Link from "next/link";
import { ArrowUpRight, CarFront, Fuel, Gauge, MapPin, Settings2 } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import { parseProducts } from "@/lib/api/commerce-schemas";
import { parseListings } from "@/lib/api/vehicle-schemas";
import { formatKobo } from "@/lib/format/money";
import { PublicMedia } from "./public-media";
import { Feedback } from "./feedback";
import { isPublicMediaUrl, publicMediaHosts } from "@/lib/media";
import { vehicleEnquiryHref } from "@/lib/catalogue-enquiry";
import { productAvailability } from "@/lib/product-availability";

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
  const hosts = publicMediaHosts(process.env.NEXT_PUBLIC_MEDIA_HOSTS);
  const featured =
    parts.data?.items.filter((part) =>
      part.images.some((image) => isPublicMediaUrl(image.url, hosts)),
    ) ?? [];
  return (
    <div className="home-catalogue-preview" aria-busy={parts.loading}>
      <Feedback message={parts.error} />
      <Feedback message={parts.refreshError} />
      {(parts.error || parts.refreshError) && (
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
      <div
        className="home-product-grid"
        data-sparse={!!parts.data && featured.length <= 2}
      >
        {(!parts.error ? featured : []).map((part) => {
          const images = part.images.filter((image) =>
            isPublicMediaUrl(image.url, hosts),
          );
          const media = images.find((item) => item.isPrimary) ?? images[0];
          const availability = productAvailability(part.availability);
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
                <p className="home-card__stock">{availability.label}</p>
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
      {!parts.loading &&
        !parts.error &&
        !!parts.data?.items.length &&
        featured.length === 0 && (
          <p className="home-product-note">
            Find published products and their available details in the Shop.
          </p>
        )}
      {!parts.loading &&
        !parts.error &&
        !parts.refreshError &&
        parts.data?.items.length === 0 && (
          <div className="home-preview-empty">
            <p>No products are published yet. Contact the team with what you need.</p>
            <Link className="text-link" href="/contact?parts=1#enquiry">
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
  const empty =
    !listings.loading &&
    !listings.error &&
    !listings.refreshError &&
    listings.data?.items.length === 0;
  const hasListings = !!listings.data?.items.length && !listings.error;
  return (
    <section
      className="public-section home-vehicles"
      data-state={empty ? "empty" : "catalogue"}
      aria-labelledby="home-vehicles-title"
    >
      <div className="public-wrap">
        <div className="home-vehicle-panel">
          <div className="section-heading-row">
            <div className="section-heading">
              <h2 id="home-vehicles-title">
                {empty
                  ? "Looking for a vehicle?"
                  : hasListings
                    ? "Explore our vehicle listings"
                    : "Vehicle enquiries"}
              </h2>
              <p>
                {empty
                  ? "Our online catalogue has no published listings yet. Tell us what you are looking for."
                  : "Compare published details or share your requirements with our team."}
              </p>
              {hasListings && (
                <Link className="text-link" href="/vehicles">
                  Explore vehicles <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              )}
            </div>
            <Link
              className="button secondary"
              href={vehicleEnquiryHref(new URLSearchParams())}
            >
              Discuss a vehicle <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
          <div className="home-catalogue-preview" aria-busy={listings.loading}>
            <Feedback message={listings.error} />
            <Feedback message={listings.refreshError} />
            {(listings.error || listings.refreshError) && (
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
                        {listing.vehicle.year} · {listing.vehicle.make}{" "}
                        {listing.vehicle.model}
                      </p>
                      <p className="home-card__price">{formatKobo(listing.priceKobo)}</p>
                      <ul
                        className="home-vehicle-specs"
                        aria-label="Vehicle specifications"
                      >
                        {listing.vehicle.mileageKm != null && (
                          <li>
                            <Gauge size={15} aria-hidden="true" />
                            <span>
                              {listing.vehicle.mileageKm.toLocaleString("en-NG")} km
                            </span>
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
                      <VehicleOwnerDisclosure vehicle={listing.vehicle} compact />
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
          </div>
        </div>
      </div>
    </section>
  );
}
