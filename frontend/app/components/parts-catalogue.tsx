"use client";
import { FindPartsForCar } from "./find-parts-for-car";
import { PartFitmentSummary } from "./part-fitment-summary";
import {
  clearVehicleSelection,
  vehicleSelectionKeys,
  fitmentLabels,
  partsEnquiryHref,
  productFitmentHref,
} from "@/lib/parts-fitment";
import type { PublicSeed } from "@/lib/api/public-seed";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CarFront,
  ChevronDown,
  CircleCheck,
  CircleMinus,
  Package,
  PackageSearch,
  X,
} from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import { parseProductDiscovery } from "@/lib/api/commerce-schemas";
import { formatKobo } from "@/lib/format/money";
import {
  advancedProductKeys,
  normalizeProductQuery,
  productApiPath,
  productFilterKeys,
} from "@/lib/product-discovery";
import {
  ProductFilters,
  ProductSearch,
  type UpdateProductQuery,
} from "../parts/product-filters";
import { ProductCategory, useProductCategories } from "../parts/product-category";
import { Feedback } from "./feedback";
import { PublicMedia } from "./public-media";

export function PartsCatalogue({
  initial,
}: {
  initial?: PublicSeed<ReturnType<typeof parseProductDiscovery>>;
}) {
  const searchParams = useSearchParams();
  const [searchReset, setSearchReset] = useState(0);
  const { params, invalid } = normalizeProductQuery(
    new URLSearchParams(searchParams.toString()),
  );
  const products = useResource(
    productApiPath(params),
    parseProductDiscovery,
    initial?.data,
    {
      initialError: initial?.error,
      revalidateOnMount: false,
    },
  );
  const categories = useProductCategories(params.get("categoryId") ?? "");
  const categoryShortcuts = categories.items.slice(0, 3);
  if (
    categories.selected &&
    !categoryShortcuts.some((item) => item.id === categories.selected?.id)
  )
    categoryShortcuts.push(categories.selected);
  const selected = [...new Set(productFilterKeys)].filter(
    (key) =>
      params.has(key) &&
      !["vehicleMakeId", "vehicleModelId"].includes(key) &&
      !(key === "year" && params.has("vehicleModelId")),
  );
  const vehicleQuery = new URLSearchParams(
    [...params].filter(([key]) =>
      (vehicleSelectionKeys as readonly string[]).includes(key),
    ),
  ).toString();
  const advanced = new URLSearchParams(
    [...params].filter(([key]) =>
      (advancedProductKeys as readonly string[]).includes(key),
    ),
  ).toString();
  const trail = params.get("_trail")?.split(",") ?? [];
  function navigate(next: URLSearchParams) {
    const normalized = normalizeProductQuery(next).params.toString();
    const url = `/parts${normalized ? `?${normalized}` : ""}${window.location.hash}`;
    if (
      url !==
      `${window.location.pathname}${window.location.search}${window.location.hash}`
    )
      window.history.pushState(null, "", url);
  }
  const update: UpdateProductQuery = (change) => {
    const next = normalizeProductQuery(
      new URLSearchParams(window.location.search),
    ).params;
    change(next);
    next.delete("cursor");
    next.delete("_trail");
    navigate(next);
  };
  function clear() {
    setSearchReset((value) => value + 1);
    update((next) => {
      for (const key of productFilterKeys) next.delete(key);
    });
  }
  function focusResults() {
    document.getElementById("product-results-heading")?.focus({ preventScroll: true });
    document
      .getElementById("products")
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
      <div className="product-search-panel">
        <div className="product-inventory-heading">
          <h2 id="product-results-heading" tabIndex={-1}>
            Explore automotive products
          </h2>
          <p role="status" aria-live="polite">
            {products.loading
              ? "Loading products…"
              : products.error
                ? "Products unavailable"
                : `${(products.data?.totalMatches ?? 0).toLocaleString("en-NG")} matching product${products.data?.totalMatches === 1 ? "" : "s"} · ${products.data?.items.length ?? 0} product${products.data?.items.length === 1 ? "" : "s"} on this page`}
          </p>
        </div>
        <FindPartsForCar
          key={vehicleQuery}
          query={vehicleQuery}
          enquiryQuery={params.toString()}
          update={update}
        />
        {invalid && (
          <p className="notice">
            Some filters in this link were invalid and have been ignored. Review the
            filters below.
          </p>
        )}
        <div className="product-toolbar">
          <ProductSearch
            key={searchReset}
            value={params.get("search") ?? ""}
            update={update}
          />
          <ProductCategory
            value={params.get("categoryId") ?? ""}
            categories={categories}
            onChange={(id) =>
              update((next) => {
                next.delete("categoryId");
                if (id) next.set("categoryId", id);
              })
            }
          />
          <ProductFilters
            query={advanced}
            count={selected.length}
            update={update}
            clear={clear}
          />
          <div className="product-sort">
            <label htmlFor="product-sort">Sort by</label>
            <div className="product-select">
              <select
                id="product-sort"
                value={params.get("sort") ?? "newest"}
                onChange={(event) =>
                  update((next) => next.set("sort", event.target.value))
                }
              >
                <option value="newest">Newest products</option>
                <option value="name">Name</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
              </select>
              <ChevronDown size={16} aria-hidden="true" />
            </div>
          </div>
        </div>
        {(categoryShortcuts.length > 0 || categories.loading) && (
          <fieldset className="product-category-shortcuts">
            <legend>Category shortcuts</legend>
            <div>
              <button
                type="button"
                aria-label="All product categories"
                aria-pressed={!params.has("categoryId")}
                onClick={() => update((next) => next.delete("categoryId"))}
              >
                All products
              </button>
              {categoryShortcuts.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  title={item.name}
                  aria-label={`Category: ${item.name}`}
                  aria-pressed={params.get("categoryId") === item.id}
                  onClick={() => update((next) => next.set("categoryId", item.id))}
                >
                  <span>{item.name}</span>
                </button>
              ))}
            </div>
            <p>
              {categories.loading && !categoryShortcuts.length
                ? "Loading category shortcuts…"
                : "Use Category for more options."}
            </p>
          </fieldset>
        )}
      </div>
      {params.has("vehicleModelId") &&
        !products.loading &&
        !products.error &&
        products.data?.verifiedMatches === 0 && (
          <aside className="parts-fitment-help" role="status">
            <h3>No verified match for these details</h3>
            <p>
              {products.data.totalMatches
                ? "The products below are candidates requiring verification. Our team can check the missing specifications."
                : "We could not confirm a matching part. Send your vehicle details to our team."}{" "}
              Collection only; delivery is unavailable.
            </p>
            <Link className="button secondary" href={partsEnquiryHref(params)}>
              Request the right part
            </Link>
          </aside>
        )}
      <div className="product-active-filters" aria-label="Active product filters">
        {selected.length || params.has("vehicleModelId") ? (
          <>
            {params.has("vehicleModelId") && (
              <button
                type="button"
                className="product-chip"
                onClick={() => update(clearVehicleSelection)}
                aria-label="Remove selected vehicle"
              >
                Selected vehicle - {params.get("year")} <X size={14} aria-hidden="true" />
              </button>
            )}
            {selected.map((key) => {
              const value = params.get(key)!;
              const label =
                key === "categoryId"
                  ? `Category: ${categories.selected?.name ?? (categories.selectedError ? "Unavailable category" : "Loading…")}`
                  : key === "featured"
                    ? value === "true"
                      ? "Featured only"
                      : "Non-featured only"
                    : key === "minPriceKobo"
                      ? `Minimum price: ${formatKobo(value)}`
                      : key === "maxPriceKobo"
                        ? `Maximum price: ${formatKobo(value)}`
                        : key === "availability"
                          ? value === "in_stock"
                            ? "In stock"
                            : "Out of stock"
                          : `${key[0].toUpperCase()}${key.slice(1)}: ${value}`;
              return (
                <button
                  type="button"
                  key={key}
                  className="product-chip"
                  aria-label={`Remove ${label}`}
                  title={label}
                  onClick={() =>
                    update((next) => {
                      next.delete(key);
                      if (key === "make") next.delete("model");
                    })
                  }
                >
                  <span>
                    {key in fitmentLabels
                      ? `${fitmentLabels[key as keyof typeof fitmentLabels]}: ${value}`
                      : key === "fitment"
                        ? value === "verified"
                          ? "Verified matches only"
                          : "Fitment candidates"
                        : label}
                  </span>
                  <X size={14} aria-hidden="true" />
                </button>
              );
            })}
            <button type="button" className="product-clear" onClick={clear}>
              Clear all
            </button>
          </>
        ) : (
          <span>Search by name, brand or part number, or choose a category.</span>
        )}
      </div>
      <div className="product-results" aria-busy={products.loading}>
        {products.error ? (
          <div className="product-empty">
            <h3>Products could not be loaded.</h3>
            <Feedback message={products.error} />
            <button
              className="button secondary"
              onClick={products.refresh}
              disabled={products.loading}
            >
              Retry products
            </button>
            {params.has("cursor") && (
              <button className="button secondary" onClick={() => update(() => {})}>
                Start from first page
              </button>
            )}
          </div>
        ) : products.loading ? (
          <div className="product-results-grid" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <div className="product-skeleton" key={i}>
                <div />
                <span />
                <span />
                <span />
                <span />
              </div>
            ))}
          </div>
        ) : products.data?.items.length ? (
          <div className="product-results-grid">
            {products.data.items.map((product) => {
              const photo =
                product.images.find((image) => image.isPrimary) ?? product.images[0];
              const available = product.availability.some((item) => item.inStock);
              const comparison =
                product.compareAtPriceKobo &&
                BigInt(product.compareAtPriceKobo) > BigInt(product.priceKobo)
                  ? product.compareAtPriceKobo
                  : null;
              const fitment = product.compatibilities[0];
              return (
                <article className="product-card shop-product-card" key={product.id}>
                  <Link href={productFitmentHref(product.id, params)}>
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
                        {product.brand && (
                          <p className="shop-product-brand">{product.brand}</p>
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
                      <p
                        className={`shop-stock-label${available ? " is-available" : ""}`}
                      >
                        {available ? (
                          <CircleCheck size={14} aria-hidden="true" />
                        ) : (
                          <CircleMinus size={14} aria-hidden="true" />
                        )}
                        <span>
                          {available
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
                              <span className="shop-fitment-label">
                                Reviewed application listed
                              </span>
                              <p>
                                {fitment.make}
                                {fitment.model ? ` ${fitment.model}` : ""}
                              </p>
                              <span>
                                Select your vehicle and technical details to confirm
                                fitment.
                              </span>
                            </>
                          ) : (
                            <>
                              <p>Fitment unknown</p>
                              <span>
                                Choose your vehicle or ask our team to verify suitability.
                              </span>
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
            })}
          </div>
        ) : (
          <div className="product-empty">
            <PackageSearch size={30} strokeWidth={1.4} aria-hidden="true" />
            <h3>
              {params.has("cursor")
                ? "No products on this page"
                : selected.length
                  ? "No matching products"
                  : "No products are listed yet"}
            </h3>
            <p>
              {selected.length
                ? "Try a broader search or clear your filters."
                : "Contact our team to ask about the product you need."}
            </p>
            <div className="actions">
              {params.has("cursor") && (
                <button className="button secondary" onClick={() => update(() => {})}>
                  Return to first page
                </button>
              )}
              {selected.length > 0 && (
                <button className="button secondary" onClick={clear}>
                  Clear filters
                </button>
              )}
              <Link className="button" href="/contact">
                Ask about a product
              </Link>
            </div>
          </div>
        )}
      </div>
      <nav className="product-pagination" aria-label="Shop pages">
        <button
          className="button secondary"
          disabled={!params.has("cursor") || products.loading}
          onClick={() => {
            const next = new URLSearchParams(params),
              previous = trail.at(-1);
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
              : "More products"}
        </span>
        <button
          className="button secondary"
          disabled={!products.data?.nextCursor || products.loading || !!products.error}
          onClick={() => {
            const next = new URLSearchParams(params);
            next.set("cursor", products.data!.nextCursor!);
            const previous = params.get("cursor");
            if (!previous || (trail.length && trail.length < 50))
              next.set("_trail", [...trail, previous ?? "start"].join(","));
            else next.delete("_trail");
            navigate(next);
            focusResults();
          }}
        >
          Next <ArrowRight size={16} aria-hidden="true" />
        </button>
      </nav>
    </>
  );
}
