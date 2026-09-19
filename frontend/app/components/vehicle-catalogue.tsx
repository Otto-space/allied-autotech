"use client";
import type { PublicSeed } from "@/lib/api/public-seed";
import Link from "next/link";
import { useState } from "react";
import { useResource } from "@/lib/api/use-resource";
import { parseListings } from "@/lib/api/vehicle-schemas";
import { formatKobo } from "@/lib/format/money";
import { Feedback } from "./feedback";
import { PublicMedia } from "./public-media";
export function VehicleCatalogue({
  initial,
}: {
  initial?: PublicSeed<ReturnType<typeof parseListings>>;
}) {
  const [filters, setFilters] = useState("");
  const [cursor, setCursor] = useState<string>();
  const [history, setHistory] = useState<(string | undefined)[]>([]);
  const listings = useResource(
    `/public/vehicles?limit=12${filters}${cursor ? `&cursor=${cursor}` : ""}`,
    parseListings,
    initial?.data,
    { initialError: initial?.error, revalidateOnMount: false },
  );
  return (
    <>
      <noscript>
        <p className="notice">
          Enable JavaScript to filter, load more results or refresh this list. You can
          still follow links on this page.
        </p>
      </noscript>
      <form
        className="catalogue-filters"
        onSubmit={(event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          const params = new URLSearchParams();
          for (const [key, value] of values)
            if (String(value).trim()) params.set(key, String(value).trim());
          setFilters(`&${params}`);
          setCursor(undefined);
          setHistory([]);
        }}
        onReset={() => {
          setFilters("");
          setCursor(undefined);
          setHistory([]);
        }}
      >
        <div className="field">
          <label htmlFor="vehicle-search">Search vehicles</label>
          <input
            id="vehicle-search"
            type="search"
            name="search"
            maxLength={100}
            placeholder="Make, model or title"
          />
        </div>
        <div className="field">
          <label htmlFor="listing-make">Make (optional)</label>
          <input id="listing-make" name="make" maxLength={80} />
        </div>
        <div className="field">
          <label htmlFor="vehicle-sort">Sort by</label>
          <select id="vehicle-sort" name="sort">
            <option value="newest">Newest listings</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="year_desc">Newest model year</option>
          </select>
        </div>
        <details className="fitment-filters">
          <summary>More vehicle filters</summary>
          <div className="form-row">
            <div className="field">
              <label htmlFor="listing-model">Model (optional)</label>
              <input id="listing-model" name="model" maxLength={80} />
            </div>
            <div className="field">
              <label htmlFor="listing-year">Year (optional)</label>
              <input
                id="listing-year"
                name="year"
                type="number"
                inputMode="numeric"
                min={1886}
                max={2200}
              />
            </div>
            <div className="field">
              <label htmlFor="listing-transmission">Transmission</label>
              <select id="listing-transmission" name="transmission">
                <option value="">Any transmission</option>
                {["AUTOMATIC", "MANUAL", "CVT", "OTHER"].map((value) => (
                  <option key={value} value={value}>
                    {value.toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="listing-fuel">Fuel type</label>
              <select id="listing-fuel" name="fuelType">
                <option value="">Any fuel type</option>
                {["PETROL", "DIESEL", "HYBRID", "ELECTRIC", "OTHER"].map((value) => (
                  <option key={value} value={value}>
                    {value.toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </details>
        <div className="actions">
          <button className="button">Find vehicles</button>
          <button className="button secondary" type="reset">
            Reset filters
          </button>
        </div>
      </form>
      <Feedback message={listings.error} />
      {listings.error && (
        <button className="button secondary" onClick={listings.refresh}>
          Retry vehicles
        </button>
      )}
      {listings.loading && (
        <p role="status">{listings.data ? "Updating vehicles…" : "Loading vehicles…"}</p>
      )}
      <div className="record-grid">
        {(!listings.error ? listings.data : undefined)?.items.map((listing) => (
          <article className="product-card" key={listing.id}>
            <Link href={`/vehicles/${listing.id}`}>
              <PublicMedia
                src={
                  (
                    listing.vehicle.images.find((image) => image.isPrimary) ??
                    listing.vehicle.images[0]
                  )?.url
                }
                alt={listing.title}
              />
              <div className="product-copy">
                <span className="muted">
                  {listing.vehicle.year} · {listing.vehicle.condition.toLowerCase()}
                </span>
                <h2>{listing.title}</h2>
                <p>
                  {listing.vehicle.mileageKm === null
                    ? "Mileage not listed"
                    : `${listing.vehicle.mileageKm.toLocaleString("en-NG")} km`}{" "}
                  ·{" "}
                  {listing.vehicle.transmission?.toLowerCase() ??
                    "Transmission not listed"}
                </p>
                <strong>{formatKobo(listing.priceKobo)}</strong>
                <p>{listing.branch.name}</p>
              </div>
            </Link>
          </article>
        ))}
      </div>
      {!listings.loading && !listings.error && listings.data?.items.length === 0 && (
        <div className="empty">
          <h2>{filters ? "No matching vehicles" : "No vehicles are listed yet"}</h2>
          <p>Contact our team to discuss what you are looking for.</p>
          <Link className="button secondary" href="/contact">
            Contact Allied AutoTech
          </Link>
        </div>
      )}
      <nav className="pagination" aria-label="Vehicle listing pages">
        <button
          className="button secondary"
          disabled={!history.length || listings.loading}
          onClick={() => {
            setCursor(history.at(-1));
            setHistory((value) => value.slice(0, -1));
          }}
        >
          Previous
        </button>
        <span>Page {history.length + 1}</span>
        <button
          className="button secondary"
          disabled={!listings.data?.nextCursor || listings.loading || !!listings.error}
          onClick={() => {
            setHistory((value) => [...value, cursor]);
            setCursor(listings.data?.nextCursor);
          }}
        >
          Next
        </button>
      </nav>
    </>
  );
}
