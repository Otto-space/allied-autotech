"use client";
import type { PublicSeed } from "@/lib/api/public-seed";
import Link from "next/link";
import { useResource } from "@/lib/api/use-resource";
import { parseProducts } from "@/lib/api/commerce-schemas";
import { parseListings } from "@/lib/api/vehicle-schemas";
import { formatKobo } from "@/lib/format/money";
import { PublicMedia } from "./public-media";
import { Feedback } from "./feedback";

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
    <div className="home-catalogue-preview">
      <Feedback message={parts.error} />
      {parts.error && (
        <button className="button secondary" onClick={parts.refresh}>
          Retry featured parts
        </button>
      )}
      {parts.loading && <p role="status">Loading catalogue parts…</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
        {(!parts.error ? parts.data : undefined)?.items.map((part) => {
          const media = part.images.find((item) => item.isPrimary) ?? part.images[0];
          return (
            <article
              className="border border-line rounded bg-white overflow-hidden"
              key={part.id}
            >
              <PublicMedia src={media?.url} alt={media?.altText ?? part.name} />
              <div className="p-5">
                <h3 className="text-lg font-bold">
                  <Link className="text-link" href={`/parts/${part.id}`}>
                    {part.name}
                  </Link>
                </h3>
                <p className="muted text-sm mt-2">{part.category.name}</p>
                <p className="font-bold mt-3">{formatKobo(part.priceKobo)}</p>
              </div>
            </article>
          );
        })}
      </div>
      {!parts.loading && !parts.error && parts.data?.items.length === 0 && (
        <p>No parts are published yet. Contact the team with the part you need.</p>
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
    <div className="home-catalogue-preview">
      <Feedback message={listings.error} />
      {listings.error && (
        <button className="button secondary" onClick={listings.refresh}>
          Retry featured vehicles
        </button>
      )}
      {listings.loading && <p role="status">Loading vehicle listings…</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {(!listings.error ? listings.data : undefined)?.items.map((listing) => {
          const media =
            listing.vehicle.images.find((item) => item.isPrimary) ??
            listing.vehicle.images[0];
          return (
            <article
              className="border border-white/20 rounded bg-white text-ink overflow-hidden"
              key={listing.id}
            >
              <PublicMedia src={media?.url} alt={media?.altText ?? listing.title} />
              <div className="p-6">
                <h3 className="text-xl font-bold">
                  <Link className="text-link" href={`/vehicles/${listing.id}`}>
                    {listing.title}
                  </Link>
                </h3>
                <p className="muted mt-2">
                  {listing.vehicle.year} · {listing.vehicle.make} {listing.vehicle.model}
                </p>
                <p className="font-bold mt-3">{formatKobo(listing.priceKobo)}</p>
              </div>
            </article>
          );
        })}
      </div>
      {!listings.loading && !listings.error && listings.data?.items.length === 0 && (
        <p>No vehicles are published yet. Contact the team about your vehicle search.</p>
      )}
    </div>
  );
}
