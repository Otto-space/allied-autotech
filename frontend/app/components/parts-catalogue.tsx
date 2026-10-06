"use client";
import type { PublicSeed } from "@/lib/api/public-seed";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronDown, PackageSearch, X } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import { parseProducts } from "@/lib/api/commerce-schemas";
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
  initial?: PublicSeed<ReturnType<typeof parseProducts>>;
}) {
  const searchParams = useSearchParams();
  const [searchReset, setSearchReset] = useState(0);
  const { params, invalid } = normalizeProductQuery(
    new URLSearchParams(searchParams.toString()),
  );
  const products = useResource(productApiPath(params), parseProducts, initial?.data, {
    initialError: initial?.error,
    revalidateOnMount: false,
  });
  const categories = useProductCategories(params.get("categoryId") ?? "");
  const selected = productFilterKeys.filter((key) => params.has(key));
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
      <div className="product-inventory-heading">
        <h2 id="product-results-heading" tabIndex={-1}>
          Explore automotive products
        </h2>
        <p role="status" aria-live="polite">
          {products.loading
            ? "Loading products…"
            : products.error
              ? "Products unavailable"
              : `${products.data?.items.length ?? 0} product${products.data?.items.length === 1 ? "" : "s"} on this page`}
        </p>
      </div>
      {invalid && (
        <p className="notice">
          Some filters in this link were invalid and have been ignored. Review the filters
          below.
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
              onChange={(event) => update((next) => next.set("sort", event.target.value))}
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
      <div className="product-active-filters" aria-label="Active product filters">
        {selected.length ? (
          <>
            {selected.map((key) => {
              const value = params.get(key)!;
              const label =
                key === "categoryId"
                  ? `Category: ${categories.selected?.name ?? (categories.selectedError ? "Unavailable category" : "Loading…")}`
                  : key === "featured"
                    ? value === "true"
                      ? "Featured only"
                      : "Non-featured only"
                    : `${key[0].toUpperCase()}${key.slice(1)}: ${value}`;
              return (
                <button
                  type="button"
                  key={key}
                  className="product-chip"
                  aria-label={`Remove ${label}`}
                  title={label}
                  onClick={() => update((next) => next.delete(key))}
                >
                  <span>{label}</span>
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
            <button className="button secondary" onClick={products.refresh}>
              Retry products
            </button>
          </div>
        ) : products.loading ? (
          <div className="product-results-grid" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div className="product-skeleton" key={i}>
                <div />
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
              return (
                <article className="product-card shop-product-card" key={product.id}>
                  <Link href={`/parts/${product.id}`}>
                    <PublicMedia src={photo?.url} alt={photo?.altText ?? product.name} />
                    <div className="product-copy">
                      <span className="product-card-meta">{product.category.name}</span>
                      <h3>{product.name}</h3>
                      <p>
                        {product.brand ? `${product.brand} · ` : ""}SKU {product.sku}
                      </p>
                      <strong>{formatKobo(product.priceKobo)}</strong>
                      <p className="shop-stock-label">
                        {product.availability.some((item) => item.inStock)
                          ? "Available at a listed branch"
                          : "Currently unavailable"}
                      </p>
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
              {selected.length ? "No matching products" : "No products are listed yet"}
            </h3>
            <p>
              {selected.length
                ? "Try a broader search or clear your filters."
                : "Contact our team to ask about the product you need."}
            </p>
            <div className="actions">
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
