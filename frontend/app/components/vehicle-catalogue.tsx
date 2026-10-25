"use client";
import type { PublicSeed } from "@/lib/api/public-seed";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CarFront, ChevronDown, X } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import { parseVehicleDiscovery } from "@/lib/api/vehicle-schemas";
import { formatKobo } from "@/lib/format/money";
import {
  normalizeVehicleQuery,
  vehicleApiPath,
  vehicleFilterKeys,
  vehicleLabel,
  advancedVehicleKeys,
} from "@/lib/vehicle-discovery";
import {
  VehicleFilters,
  VehicleSearch,
  type UpdateVehicleQuery,
} from "../vehicles/vehicle-filters";
import { Feedback } from "./feedback";
import { VehicleCard } from "./catalogue-cards";

export function VehicleCatalogue({
  initial,
}: {
  initial?: PublicSeed<ReturnType<typeof parseVehicleDiscovery>>;
}) {
  const searchParams = useSearchParams();
  const { params, invalid } = normalizeVehicleQuery(
    new URLSearchParams(searchParams.toString()),
  );
  const listings = useResource(
    vehicleApiPath(params),
    parseVehicleDiscovery,
    initial?.data,
    {
      initialError: initial?.error,
      revalidateOnMount: false,
    },
  );
  const selected = vehicleFilterKeys.filter((key) => params.has(key));
  const publication = useResource(
    selected.length || params.has("cursor") ? "/public/vehicles/discovery?limit=1" : null,
    parseVehicleDiscovery,
  );
  const noCatalogue =
    listings.data?.items.length === 0 &&
    !listings.loading &&
    !listings.error &&
    !listings.refreshError &&
    !publication.loading &&
    !publication.error &&
    !publication.refreshError &&
    (selected.length || params.has("cursor")
      ? publication.data?.totalMatches === 0
      : listings.data?.totalMatches === 0);
  const advanced = new URLSearchParams(
    [...params].filter(([key]) =>
      (advancedVehicleKeys as readonly string[]).includes(key),
    ),
  ).toString();
  const trail = params.get("_trail")?.split(",") ?? [];
  const bodyTypes = ["SUV", "SEDAN", "HATCHBACK", "PICKUP"];
  const selectedBody = params.get("bodyType");
  if (selectedBody && !bodyTypes.includes(selectedBody)) bodyTypes.push(selectedBody);
  function navigate(next: URLSearchParams) {
    const normalized = normalizeVehicleQuery(next).params.toString();
    const url = `/vehicles${normalized ? `?${normalized}` : ""}${window.location.hash}`;
    if (
      url !==
      `${window.location.pathname}${window.location.search}${window.location.hash}`
    )
      window.history.pushState(null, "", url);
  }
  const update: UpdateVehicleQuery = (change) => {
    const next = normalizeVehicleQuery(
      new URLSearchParams(window.location.search),
    ).params;
    change(next);
    next.delete("cursor");
    next.delete("_trail");
    navigate(next);
  };
  function clear() {
    update((next) => {
      for (const key of vehicleFilterKeys) next.delete(key);
    });
  }
  function focusResults() {
    document.getElementById("vehicle-results-heading")?.focus({ preventScroll: true });
    document
      .getElementById("inventory")
      ?.scrollIntoView({ behavior: "instant", block: "start" });
  }
  return (
    <>
      <noscript>
        <p className="notice">
          Enable JavaScript to filter, load more results or refresh this list. You can
          still follow links on this page.
        </p>
      </noscript>
      <div className="vehicle-search-panel">
        <div className="vehicle-inventory-heading">
          <h2 id="vehicle-results-heading" tabIndex={-1}>
            Explore current listings
          </h2>
          <p role="status" aria-live="polite">
            {listings.loading
              ? "Loading vehicles…"
              : listings.error
                ? "Listings unavailable"
                : noCatalogue
                  ? ""
                  : `${listings.data?.totalMatches.toLocaleString("en-NG") ?? 0} matching vehicle${listings.data?.totalMatches === 1 ? "" : "s"} · ${listings.data?.items.length ?? 0} vehicle${listings.data?.items.length === 1 ? "" : "s"} on this page`}
          </p>
        </div>
        {invalid && (
          <p className="notice">
            Some filters in this link were invalid and have been ignored. Review the
            filters below.
          </p>
        )}
        <details
          className="catalogue-controls"
          open={!noCatalogue || selected.length > 0}
        >
          <summary>Search and vehicle preferences</summary>
          <div className="vehicle-toolbar">
            <VehicleSearch value={params.get("search") ?? ""} update={update} />
            <VehicleFilters query={advanced} count={selected.length} update={update} />
            <div className="vehicle-sort" hidden={noCatalogue}>
              <label htmlFor="vehicle-sort">Sort by</label>
              <div className="vehicle-select">
                <select
                  id="vehicle-sort"
                  value={params.get("sort") ?? "newest"}
                  onChange={(e) => update((next) => next.set("sort", e.target.value))}
                >
                  <option value="newest">Newest listings</option>
                  <option value="price_asc">Price: low to high</option>
                  <option value="price_desc">Price: high to low</option>
                  <option value="year_desc">Newest model year</option>
                  <option value="year_asc">Oldest model year</option>
                  <option value="mileage_asc">Mileage: low to high</option>
                  <option value="mileage_desc">Mileage: high to low</option>
                </select>
                <ChevronDown size={16} aria-hidden="true" />
              </div>
            </div>
          </div>
          <p className="vehicle-search-guidance">
            Search by listing title or vehicle details. Use Filters for condition, price
            and specifications; choose Apply filters to update the results.
          </p>
          <fieldset className="vehicle-body-shortcuts">
            <legend>Body type</legend>
            <div>
              <button
                type="button"
                aria-pressed={!selectedBody}
                onClick={() => update((next) => next.delete("bodyType"))}
              >
                All types
              </button>
              {bodyTypes.map((body) => (
                <button
                  type="button"
                  key={body}
                  aria-pressed={selectedBody === body}
                  onClick={() => update((next) => next.set("bodyType", body))}
                >
                  {vehicleLabel(body)}
                </button>
              ))}
              <span>More types in Filters.</span>
            </div>
          </fieldset>
        </details>
      </div>
      <div className="vehicle-active-filters" aria-label="Active vehicle filters">
        {selected.length ? (
          <>
            {selected
              .flatMap((key) =>
                ["conditions", "powertrains"].includes(key)
                  ? params
                      .get(key)!
                      .split(",")
                      .map((value) => ({ key, value }))
                  : [{ key, value: params.get(key)! }],
              )
              .map(({ key, value }) => {
                const label =
                  key === "search"
                    ? `Search: ${value}`
                    : key.endsWith("Kobo")
                      ? `${key === "minPriceKobo" ? "From" : "Up to"} ${formatKobo(value)}`
                      : key === "featured"
                        ? value === "true"
                          ? "Featured only"
                          : "Non-featured only"
                        : `${vehicleLabel(key === "bodyType" ? "Body" : key === "fuelType" ? "Fuel" : key === "conditions" ? "Condition" : key === "powertrains" ? "Powertrain Technology" : key)}: ${["make", "model", "year"].includes(key) ? value : vehicleLabel(value)}`;
                return (
                  <button
                    type="button"
                    key={`${key}:${value}`}
                    className="vehicle-chip"
                    aria-label={`Remove ${label}`}
                    title={label}
                    onClick={() =>
                      update((next) => {
                        if (["conditions", "powertrains"].includes(key)) {
                          const remaining = next
                            .get(key)!
                            .split(",")
                            .filter((option) => option !== value);
                          if (remaining.length) next.set(key, remaining.join(","));
                          else next.delete(key);
                        } else next.delete(key);
                        if (key === "make") next.delete("model");
                        if (key === "make" || key === "model") next.delete("trim");
                      })
                    }
                  >
                    <span>{label}</span>
                    <X size={14} aria-hidden="true" />
                  </button>
                );
              })}
            <button type="button" className="vehicle-clear" onClick={clear}>
              Clear all
            </button>
          </>
        ) : (
          <span>
            {noCatalogue
              ? "Share your budget and vehicle preferences with our team."
              : "Search by name, or refine by price and vehicle details."}
          </span>
        )}
      </div>
      {listings.refreshError && !!listings.data?.items.length && (
        <div className="notice">
          <Feedback message={listings.refreshError} />
          <button type="button" className="button secondary" onClick={listings.refresh}>
            Retry vehicles
          </button>
        </div>
      )}
      <div
        className="vehicle-results"
        aria-busy={listings.loading || listings.refreshing}
      >
        {listings.error || (listings.refreshError && !listings.data?.items.length) ? (
          <div className="vehicle-empty">
            <Feedback message={listings.error ?? listings.refreshError} />
            <button
              className="button secondary"
              onClick={listings.refresh}
              disabled={listings.loading}
            >
              Retry vehicles
            </button>
            {params.has("cursor") && (
              <button className="button secondary" onClick={() => update(() => {})}>
                Start from first page
              </button>
            )}
          </div>
        ) : listings.loading ? (
          <div className="vehicle-results-grid" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div className="vehicle-skeleton" key={i}>
                <div />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            ))}
          </div>
        ) : listings.data?.items.length ? (
          <div className="vehicle-results-grid">
            {listings.data.items.map((listing) => (
              <VehicleCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
          <div className="vehicle-empty">
            <CarFront size={30} strokeWidth={1.4} aria-hidden="true" />
            <h3>
              {params.has("cursor")
                ? "No vehicles on this page"
                : selected.length
                  ? noCatalogue
                    ? "No vehicles are published yet"
                    : "No matching vehicles"
                  : "No vehicles are published yet"}
            </h3>
            <p>
              {params.has("cursor")
                ? "Listings may have changed. Return to the first page to check current results."
                : noCatalogue
                  ? "Our online vehicle catalogue has no published listings. Tell our team your budget, preferred make and requirements."
                  : selected.length
                    ? "Try a broader search or contact our team about the vehicle you have in mind."
                    : "Speak with our team about what you are looking for, or check back for current listings."}
            </p>
            <div className="actions">
              {params.has("cursor") && (
                <button className="button secondary" onClick={() => update(() => {})}>
                  Start from first page
                </button>
              )}
              {selected.length > 0 && (
                <button className="button secondary" onClick={clear}>
                  Clear filters
                </button>
              )}
              <Link className="button" href="/contact">
                Contact our team
              </Link>
            </div>
          </div>
        )}
      </div>
      {!!listings.data?.items.length &&
        !listings.error &&
        (params.has("cursor") || listings.data.nextCursor) && (
          <nav className="vehicle-pagination" aria-label="Vehicle listing pages">
            <button
              className="button secondary"
              disabled={!params.has("cursor") || listings.loading}
              onClick={() => {
                const next = new URLSearchParams(params);
                const previous = trail.at(-1);
                next.delete("cursor");
                next.delete("_trail");
                if (previous && previous !== "start") {
                  next.set("cursor", previous);
                  if (trail.length > 1) next.set("_trail", trail.slice(0, -1).join(","));
                }
                navigate(next);
                focusResults();
              }}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              {params.has("cursor") && !trail.length ? "First page" : "Previous"}
            </button>
            <span>
              {!params.has("cursor")
                ? "Page 1"
                : trail.length
                  ? `Page ${trail.length + 1}`
                  : "More listings"}
            </span>
            <button
              className="button secondary"
              disabled={
                !listings.data?.nextCursor || listings.loading || !!listings.error
              }
              onClick={() => {
                const next = new URLSearchParams(params);
                next.set("cursor", listings.data!.nextCursor!);
                const previous = params.get("cursor");
                if (!previous || (trail.length && trail.length < 50))
                  next.set("_trail", [...trail, previous ?? "start"].join(","));
                else next.delete("_trail");
                navigate(next);
                focusResults();
              }}
            >
              Next
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </nav>
        )}
    </>
  );
}
