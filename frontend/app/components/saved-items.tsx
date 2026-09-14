"use client";
import Link from "next/link";
import { useState } from "react";
import { z } from "zod";
import { apiRequest, ApiError } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { productSchema } from "@/lib/api/commerce-schemas";
import { listingSchema } from "@/lib/api/vehicle-schemas";
import { formatKobo } from "@/lib/format/money";
import { Feedback } from "./feedback";
import { PublicMedia } from "./public-media";
import { CursorPagination, useCursorPage } from "./cursor-pagination";

const parseFavourites = (value: unknown) =>
  z
    .object({
      items: z.array(z.object({ id: z.string().uuid(), product: productSchema })),
      nextCursor: z.string().optional(),
    })
    .parse(value);
const parseSavedVehicles = (value: unknown) =>
  z
    .array(z.object({ id: z.string().uuid(), vehicleListing: listingSchema }))
    .parse(value);

export function SavedItems() {
  const pagination = useCursorPage();
  const parts = useResource(
    `/customers/favourites?limit=12${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`,
    parseFavourites,
  );
  const vehicles = useResource("/customers/saved-vehicles", parseSavedVehicles);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  async function remove(kind: "part" | "vehicle", id: string) {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    try {
      await apiRequest(
        `/customers/${kind === "part" ? "favourites" : "saved-vehicles"}/${id}`,
        { method: "DELETE", csrf: true, body: {} },
      );
      (kind === "part" ? parts : vehicles).refresh();
      setMessage("Removed from your saved items.");
    } catch (value) {
      setError(
        value instanceof ApiError
          ? value.message
          : "The change could not be confirmed. Refresh your saved items.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>Saved items</h1>
      <p className="lead">
        Keep track of parts and vehicles you are considering. Saving an item does not
        reserve it.
      </p>
      <Feedback message={error} />
      <Feedback message={message} tone="success" />
      <section className="detail-section">
        <h2>Favourite parts</h2>
        <Feedback message={parts.error} />
        <button
          className="button secondary"
          disabled={parts.loading}
          onClick={parts.refresh}
        >
          Refresh favourite parts
        </button>
        {parts.loading && <p role="status">Loading favourite parts…</p>}
        <div className="catalogue-grid">
          {parts.data?.items.map(({ id, product }) => (
            <article className="card" key={id}>
              <PublicMedia src={product.images[0]?.url} alt={product.name} />
              <h3>
                <Link href={`/parts/${product.id}`}>{product.name}</Link>
              </h3>
              <p>{formatKobo(product.priceKobo)}</p>
              <button
                className="text-link"
                disabled={busy}
                onClick={() => void remove("part", product.id)}
                aria-label={`Remove ${product.name} from favourites`}
              >
                Remove favourite
              </button>
            </article>
          ))}
        </div>
        {!parts.loading && !parts.error && parts.data?.items.length === 0 && (
          <div className="empty">
            <p>No favourite parts on this page.</p>
            <Link className="text-link" href="/parts">
              Browse parts
            </Link>
          </div>
        )}
        <CursorPagination
          pagination={pagination}
          nextCursor={parts.data?.nextCursor}
          disabled={parts.loading || !!parts.error}
          label="Favourite parts"
        />
      </section>
      <section className="detail-section">
        <h2>Saved vehicles</h2>
        <p className="muted">
          This list includes saved listings that are currently available.
        </p>
        <Feedback message={vehicles.error} />
        <button
          className="button secondary"
          disabled={vehicles.loading}
          onClick={vehicles.refresh}
        >
          Refresh saved vehicles
        </button>
        {vehicles.loading && <p role="status">Loading saved vehicles…</p>}
        <div className="catalogue-grid">
          {vehicles.data?.map(({ id, vehicleListing: listing }) => (
            <article className="card" key={id}>
              <PublicMedia src={listing.vehicle.images[0]?.url} alt={listing.title} />
              <h3>
                <Link href={`/vehicles/${listing.id}`}>{listing.title}</Link>
              </h3>
              <p>{formatKobo(listing.priceKobo)}</p>
              <button
                className="text-link"
                disabled={busy}
                onClick={() => void remove("vehicle", listing.id)}
                aria-label={`Remove ${listing.title} from saved vehicles`}
              >
                Remove saved vehicle
              </button>
            </article>
          ))}
        </div>
        {!vehicles.loading && !vehicles.error && vehicles.data?.length === 0 && (
          <div className="empty">
            <p>No available saved vehicles.</p>
            <Link className="text-link" href="/vehicles">
              Browse vehicles
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
