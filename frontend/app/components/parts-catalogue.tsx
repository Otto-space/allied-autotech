"use client";
import { FindPartsForCar, usePartsMakeCatalogue } from "./find-parts-for-car";
import { PartCard } from "./catalogue-cards";
import {
  clearVehicleSelection,
  vehicleSelectionKeys,
  fitmentLabels,
  partsEnquiryHref,
} from "@/lib/parts-fitment";
import type { PublicSeed } from "@/lib/api/public-seed";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronDown, PackageSearch, X } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import { parseProductDiscovery } from "@/lib/api/commerce-schemas";
import { formatKobo } from "@/lib/format/money";
import {
  advancedProductKeys,
  normalizeProductQuery,
  productApiPath,
  productFilterKeys,
  clearProductFamilyFilters,
} from "@/lib/product-discovery";
import { familyLabels, packVolumeLabel } from "@/lib/product-family";
import {
  ProductFilters,
  ProductSearch,
  type UpdateProductQuery,
} from "../parts/product-filters";
import {
  ProductCategory,
  useProductCategories,
  useProductCategory,
} from "../parts/product-category";
import { Feedback } from "./feedback";

export function PartsCatalogue({
  initial,
}: {
  initial?: PublicSeed<ReturnType<typeof parseProductDiscovery>>;
}) {
  const searchParams = useSearchParams();
  const [searchReset, setSearchReset] = useState(0);
  const makes = usePartsMakeCatalogue();
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
  const categoryId = params.get("categoryId") ?? "";
  const category = useProductCategory(categoryId);
  const rootId = params.get("parentCategoryId") ?? category.data?.parentId ?? categoryId;
  const childId =
    params.has("parentCategoryId") || category.data?.parentId ? categoryId : "";
  const categories = useProductCategories(rootId, "", true, { rootOnly: true });
  const subcategories = useProductCategories(childId, "", !!rootId, { parentId: rootId });
  const mismatchedCategory = !!(
    childId &&
    params.has("parentCategoryId") &&
    category.data &&
    category.data.parentId !== rootId
  );
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
  const filtered = selected.length > 0 || params.has("vehicleModelId");
  const categoryOnly =
    category.data?.id === categoryId &&
    selected.length > 0 &&
    selected.every((key) => key === "categoryId" || key === "parentCategoryId") &&
    !params.has("vehicleModelId");
  const publication = useResource(
    filtered || params.has("cursor")
      ? "/public/catalog/products/discovery?limit=1"
      : null,
    parseProductDiscovery,
  );
  const noCatalogue =
    products.data?.items.length === 0 &&
    !products.loading &&
    !products.error &&
    !products.refreshError &&
    !publication.loading &&
    !publication.error &&
    !publication.refreshError &&
    (filtered || params.has("cursor")
      ? publication.data?.totalMatches === 0
      : products.data?.totalMatches === 0);
  const [intent, setIntent] = useState<"part" | "vehicle">(
    params.has("vehicleModelId") ? "vehicle" : "part",
  );
  const [modeQuery, setModeQuery] = useState(vehicleQuery);
  if (modeQuery !== vehicleQuery) {
    setModeQuery(vehicleQuery);
    setIntent(params.has("vehicleModelId") ? "vehicle" : "part");
  }
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
                : noCatalogue
                  ? ""
                  : `${(products.data?.totalMatches ?? 0).toLocaleString("en-NG")} matching product${products.data?.totalMatches === 1 ? "" : "s"} · ${products.data?.items.length ?? 0} product${products.data?.items.length === 1 ? "" : "s"} on this page`}
          </p>
        </div>
        {invalid && (
          <p className="notice">
            Some filters in this link were invalid and have been ignored. Review the
            filters below.
          </p>
        )}
        <fieldset className="parts-intent">
          <legend>How would you like to find products?</legend>
          <label>
            <input
              type="radio"
              name="product-discovery-mode"
              checked={intent === "part"}
              onChange={() => {
                setIntent("part");
                update(clearVehicleSelection);
              }}
            />
            Search all products
          </label>
          <label>
            <input
              type="radio"
              name="product-discovery-mode"
              checked={intent === "vehicle"}
              onChange={() => setIntent("vehicle")}
            />
            {makes.data?.items.length
              ? "Find products for my vehicle"
              : "Get help choosing a product"}
          </label>
        </fieldset>
        <div className="product-direct-search">
          <ProductSearch
            key={searchReset}
            value={params.get("search") ?? ""}
            update={update}
          />
        </div>
        <div className="catalogue-controls">
          <div className="product-toolbar">
            {(categories.items.length > 0 ||
              categories.loading ||
              categories.error ||
              rootId) && (
              <ProductCategory
                value={rootId}
                categories={categories}
                scope={{ rootOnly: true }}
                onChange={(id) =>
                  update((next) => {
                    next.delete("categoryId");
                    next.delete("parentCategoryId");
                    clearProductFamilyFilters(next);
                    if (id) next.set("categoryId", id);
                  })
                }
              />
            )}
            {rootId &&
              (subcategories.items.length > 0 ||
                subcategories.loading ||
                subcategories.error ||
                childId) && (
                <ProductCategory
                  key={rootId}
                  title="Subcategory"
                  value={childId}
                  categories={subcategories}
                  scope={{ parentId: rootId }}
                  disabled={!rootId}
                  onChange={(id) =>
                    update((next) => {
                      next.delete("categoryId");
                      clearProductFamilyFilters(next);
                      if (rootId) next.set("parentCategoryId", rootId);
                      if (id) next.set("categoryId", id);
                    })
                  }
                />
              )}
            <ProductFilters
              query={advanced}
              count={
                selected.filter((key) => key !== "search").length +
                (params.has("vehicleModelId") ? 1 : 0)
              }
              update={update}
              clear={clear}
              scope={params.toString()}
            />
            <div className="product-sort" hidden={noCatalogue}>
              <label htmlFor="product-sort">Sort by</label>
              <div className="product-select">
                <select
                  id="product-sort"
                  value={
                    params.get("sort") ?? (params.has("search") ? "best_match" : "newest")
                  }
                  onChange={(event) =>
                    update((next) => next.set("sort", event.target.value))
                  }
                >
                  {params.has("search") && <option value="best_match">Best match</option>}
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
                  aria-pressed={!rootId}
                  onClick={() =>
                    update((next) => {
                      next.delete("categoryId");
                      next.delete("parentCategoryId");
                      clearProductFamilyFilters(next);
                    })
                  }
                >
                  All products
                </button>
                {categoryShortcuts.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    title={item.name}
                    aria-label={`Category: ${item.name}`}
                    aria-pressed={rootId === item.id}
                    onClick={() =>
                      update((next) => {
                        next.delete("parentCategoryId");
                        clearProductFamilyFilters(next);
                        next.set("categoryId", item.id);
                      })
                    }
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
        <div hidden={intent !== "vehicle"}>
          <FindPartsForCar
            makes={makes}
            query={vehicleQuery}
            enquiryQuery={params.toString()}
            update={update}
          />
        </div>
      </div>
      {mismatchedCategory && (
        <p className="notice" role="status">
          The selected subcategory does not belong to this category. Choose a subcategory
          or remove it.
        </p>
      )}
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
                key === "parentCategoryId"
                  ? `Category: ${categories.selected?.name ?? "Loading category"}`
                  : key === "categoryId"
                    ? `${childId ? "Subcategory" : "Category"}: ${(childId ? subcategories.selected : categories.selected)?.name ?? (category.error ? "Unavailable category" : "Loading category")}`
                    : key === "family"
                      ? `Product family: ${familyLabels[value as keyof typeof familyLabels]}`
                      : key === "oilViscosityGrade"
                        ? `Viscosity grade: ${value}`
                        : key === "packVolumeMl"
                          ? `Pack volume: ${packVolumeLabel(Number(value))}`
                          : key === "productType"
                            ? `Product type: ${value.replaceAll("_", " ")}`
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
                      if (
                        key === "family" ||
                        key === "categoryId" ||
                        key === "parentCategoryId"
                      )
                        clearProductFamilyFilters(next);
                      if (key === "parentCategoryId") next.delete("categoryId");
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
          <span>
            {noCatalogue
              ? "Your product preferences can be included in an enquiry."
              : "Search by name, brand or part number, or choose a category."}
          </span>
        )}
      </div>
      {products.refreshError && !!products.data?.items.length && (
        <div className="notice">
          <Feedback message={products.refreshError} />
          <button type="button" className="button secondary" onClick={products.refresh}>
            Retry products
          </button>
        </div>
      )}
      <div
        className="product-results"
        aria-busy={products.loading || products.refreshing}
      >
        {products.error || (products.refreshError && !products.data?.items.length) ? (
          <div className="product-empty">
            <h3>Products could not be loaded.</h3>
            <Feedback message={products.error ?? products.refreshError} />
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
            {products.data.items.map((product) => (
              <PartCard key={product.id} product={product} params={params} />
            ))}
          </div>
        ) : (
          <div className="product-empty">
            <PackageSearch size={30} strokeWidth={1.4} aria-hidden="true" />
            <h3>
              {params.has("cursor")
                ? "No products on this page"
                : filtered
                  ? noCatalogue
                    ? "No products are published yet"
                    : categoryOnly
                      ? "No products in this category"
                      : "No matching products"
                  : "No products are published yet"}
            </h3>
            <p>
              {noCatalogue
                ? "Our online product catalogue has no published listings. Tell us the product, quantity and specifications you need. Add vehicle details when relevant."
                : filtered
                  ? categoryOnly
                    ? "No online products are listed in this category. Choose another category or ask our team about what you need."
                    : "No results for these details. Try a broader search or remove a filter."
                  : "Contact our team to ask about the product you need."}
            </p>
            <div className="actions">
              {params.has("cursor") && (
                <button className="button secondary" onClick={() => update(() => {})}>
                  Return to first page
                </button>
              )}
              {filtered && !noCatalogue && (
                <button className="button secondary" onClick={clear}>
                  Clear filters
                </button>
              )}
              <Link className="button" href={partsEnquiryHref(params)}>
                Ask about a product
              </Link>
            </div>
          </div>
        )}
      </div>
      {!!products.data?.items.length &&
        !products.error &&
        (params.has("cursor") || products.data.nextCursor) && (
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
              disabled={
                !products.data?.nextCursor || products.loading || !!products.error
              }
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
        )}
    </>
  );
}
